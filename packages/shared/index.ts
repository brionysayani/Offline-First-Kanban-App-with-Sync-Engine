export type EntityType = 'board' | 'column' | 'card';

export type OperationType =
  | 'CREATE_BOARD'
  | 'UPDATE_BOARD'
  | 'DELETE_BOARD'
  | 'CREATE_COLUMN'
  | 'UPDATE_COLUMN'
  | 'DELETE_COLUMN'
  | 'CREATE_CARD'
  | 'UPDATE_CARD'
  | 'MOVE_CARD'
  | 'DELETE_CARD';

export type OperationStatus = 'pending' | 'syncing' | 'synced' | 'failed' | 'conflict';

export type SyncStatus = 'online' | 'offline' | 'syncing' | 'synced' | 'conflict';

export interface LocalBoard {
  id: string;
  title: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface LocalColumn {
  id: string;
  boardId: string;
  title: string;
  position: number;
  version: number;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface LocalCard {
  id: string;
  boardId: string;
  columnId: string;
  title: string;
  description?: string;
  position: number;
  version: number;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface OutboxOperation<TPayload = unknown> {
  id: string;
  type: OperationType;
  entityType: EntityType;
  entityId: string;
  payload: TPayload;
  baseVersion: number;
  createdAt: string;
  status: OperationStatus;
  retryCount: number;
  lastAttemptAt?: string;
  lastError?: string;
}

export interface ActivityEvent<TMetadata = unknown> {
  id: string;
  operationId?: string;
  type: OperationType | 'SYNC_RETRY' | 'SYNC_FAILED' | 'SYNCED' | 'CONFLICT';
  entityType?: EntityType;
  entityId?: string;
  message: string;
  metadata?: TMetadata;
  createdAt: string;
}

export interface ConflictRecord<TLocal = unknown, TRemote = unknown> {
  id: string;
  operationId: string;
  entityType: EntityType;
  entityId: string;
  localValue: TLocal;
  remoteValue?: TRemote;
  baseVersion: number;
  message: string;
  createdAt: string;
  resolvedAt?: string;
}
