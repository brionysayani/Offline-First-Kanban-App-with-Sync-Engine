import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { broadcastBoardOperation } from '../socket';
import type { OutboxOperation } from '../../../../packages/shared';

const router = Router();
const prisma = new PrismaClient();

const mapBoard = (board: {
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
}) => ({
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

router.get('/', authMiddleware, async (_req: AuthRequest, res: Response) => {
  const boards = await prisma.board.findMany({
    where: { deletedAt: null },
    include: {
      columns: { where: { deletedAt: null }, orderBy: { position: 'asc' } },
      cards: { where: { deletedAt: null }, orderBy: { position: 'asc' } }
    },
    orderBy: { updatedAt: 'desc' }
  });

  res.json({ boards: boards.map(mapBoard) });
});

router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const body = req.body as { title?: string; description?: string };
  const board = await prisma.board.create({
    data: {
      title: body.title?.trim() || 'Untitled board',
      description: body.description
    }
  });
  const mappedBoard = mapBoard(board);
  const operation: OutboxOperation = {
    id: `server_${board.id}_${Date.now()}`,
    type: 'CREATE_BOARD',
    entityType: 'board',
    entityId: board.id,
    payload: mappedBoard,
    baseVersion: 0,
    createdAt: new Date().toISOString(),
    status: 'synced',
    retryCount: 0
  };

  broadcastBoardOperation(board.id, {
    boardId: board.id,
    operation,
    resultingVersion: board.version,
    serverTime: new Date().toISOString()
  });

  res.status(201).json({ board: mappedBoard });
});

export default router;
