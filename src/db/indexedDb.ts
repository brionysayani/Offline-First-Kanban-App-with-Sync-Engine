import Dexie, { Table } from 'dexie';
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

export class OfflineKanbanDb extends Dexie {
  boards!: Table<LocalBoard, string>;
  columns!: Table<LocalColumn, string>;
  cards!: Table<LocalCard, string>;
  operations!: Table<OutboxOperation, string>;
  activityEvents!: Table<ActivityEvent, string>;
  conflicts!: Table<ConflictRecord, string>;

  constructor() {
    super('offline-kanban-db');
    this.version(1).stores({
      tasks: 'id, status, updatedAt'
    });
    this.version(2).stores({
      tasks: null,
      boards: 'id, updatedAt, deletedAt',
      columns: 'id, boardId, position, updatedAt, deletedAt',
      cards: 'id, boardId, columnId, position, updatedAt, deletedAt',
      operations: 'id, type, entityType, entityId, createdAt, status, retryCount',
      activityEvents: 'id, operationId, type, entityType, entityId, createdAt',
      conflicts: 'id, operationId, entityType, entityId, createdAt, resolvedAt'
    });
  }
}

export const db = new OfflineKanbanDb();

export const nowIso = (): string => new Date().toISOString();

export const createLocalId = (prefix: string): string => {
  const randomId =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);

  return `${prefix}_${randomId}`;
};

export interface QueueOperationInput<TPayload = unknown> {
  type: OperationType;
  entityType: EntityType;
  entityId: string;
  payload: TPayload;
  baseVersion: number;
  message: string;
}

export const createOutboxOperation = <TPayload>({
  type,
  entityType,
  entityId,
  payload,
  baseVersion
}: Omit<QueueOperationInput<TPayload>, 'message'>): OutboxOperation<TPayload> => ({
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

export const queueOperation = async <TPayload>({
  message,
  ...operationInput
}: QueueOperationInput<TPayload>): Promise<OutboxOperation<TPayload>> => {
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

export const recordActivityEvent = async (
  event: Omit<ActivityEvent, 'id' | 'createdAt'>
): Promise<ActivityEvent> => {
  const activityEvent: ActivityEvent = {
    ...event,
    id: createLocalId('event'),
    createdAt: nowIso()
  };

  await db.activityEvents.add(activityEvent);
  return activityEvent;
};
