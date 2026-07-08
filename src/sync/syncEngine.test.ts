import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  ActivityEvent,
  ConflictRecord,
  EntityType,
  LocalBoard,
  LocalCard,
  LocalColumn,
  OperationType,
  OutboxOperation
} from '../../packages/shared';

type EntityRecord = { id: string };

vi.mock('../db/indexedDb', () => {
  class MemoryTable<T extends EntityRecord> {
    private rows = new Map<string, T>();

    async add(item: T) {
      this.rows.set(item.id, { ...item });
      return item.id;
    }

    async put(item: T) {
      this.rows.set(item.id, { ...item });
      return item.id;
    }

    async bulkPut(items: T[]) {
      items.forEach((item) => {
        this.rows.set(item.id, { ...item });
      });
      return items.map((item) => item.id);
    }

    async update(id: string, changes: Partial<T>) {
      const existing = this.rows.get(id);

      if (!existing) {
        return 0;
      }

      this.rows.set(id, { ...existing, ...changes });
      return 1;
    }

    async get(id: string) {
      const item = this.rows.get(id);
      return item ? { ...item } : undefined;
    }

    async toArray() {
      return this.cloneRows();
    }

    orderBy(key: keyof T & string) {
      const sortedRows = () =>
        this.cloneRows().sort((first, second) => String(first[key] ?? '').localeCompare(String(second[key] ?? '')));

      return {
        toArray: async () => sortedRows(),
        reverse: () => ({
          toArray: async () => sortedRows().reverse()
        })
      };
    }

    where(key: keyof T & string) {
      const matchingRows = (values: unknown[]) => this.cloneRows().filter((item) => values.includes(item[key]));

      return {
        equals: (value: unknown) => ({
          toArray: async () => matchingRows([value]),
          count: async () => matchingRows([value]).length
        }),
        anyOf: (...values: unknown[]) => ({
          sortBy: async (sortKey: keyof T & string) =>
            matchingRows(values).sort((first, second) =>
              String(first[sortKey] ?? '').localeCompare(String(second[sortKey] ?? ''))
            )
        })
      };
    }

    clear() {
      this.rows.clear();
    }

    private cloneRows() {
      return Array.from(this.rows.values()).map((item) => ({ ...item }));
    }
  }

  let idCounter = 0;
  const nowIso = () => new Date().toISOString();
  const createLocalId = (prefix: string) => `${prefix}_${++idCounter}`;
  const db = {
    boards: new MemoryTable<LocalBoard>(),
    columns: new MemoryTable<LocalColumn>(),
    cards: new MemoryTable<LocalCard>(),
    operations: new MemoryTable<OutboxOperation>(),
    activityEvents: new MemoryTable<ActivityEvent>(),
    conflicts: new MemoryTable<ConflictRecord>(),
    transaction: async (...args: unknown[]) => {
      const callback = args[args.length - 1] as () => Promise<void>;
      await callback();
    },
    reset: () => {
      idCounter = 0;
      db.boards.clear();
      db.columns.clear();
      db.cards.clear();
      db.operations.clear();
      db.activityEvents.clear();
      db.conflicts.clear();
    }
  };

  const createOutboxOperation = <TPayload>({
    type,
    entityType,
    entityId,
    payload,
    baseVersion
  }: {
    type: OperationType;
    entityType: EntityType;
    entityId: string;
    payload: TPayload;
    baseVersion: number;
  }): OutboxOperation<TPayload> => ({
    id: createLocalId('op'),
    type,
    entityType,
    entityId,
    payload,
    baseVersion,
    createdAt: nowIso(),
    status: 'pending',
    retryCount: 0
  });

  const queueOperation = async <TPayload>({
    message,
    ...operationInput
  }: {
    type: OperationType;
    entityType: EntityType;
    entityId: string;
    payload: TPayload;
    baseVersion: number;
    message: string;
  }) => {
    const operation = createOutboxOperation(operationInput);
    const activityEvent: ActivityEvent = {
      id: createLocalId('event'),
      operationId: operation.id,
      type: operation.type,
      entityType: operation.entityType,
      entityId: operation.entityId,
      message,
      metadata: operation.payload,
      createdAt: operation.createdAt
    };

    await db.operations.add(operation);
    await db.activityEvents.add(activityEvent);
    return operation;
  };

  const recordActivityEvent = async (event: Omit<ActivityEvent, 'id' | 'createdAt'>) => {
    const activityEvent: ActivityEvent = {
      ...event,
      id: createLocalId('event'),
      createdAt: nowIso()
    };

    await db.activityEvents.add(activityEvent);
    return activityEvent;
  };

  return {
    db,
    nowIso,
    createLocalId,
    createOutboxOperation,
    queueOperation,
    recordActivityEvent
  };
});

import { db } from '../db/indexedDb';
import { useAppStore } from '../store/useAppStore';
import { createSyncEngine } from './syncEngine';

type MockDb = typeof db & { reset: () => void };

const mockedDb = db as MockDb;

const resetStore = () => {
  useAppStore.setState({
    boards: [],
    columns: [],
    cards: [],
    operations: [],
    activityEvents: [],
    conflicts: [],
    isOnline: true,
    isSyncing: false,
    syncStatus: 'online'
  });
};

const createOperation = (overrides: Partial<OutboxOperation> = {}): OutboxOperation => ({
  id: 'op_1',
  type: 'UPDATE_BOARD',
  entityType: 'board',
  entityId: 'board_1',
  payload: { title: 'Updated board' },
  baseVersion: 1,
  createdAt: '2026-07-08T00:00:00.000Z',
  status: 'pending',
  retryCount: 0,
  ...overrides
});

const seedOperation = async (overrides: Partial<OutboxOperation> = {}) => {
  const operation = createOperation(overrides);
  await db.operations.add(operation);
  return operation;
};

const getOperation = async (id: string) => {
  const operation = await db.operations.get(id);
  expect(operation).toBeDefined();
  return operation as OutboxOperation;
};

describe('sync engine', () => {
  beforeEach(() => {
    mockedDb.reset();
    resetStore();
    vi.clearAllMocks();
  });

  it('stores queued operations while offline', async () => {
    const store = useAppStore.getState();

    store.setOnline(false);
    const board = await useAppStore.getState().createBoard('Offline launch plan');

    const operations = await db.operations.where('status').equals('pending').toArray();

    expect(useAppStore.getState().syncStatus).toBe('offline');
    expect(useAppStore.getState().boards).toContainEqual(board);
    expect(operations).toHaveLength(1);
    expect(operations[0]).toMatchObject({
      type: 'CREATE_BOARD',
      entityType: 'board',
      entityId: board.id,
      status: 'pending',
      retryCount: 0
    });
  });

  it('flushes pending operations when online', async () => {
    const operation = await seedOperation();
    const pushOperations = vi.fn(async (operations: OutboxOperation[]) =>
      operations.map((item) => ({ operationId: item.id, status: 'accepted' as const }))
    );
    const engine = createSyncEngine({ transport: { pushOperations } });

    engine.setOnline(true);
    await engine.syncNow();

    const syncedOperation = await getOperation(operation.id);
    const activityEvents = await db.activityEvents.toArray();

    expect(pushOperations).toHaveBeenCalledWith([expect.objectContaining({ id: operation.id })]);
    expect(syncedOperation.status).toBe('synced');
    expect(engine.getStatus()).toBe('synced');
    expect(activityEvents).toEqual([expect.objectContaining({ operationId: operation.id, type: 'SYNCED' })]);
  });

  it('ignores duplicate remote operation acknowledgements', async () => {
    const operation = await seedOperation({ id: 'op_duplicate' });
    const pushOperations = vi.fn(async () => [
      { operationId: operation.id, status: 'duplicate' as const }
    ]);
    const engine = createSyncEngine({ transport: { pushOperations } });

    await engine.syncNow();

    const syncedOperation = await getOperation(operation.id);
    const conflicts = await db.conflicts.toArray();

    expect(pushOperations).toHaveBeenCalledTimes(1);
    expect(syncedOperation.status).toBe('synced');
    expect(conflicts).toHaveLength(0);
  });

  it('detects version conflicts returned by the remote sync API', async () => {
    const operation = await seedOperation({ id: 'op_conflict', baseVersion: 1 });
    const remoteValue = { id: operation.entityId, title: 'Server title', version: 3 };
    const pushOperations = vi.fn(async () => [
      {
        operationId: operation.id,
        status: 'conflict' as const,
        remoteValue,
        message: 'Client baseVersion is older than the current server version'
      }
    ]);
    const engine = createSyncEngine({ transport: { pushOperations } });

    await engine.syncNow();

    const conflictedOperation = await getOperation(operation.id);
    const conflicts = await db.conflicts.toArray();

    expect(conflictedOperation.status).toBe('conflict');
    expect(engine.getStatus()).toBe('conflict');
    expect(conflicts).toEqual([
      expect.objectContaining({
        operationId: operation.id,
        entityType: 'board',
        entityId: operation.entityId,
        baseVersion: 1,
        remoteValue
      })
    ]);
  });

  it('retries failed operations', async () => {
    const operation = await seedOperation({ id: 'op_retry' });
    const pushOperations = vi
      .fn()
      .mockRejectedValueOnce(new Error('Network unavailable'))
      .mockResolvedValueOnce([{ operationId: operation.id, status: 'accepted' }]);
    const engine = createSyncEngine({ transport: { pushOperations }, maxRetries: 3 });

    await engine.syncNow();

    const failedOnce = await getOperation(operation.id);
    expect(failedOnce).toMatchObject({
      status: 'pending',
      retryCount: 1,
      lastError: 'Network unavailable'
    });

    await engine.syncNow();

    const retriedOperation = await getOperation(operation.id);
    const activityEvents = await db.activityEvents.toArray();

    expect(pushOperations).toHaveBeenCalledTimes(2);
    expect(retriedOperation.status).toBe('synced');
    expect(retriedOperation.retryCount).toBe(1);
    expect(activityEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ operationId: operation.id, type: 'SYNC_RETRY' }),
        expect.objectContaining({ operationId: operation.id, type: 'SYNCED' })
      ])
    );
  });

  it('updates local IndexedDB state optimistically', async () => {
    const board = await useAppStore.getState().createBoard('Optimistic board');
    const todoColumn = await useAppStore.getState().createColumn(board.id, 'To do');
    const doneColumn = await useAppStore.getState().createColumn(board.id, 'Done');
    const card = await useAppStore.getState().createCard(todoColumn.id, { title: 'Draft sync notes' });

    await useAppStore.getState().moveCard(card.id, doneColumn.id, 0);

    const storedBoard = await db.boards.get(board.id);
    const storedCard = await db.cards.get(card.id);
    const operations = await db.operations.orderBy('createdAt').toArray();

    expect(storedBoard).toMatchObject({ id: board.id, title: 'Optimistic board' });
    expect(storedCard).toMatchObject({
      id: card.id,
      boardId: board.id,
      columnId: doneColumn.id,
      title: 'Draft sync notes'
    });
    expect(useAppStore.getState().cards.find((item) => item.id === card.id)).toMatchObject({
      columnId: doneColumn.id
    });
    expect(operations.map((item) => item.type)).toEqual([
      'CREATE_BOARD',
      'CREATE_COLUMN',
      'CREATE_COLUMN',
      'CREATE_CARD',
      'MOVE_CARD'
    ]);
  });
});
