import { Router, Response } from 'express';
import { Prisma, PrismaClient } from '@prisma/client';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { broadcastBoardOperation } from '../socket';
import type {
  EntityType,
  LocalBoard,
  LocalCard,
  LocalColumn,
  OperationLogEntry,
  OutboxOperation,
  SyncBatchRequest,
  SyncConflict,
  SyncOperationResult
} from '../../../../packages/shared';

const router = Router();
const prisma = new PrismaClient();

type SyncEntity = LocalBoard | LocalColumn | LocalCard;
type TransactionClient = Prisma.TransactionClient;

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

const asString = (value: unknown, fallback = ''): string => (typeof value === 'string' ? value : fallback);

const asOptionalString = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined);

const asNumber = (value: unknown, fallback = 0): number => (typeof value === 'number' ? value : fallback);

const asDate = (value: unknown, fallback = new Date()): Date =>
  typeof value === 'string' || value instanceof Date ? new Date(value) : fallback;

const payloadEntity = <TEntity extends Record<string, unknown>>(
  operation: OutboxOperation,
  key: 'board' | 'column' | 'card'
): TEntity => {
  const payload = asRecord(operation.payload);
  return asRecord(payload[key] ?? payload) as TEntity;
};

const mapBoard = (
  board: {
    id: string;
    title: string;
    description: string | null;
    version: number;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
    columns?: Array<{
      id: string;
      boardId: string;
      title: string;
      position: number;
      version: number;
      createdAt: Date;
      updatedAt: Date;
      deletedAt: Date | null;
    }>;
    cards?: Array<{
      id: string;
      boardId: string;
      columnId: string;
      title: string;
      description: string | null;
      position: number;
      version: number;
      createdAt: Date;
      updatedAt: Date;
      deletedAt: Date | null;
    }>;
  }
) => ({
  id: board.id,
  title: board.title,
  description: board.description ?? undefined,
  version: board.version,
  createdAt: board.createdAt.toISOString(),
  updatedAt: board.updatedAt.toISOString(),
  deletedAt: board.deletedAt?.toISOString(),
  columns:
    board.columns?.map((column) => ({
      id: column.id,
      boardId: column.boardId,
      title: column.title,
      position: column.position,
      version: column.version,
      createdAt: column.createdAt.toISOString(),
      updatedAt: column.updatedAt.toISOString(),
      deletedAt: column.deletedAt?.toISOString()
    })) ?? [],
  cards:
    board.cards?.map((card) => ({
      id: card.id,
      boardId: card.boardId,
      columnId: card.columnId,
      title: card.title,
      description: card.description ?? undefined,
      position: card.position,
      version: card.version,
      createdAt: card.createdAt.toISOString(),
      updatedAt: card.updatedAt.toISOString(),
      deletedAt: card.deletedAt?.toISOString()
    })) ?? []
});

const mapOperationLog = (log: {
  id: string;
  operationId: string;
  type: string;
  entityType: string;
  entityId: string;
  payload: Prisma.JsonValue;
  baseVersion: number;
  resultingVersion: number;
  createdAt: Date;
}): OperationLogEntry => ({
  id: log.id,
  operationId: log.operationId,
  type: log.type as OperationLogEntry['type'],
  entityType: log.entityType as OperationLogEntry['entityType'],
  entityId: log.entityId,
  payload: log.payload,
  baseVersion: log.baseVersion,
  resultingVersion: log.resultingVersion,
  createdAt: log.createdAt.toISOString()
});

const getCurrentEntity = async (
  tx: TransactionClient,
  entityType: EntityType,
  entityId: string
): Promise<SyncEntity | undefined> => {
  if (entityType === 'board') {
    const board = await tx.board.findUnique({ where: { id: entityId } });
    return board
      ? {
          id: board.id,
          title: board.title,
          version: board.version,
          createdAt: board.createdAt.toISOString(),
          updatedAt: board.updatedAt.toISOString(),
          deletedAt: board.deletedAt?.toISOString()
        }
      : undefined;
  }

  if (entityType === 'column') {
    const column = await tx.boardColumn.findUnique({ where: { id: entityId } });
    return column
      ? {
          id: column.id,
          boardId: column.boardId,
          title: column.title,
          position: column.position,
          version: column.version,
          createdAt: column.createdAt.toISOString(),
          updatedAt: column.updatedAt.toISOString(),
          deletedAt: column.deletedAt?.toISOString()
        }
      : undefined;
  }

  const card = await tx.card.findUnique({ where: { id: entityId } });
  return card
    ? {
        id: card.id,
        boardId: card.boardId,
        columnId: card.columnId,
        title: card.title,
        description: card.description ?? undefined,
        position: card.position,
        version: card.version,
        createdAt: card.createdAt.toISOString(),
        updatedAt: card.updatedAt.toISOString(),
        deletedAt: card.deletedAt?.toISOString()
      }
    : undefined;
};

const getBoardIdForOperation = async (
  tx: TransactionClient,
  operation: OutboxOperation,
  appliedEntity?: SyncEntity
): Promise<string | undefined> => {
  if (operation.entityType === 'board') {
    return operation.entityId;
  }

  if (appliedEntity && 'boardId' in appliedEntity) {
    return appliedEntity.boardId;
  }

  const payload = asRecord(operation.payload);
  const entity = asRecord(payload[operation.entityType] ?? payload);
  const boardId = asOptionalString(entity.boardId);

  if (boardId) {
    return boardId;
  }

  if (operation.entityType === 'column') {
    const column = await tx.boardColumn.findUnique({ where: { id: operation.entityId } });
    return column?.boardId;
  }

  const card = await tx.card.findUnique({ where: { id: operation.entityId } });
  return card?.boardId;
};

const assertBoardAccess = async (tx: TransactionClient, boardId: string | undefined, userId: string) => {
  if (!boardId) {
    return;
  }

  const board = await tx.board.findFirst({
    where: {
      id: boardId,
      userId
    },
    select: { id: true }
  });

  if (!board) {
    throw new Error('Board not found');
  }
};

const createConflict = (
  operation: OutboxOperation,
  serverVersion: number,
  serverValue: SyncEntity | undefined,
  message: string
): SyncOperationResult => ({
  operationId: operation.id,
  status: 'conflict',
  conflict: {
    operationId: operation.id,
    entityType: operation.entityType,
    entityId: operation.entityId,
    baseVersion: operation.baseVersion,
    serverVersion,
    serverValue,
    message
  } satisfies SyncConflict
});

const applyOperation = async (
  tx: TransactionClient,
  operation: OutboxOperation,
  serverVersion: number,
  userId: string
): Promise<{ boardId?: string; resultingVersion: number; entity?: SyncEntity }> => {
  const resultingVersion = serverVersion + 1;
  const timestamp = new Date();

  switch (operation.type) {
    case 'CREATE_BOARD': {
      const board = payloadEntity<Record<string, unknown>>(operation, 'board');
      const created = await tx.board.create({
        data: {
          id: operation.entityId,
          userId,
          title: asString(board.title, 'Untitled board'),
          description: asOptionalString(board.description),
          version: resultingVersion,
          createdAt: asDate(board.createdAt, timestamp),
          updatedAt: asDate(board.updatedAt, timestamp),
          deletedAt: board.deletedAt ? asDate(board.deletedAt) : undefined
        }
      });
      return { boardId: created.id, resultingVersion, entity: mapBoard(created) };
    }
    case 'UPDATE_BOARD': {
      const payload = asRecord(operation.payload);
      const board = asRecord(payload.board);
      const changes = asRecord(payload.changes);
      const updated = await tx.board.update({
        where: { id: operation.entityId },
        data: {
          title: asOptionalString(changes.title ?? board.title),
          description: asOptionalString(changes.description ?? board.description),
          version: resultingVersion,
          updatedAt: timestamp
        }
      });
      return { boardId: updated.id, resultingVersion, entity: mapBoard(updated) };
    }
    case 'DELETE_BOARD': {
      const deletedAt = timestamp;
      const updated = await tx.board.update({
        where: { id: operation.entityId },
        data: {
          version: resultingVersion,
          deletedAt,
          updatedAt: timestamp,
          columns: { updateMany: { where: {}, data: { deletedAt, updatedAt: timestamp } } },
          cards: { updateMany: { where: {}, data: { deletedAt, updatedAt: timestamp } } }
        }
      });
      return { boardId: updated.id, resultingVersion, entity: mapBoard(updated) };
    }
    case 'CREATE_COLUMN': {
      const column = payloadEntity<Record<string, unknown>>(operation, 'column');
      const created = await tx.boardColumn.create({
        data: {
          id: operation.entityId,
          boardId: asString(column.boardId),
          title: asString(column.title, 'Untitled column'),
          position: asNumber(column.position),
          version: resultingVersion,
          createdAt: asDate(column.createdAt, timestamp),
          updatedAt: asDate(column.updatedAt, timestamp),
          deletedAt: column.deletedAt ? asDate(column.deletedAt) : undefined
        }
      });
      return {
        boardId: created.boardId,
        resultingVersion,
        entity: {
          id: created.id,
          boardId: created.boardId,
          title: created.title,
          position: created.position,
          version: created.version,
          createdAt: created.createdAt.toISOString(),
          updatedAt: created.updatedAt.toISOString(),
          deletedAt: created.deletedAt?.toISOString()
        }
      };
    }
    case 'UPDATE_COLUMN': {
      const payload = asRecord(operation.payload);
      const column = asRecord(payload.column);
      const changes = asRecord(payload.changes);
      const updated = await tx.boardColumn.update({
        where: { id: operation.entityId },
        data: {
          title: asOptionalString(changes.title ?? column.title),
          position: typeof changes.position === 'number' ? changes.position : asNumber(column.position),
          version: resultingVersion,
          updatedAt: timestamp
        }
      });
      return {
        boardId: updated.boardId,
        resultingVersion,
        entity: {
          id: updated.id,
          boardId: updated.boardId,
          title: updated.title,
          position: updated.position,
          version: updated.version,
          createdAt: updated.createdAt.toISOString(),
          updatedAt: updated.updatedAt.toISOString(),
          deletedAt: updated.deletedAt?.toISOString()
        }
      };
    }
    case 'DELETE_COLUMN': {
      const deletedAt = timestamp;
      const updated = await tx.boardColumn.update({
        where: { id: operation.entityId },
        data: {
          version: resultingVersion,
          deletedAt,
          updatedAt: timestamp,
          cards: { updateMany: { where: {}, data: { deletedAt, updatedAt: timestamp } } }
        }
      });
      return {
        boardId: updated.boardId,
        resultingVersion,
        entity: {
          id: updated.id,
          boardId: updated.boardId,
          title: updated.title,
          position: updated.position,
          version: updated.version,
          createdAt: updated.createdAt.toISOString(),
          updatedAt: updated.updatedAt.toISOString(),
          deletedAt: updated.deletedAt?.toISOString()
        }
      };
    }
    case 'CREATE_CARD': {
      const card = payloadEntity<Record<string, unknown>>(operation, 'card');
      const created = await tx.card.create({
        data: {
          id: operation.entityId,
          boardId: asString(card.boardId),
          columnId: asString(card.columnId),
          title: asString(card.title, 'Untitled card'),
          description: asOptionalString(card.description),
          position: asNumber(card.position),
          version: resultingVersion,
          createdAt: asDate(card.createdAt, timestamp),
          updatedAt: asDate(card.updatedAt, timestamp),
          deletedAt: card.deletedAt ? asDate(card.deletedAt) : undefined
        }
      });
      return {
        boardId: created.boardId,
        resultingVersion,
        entity: {
          id: created.id,
          boardId: created.boardId,
          columnId: created.columnId,
          title: created.title,
          description: created.description ?? undefined,
          position: created.position,
          version: created.version,
          createdAt: created.createdAt.toISOString(),
          updatedAt: created.updatedAt.toISOString(),
          deletedAt: created.deletedAt?.toISOString()
        }
      };
    }
    case 'UPDATE_CARD': {
      const payload = asRecord(operation.payload);
      const card = asRecord(payload.card);
      const changes = asRecord(payload.changes);
      const updated = await tx.card.update({
        where: { id: operation.entityId },
        data: {
          title: asOptionalString(changes.title ?? card.title),
          description: asOptionalString(changes.description ?? card.description),
          version: resultingVersion,
          updatedAt: timestamp
        }
      });
      return {
        boardId: updated.boardId,
        resultingVersion,
        entity: {
          id: updated.id,
          boardId: updated.boardId,
          columnId: updated.columnId,
          title: updated.title,
          description: updated.description ?? undefined,
          position: updated.position,
          version: updated.version,
          createdAt: updated.createdAt.toISOString(),
          updatedAt: updated.updatedAt.toISOString(),
          deletedAt: updated.deletedAt?.toISOString()
        }
      };
    }
    case 'MOVE_CARD': {
      const payload = asRecord(operation.payload);
      const card = asRecord(payload.card);
      const to = asRecord(payload.to);
      const targetColumnId = asString(to.columnId ?? card.columnId);
      const targetColumn = await tx.boardColumn.findUnique({ where: { id: targetColumnId } });
      const updated = await tx.card.update({
        where: { id: operation.entityId },
        data: {
          boardId: targetColumn?.boardId ?? asString(card.boardId),
          columnId: targetColumnId,
          position: asNumber(to.position ?? card.position),
          version: resultingVersion,
          updatedAt: timestamp
        }
      });
      return {
        boardId: updated.boardId,
        resultingVersion,
        entity: {
          id: updated.id,
          boardId: updated.boardId,
          columnId: updated.columnId,
          title: updated.title,
          description: updated.description ?? undefined,
          position: updated.position,
          version: updated.version,
          createdAt: updated.createdAt.toISOString(),
          updatedAt: updated.updatedAt.toISOString(),
          deletedAt: updated.deletedAt?.toISOString()
        }
      };
    }
    case 'DELETE_CARD': {
      const deletedAt = timestamp;
      const updated = await tx.card.update({
        where: { id: operation.entityId },
        data: {
          version: resultingVersion,
          deletedAt,
          updatedAt: timestamp
        }
      });
      return {
        boardId: updated.boardId,
        resultingVersion,
        entity: {
          id: updated.id,
          boardId: updated.boardId,
          columnId: updated.columnId,
          title: updated.title,
          description: updated.description ?? undefined,
          position: updated.position,
          version: updated.version,
          createdAt: updated.createdAt.toISOString(),
          updatedAt: updated.updatedAt.toISOString(),
          deletedAt: updated.deletedAt?.toISOString()
        }
      };
    }
    default:
      throw new Error(`Unsupported operation type: ${operation.type}`);
  }
};

const applyQueuedOperation = async (operation: OutboxOperation, userId: string): Promise<SyncOperationResult> => {
  const applied = await prisma.$transaction(async (tx) => {
    const existingLog = await tx.operationLog.findUnique({ where: { operationId: operation.id } });

    if (existingLog) {
      return {
        result: {
          operationId: operation.id,
          status: 'duplicate',
          resultingVersion: existingLog.resultingVersion
        } satisfies SyncOperationResult
      };
    }

    const currentEntity = await getCurrentEntity(tx, operation.entityType, operation.entityId);
    const serverVersion = currentEntity?.version ?? 0;
    if (operation.type !== 'CREATE_BOARD') {
      await assertBoardAccess(tx, await getBoardIdForOperation(tx, operation, currentEntity), userId);
    }

    if (!currentEntity && !operation.type.startsWith('CREATE_')) {
      return {
        result: createConflict(operation, 0, undefined, 'Entity does not exist on the server')
      };
    }

    if (operation.baseVersion < serverVersion) {
      return {
        result: createConflict(
          operation,
          serverVersion,
          currentEntity,
          'Client baseVersion is older than the current server version'
        )
      };
    }

    const appliedOperation = await applyOperation(tx, operation, serverVersion, userId);
    const boardId = appliedOperation.boardId ?? (await getBoardIdForOperation(tx, operation, appliedOperation.entity));

    await tx.operationLog.create({
      data: {
        operationId: operation.id,
        type: operation.type,
        entityType: operation.entityType,
        entityId: operation.entityId,
        boardId,
        payload: operation.payload as Prisma.InputJsonValue,
        baseVersion: operation.baseVersion,
        resultingVersion: appliedOperation.resultingVersion
      }
    });

    return {
      boardId,
      resultingVersion: appliedOperation.resultingVersion,
      result: {
        operationId: operation.id,
        status: 'accepted',
        resultingVersion: appliedOperation.resultingVersion
      } satisfies SyncOperationResult
    };
  });

  if (applied.result.status === 'accepted' && applied.boardId && applied.resultingVersion) {
    broadcastBoardOperation(applied.boardId, {
      boardId: applied.boardId,
      operation,
      resultingVersion: applied.resultingVersion,
      serverTime: new Date().toISOString()
    });
  }

  return applied.result;
};

router.post('/bootstrap', authMiddleware, async (req: AuthRequest, res: Response) => {
  const [boards, operationLog] = await Promise.all([
    prisma.board.findMany({
      where: { userId: req.user!.id, deletedAt: null },
      include: {
        columns: { where: { deletedAt: null }, orderBy: { position: 'asc' } },
        cards: { where: { deletedAt: null }, orderBy: { position: 'asc' } }
      },
      orderBy: { updatedAt: 'desc' }
    }),
    prisma.operationLog.findMany({
      where: {
        OR: [{ boardId: null }, { board: { is: { userId: req.user!.id } } }]
      },
      orderBy: { createdAt: 'asc' }
    })
  ]);

  res.json({
    boards: boards.map(mapBoard),
    operationLog: operationLog.map(mapOperationLog),
    serverTime: new Date().toISOString()
  });
});

router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const body = req.body as SyncBatchRequest;
  const operations = Array.isArray(body.operations) ? body.operations : [];
  const results: SyncOperationResult[] = [];

  for (const operation of operations) {
    try {
      results.push(await applyQueuedOperation(operation, req.user!.id));
    } catch (error) {
      results.push({
        operationId: operation.id,
        status: 'error',
        message: error instanceof Error ? error.message : 'Operation failed'
      });
    }
  }

  res.json({
    results,
    serverTime: new Date().toISOString()
  });
});

export default router;
