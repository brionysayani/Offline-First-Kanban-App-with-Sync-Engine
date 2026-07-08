import { db, createLocalId, nowIso, recordActivityEvent } from '../db/indexedDb';
import type { ConflictRecord, OutboxOperation, SyncStatus } from '../../packages/shared';

export interface SyncEngine {
  getStatus: () => SyncStatus;
  setOnline: (value: boolean) => void;
  syncNow: () => Promise<void>;
  pushChanges: () => Promise<void>;
  pullChanges: () => Promise<void>;
  onStatusChange?: (status: SyncStatus) => void;
}

export interface SyncPushResult {
  operationId: string;
  status: 'accepted' | 'duplicate' | 'conflict';
  remoteValue?: unknown;
  message?: string;
}

export interface SyncTransport {
  pushOperations: (operations: OutboxOperation[]) => Promise<SyncPushResult[] | void>;
  pullChanges?: () => Promise<void>;
}

export interface SyncEngineOptions {
  transport?: SyncTransport;
  maxRetries?: number;
  onStatusChange?: (status: SyncStatus) => void;
}

const defaultTransport: SyncTransport = {
  pushOperations: async () => undefined,
  pullChanges: async () => undefined
};

const getPendingOperations = async (maxRetries: number): Promise<OutboxOperation[]> => {
  const operations = await db.operations.where('status').anyOf('pending', 'failed').sortBy('createdAt');
  return operations.filter((operation) => operation.retryCount < maxRetries);
};

export const createSyncEngine = ({
  transport = defaultTransport,
  maxRetries = 5,
  onStatusChange
}: SyncEngineOptions = {}): SyncEngine => {
  let status: SyncStatus = typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'online';
  let syncInFlight = false;

  const setStatus = (nextStatus: SyncStatus) => {
    status = nextStatus;
    onStatusChange?.(nextStatus);
  };

  const setOnline = (value: boolean) => {
    setStatus(value ? 'online' : 'offline');
  };

  const markOperationSynced = async (operation: OutboxOperation) => {
    await db.transaction('rw', db.operations, db.activityEvents, async () => {
      await db.operations.update(operation.id, {
        status: 'synced',
        lastAttemptAt: nowIso(),
        lastError: undefined
      });
      await recordActivityEvent({
        operationId: operation.id,
        type: 'SYNCED',
        entityType: operation.entityType,
        entityId: operation.entityId,
        message: `${operation.type} synced`
      });
    });
  };

  const markOperationFailed = async (operation: OutboxOperation, error: unknown) => {
    const retryCount = operation.retryCount + 1;
    const lastError = error instanceof Error ? error.message : 'Sync attempt failed';
    const nextStatus = retryCount >= maxRetries ? 'failed' : 'pending';

    await db.transaction('rw', db.operations, db.activityEvents, async () => {
      await db.operations.update(operation.id, {
        status: nextStatus,
        retryCount,
        lastAttemptAt: nowIso(),
        lastError
      });
      await recordActivityEvent({
        operationId: operation.id,
        type: retryCount >= maxRetries ? 'SYNC_FAILED' : 'SYNC_RETRY',
        entityType: operation.entityType,
        entityId: operation.entityId,
        message:
          retryCount >= maxRetries
            ? `${operation.type} failed after ${retryCount} attempts`
            : `${operation.type} queued for retry ${retryCount}`,
        metadata: { retryCount, lastError }
      });
    });
  };

  const markOperationConflicted = async (operation: OutboxOperation, result: SyncPushResult) => {
    const conflict: ConflictRecord = {
      id: createLocalId('conflict'),
      operationId: operation.id,
      entityType: operation.entityType,
      entityId: operation.entityId,
      localValue: operation.payload,
      remoteValue: result.remoteValue,
      baseVersion: operation.baseVersion,
      message: result.message ?? 'Remote state changed before this operation synced',
      createdAt: nowIso()
    };

    await db.transaction('rw', db.operations, db.activityEvents, db.conflicts, async () => {
      await db.operations.update(operation.id, {
        status: 'conflict',
        lastAttemptAt: nowIso(),
        lastError: conflict.message
      });
      await db.conflicts.add(conflict);
      await recordActivityEvent({
        operationId: operation.id,
        type: 'CONFLICT',
        entityType: operation.entityType,
        entityId: operation.entityId,
        message: conflict.message,
        metadata: conflict
      });
    });
  };

  const pushOneOperation = async (operation: OutboxOperation) => {
    await db.operations.update(operation.id, {
      status: 'syncing',
      lastAttemptAt: nowIso()
    });

    try {
      const results = await transport.pushOperations([operation]);
      const result = results?.find((item) => item.operationId === operation.id);

      if (result?.status === 'conflict') {
        await markOperationConflicted(operation, result);
        return;
      }

      await markOperationSynced(operation);
    } catch (error) {
      await markOperationFailed(operation, error);
    }
  };

  const pushChanges = async () => {
    if (status === 'offline') {
      return;
    }

    const operations = await getPendingOperations(maxRetries);

    for (const operation of operations) {
      await pushOneOperation(operation);
    }
  };

  const pullChanges = async () => {
    if (status === 'offline') {
      return;
    }

    await transport.pullChanges?.();
  };

  const syncNow = async () => {
    if (status === 'offline' || syncInFlight) {
      return;
    }

    syncInFlight = true;
    setStatus('syncing');

    try {
      await pushChanges();
      await pullChanges();

      const conflictCount = await db.operations.where('status').equals('conflict').count();
      setStatus(conflictCount > 0 ? 'conflict' : 'synced');
    } catch {
      const conflictCount = await db.operations.where('status').equals('conflict').count();
      setStatus(conflictCount > 0 ? 'conflict' : 'online');
    } finally {
      syncInFlight = false;
    }
  };

  return {
    getStatus: () => status,
    setOnline,
    syncNow,
    pushChanges,
    pullChanges,
    onStatusChange
  };
};
