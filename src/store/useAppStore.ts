import { create } from 'zustand';
import { db, createLocalId, nowIso, queueOperation } from '../db/indexedDb';
import { createSyncEngine } from '../sync/syncEngine';
import type {
  ActivityEvent,
  ConflictRecord,
  LocalBoard,
  LocalCard,
  LocalColumn,
  OutboxOperation,
  SyncStatus
} from '../../packages/shared';

type AppState = {
  boards: LocalBoard[];
  columns: LocalColumn[];
  cards: LocalCard[];
  operations: OutboxOperation[];
  activityEvents: ActivityEvent[];
  conflicts: ConflictRecord[];
  isOnline: boolean;
  isSyncing: boolean;
  syncStatus: SyncStatus;
  hydrate: () => Promise<void>;
  setOnline: (value: boolean) => void;
  setSyncing: (value: boolean) => void;
  syncNow: () => Promise<void>;
  createBoard: (title: string) => Promise<LocalBoard>;
  updateBoard: (id: string, changes: Partial<Pick<LocalBoard, 'title'>>) => Promise<void>;
  deleteBoard: (id: string) => Promise<void>;
  createColumn: (boardId: string, title: string, position?: number) => Promise<LocalColumn>;
  updateColumn: (id: string, changes: Partial<Pick<LocalColumn, 'title' | 'position'>>) => Promise<void>;
  deleteColumn: (id: string) => Promise<void>;
  createCard: (
    columnId: string,
    input: { title: string; description?: string; position?: number }
  ) => Promise<LocalCard>;
  updateCard: (id: string, changes: Partial<Pick<LocalCard, 'title' | 'description'>>) => Promise<void>;
  moveCard: (id: string, columnId: string, position: number) => Promise<void>;
  deleteCard: (id: string) => Promise<void>;
};

const activeOnly = <T extends { deletedAt?: string }>(items: T[]): T[] => items.filter((item) => !item.deletedAt);

const refreshLocalState = async (): Promise<
  Pick<AppState, 'boards' | 'columns' | 'cards' | 'operations' | 'activityEvents' | 'conflicts'>
> => {
  const [boards, columns, cards, operations, activityEvents, conflicts] = await Promise.all([
    db.boards.orderBy('updatedAt').reverse().toArray(),
    db.columns.orderBy('position').toArray(),
    db.cards.orderBy('position').toArray(),
    db.operations.orderBy('createdAt').reverse().toArray(),
    db.activityEvents.orderBy('createdAt').reverse().toArray(),
    db.conflicts.orderBy('createdAt').reverse().toArray()
  ]);

  return {
    boards: activeOnly(boards),
    columns: activeOnly(columns),
    cards: activeOnly(cards),
    operations,
    activityEvents,
    conflicts: conflicts.filter((conflict) => !conflict.resolvedAt)
  };
};

export const useAppStore = create<AppState>((set, get) => {
  const syncEngine = createSyncEngine({
    onStatusChange: (syncStatus) => set({ syncStatus, isSyncing: syncStatus === 'syncing' })
  });

  return {
    boards: [],
    columns: [],
    cards: [],
    operations: [],
    activityEvents: [],
    conflicts: [],
    isOnline: true,
    isSyncing: false,
    syncStatus: 'online',
    hydrate: async () => {
      set(await refreshLocalState());
    },
    setOnline: (value) => {
      syncEngine.setOnline(value);
      set({ isOnline: value, syncStatus: value ? 'online' : 'offline' });
    },
    setSyncing: (value) => set({ isSyncing: value, syncStatus: value ? 'syncing' : get().syncStatus }),
    syncNow: async () => {
      await syncEngine.syncNow();
      set(await refreshLocalState());
    },
    createBoard: async (title) => {
      const timestamp = nowIso();
      const board: LocalBoard = {
        id: createLocalId('board'),
        title,
        version: 1,
        createdAt: timestamp,
        updatedAt: timestamp
      };

      await db.transaction('rw', db.boards, db.operations, db.activityEvents, async () => {
        await db.boards.add(board);
        await queueOperation({
          type: 'CREATE_BOARD',
          entityType: 'board',
          entityId: board.id,
          payload: board,
          baseVersion: 0,
          message: `Created board "${board.title}"`
        });
      });

      set(await refreshLocalState());
      return board;
    },
    updateBoard: async (id, changes) => {
      const existing = await db.boards.get(id);
      if (!existing || existing.deletedAt) {
        return;
      }

      const updated: LocalBoard = {
        ...existing,
        ...changes,
        version: existing.version + 1,
        updatedAt: nowIso()
      };

      await db.transaction('rw', db.boards, db.operations, db.activityEvents, async () => {
        await db.boards.put(updated);
        await queueOperation({
          type: 'UPDATE_BOARD',
          entityType: 'board',
          entityId: id,
          payload: { changes, board: updated },
          baseVersion: existing.version,
          message: `Updated board "${updated.title}"`
        });
      });

      set(await refreshLocalState());
    },
    deleteBoard: async (id) => {
      const existing = await db.boards.get(id);
      if (!existing || existing.deletedAt) {
        return;
      }

      const timestamp = nowIso();
      const deleted: LocalBoard = {
        ...existing,
        version: existing.version + 1,
        updatedAt: timestamp,
        deletedAt: timestamp
      };

      await db.transaction('rw', db.boards, db.columns, db.cards, db.operations, db.activityEvents, async () => {
        await db.boards.put(deleted);
        const [columns, cards] = await Promise.all([
          db.columns.where('boardId').equals(id).toArray(),
          db.cards.where('boardId').equals(id).toArray()
        ]);
        await db.columns.bulkPut(
          columns.map((column) => ({ ...column, updatedAt: timestamp, deletedAt: timestamp }))
        );
        await db.cards.bulkPut(cards.map((card) => ({ ...card, updatedAt: timestamp, deletedAt: timestamp })));
        await queueOperation({
          type: 'DELETE_BOARD',
          entityType: 'board',
          entityId: id,
          payload: { board: deleted },
          baseVersion: existing.version,
          message: `Deleted board "${existing.title}"`
        });
      });

      set(await refreshLocalState());
    },
    createColumn: async (boardId, title, position) => {
      const timestamp = nowIso();
      const resolvedPosition = position ?? (await db.columns.where('boardId').equals(boardId).count());
      const column: LocalColumn = {
        id: createLocalId('column'),
        boardId,
        title,
        position: resolvedPosition,
        version: 1,
        createdAt: timestamp,
        updatedAt: timestamp
      };

      await db.transaction('rw', db.columns, db.operations, db.activityEvents, async () => {
        await db.columns.add(column);
        await queueOperation({
          type: 'CREATE_COLUMN',
          entityType: 'column',
          entityId: column.id,
          payload: column,
          baseVersion: 0,
          message: `Created column "${column.title}"`
        });
      });

      set(await refreshLocalState());
      return column;
    },
    updateColumn: async (id, changes) => {
      const existing = await db.columns.get(id);
      if (!existing || existing.deletedAt) {
        return;
      }

      const updated: LocalColumn = {
        ...existing,
        ...changes,
        version: existing.version + 1,
        updatedAt: nowIso()
      };

      await db.transaction('rw', db.columns, db.operations, db.activityEvents, async () => {
        await db.columns.put(updated);
        await queueOperation({
          type: 'UPDATE_COLUMN',
          entityType: 'column',
          entityId: id,
          payload: { changes, column: updated },
          baseVersion: existing.version,
          message: `Updated column "${updated.title}"`
        });
      });

      set(await refreshLocalState());
    },
    deleteColumn: async (id) => {
      const existing = await db.columns.get(id);
      if (!existing || existing.deletedAt) {
        return;
      }

      const timestamp = nowIso();
      const deleted: LocalColumn = {
        ...existing,
        version: existing.version + 1,
        updatedAt: timestamp,
        deletedAt: timestamp
      };

      await db.transaction('rw', db.columns, db.cards, db.operations, db.activityEvents, async () => {
        await db.columns.put(deleted);
        const cards = await db.cards.where('columnId').equals(id).toArray();
        await db.cards.bulkPut(cards.map((card) => ({ ...card, updatedAt: timestamp, deletedAt: timestamp })));
        await queueOperation({
          type: 'DELETE_COLUMN',
          entityType: 'column',
          entityId: id,
          payload: { column: deleted },
          baseVersion: existing.version,
          message: `Deleted column "${existing.title}"`
        });
      });

      set(await refreshLocalState());
    },
    createCard: async (columnId, input) => {
      const column = await db.columns.get(columnId);
      if (!column || column.deletedAt) {
        throw new Error('Column not found');
      }

      const timestamp = nowIso();
      const resolvedPosition = input.position ?? (await db.cards.where('columnId').equals(columnId).count());
      const card: LocalCard = {
        id: createLocalId('card'),
        boardId: column.boardId,
        columnId,
        title: input.title,
        description: input.description,
        position: resolvedPosition,
        version: 1,
        createdAt: timestamp,
        updatedAt: timestamp
      };

      await db.transaction('rw', db.cards, db.operations, db.activityEvents, async () => {
        await db.cards.add(card);
        await queueOperation({
          type: 'CREATE_CARD',
          entityType: 'card',
          entityId: card.id,
          payload: card,
          baseVersion: 0,
          message: `Created card "${card.title}"`
        });
      });

      set(await refreshLocalState());
      return card;
    },
    updateCard: async (id, changes) => {
      const existing = await db.cards.get(id);
      if (!existing || existing.deletedAt) {
        return;
      }

      const updated: LocalCard = {
        ...existing,
        ...changes,
        version: existing.version + 1,
        updatedAt: nowIso()
      };

      await db.transaction('rw', db.cards, db.operations, db.activityEvents, async () => {
        await db.cards.put(updated);
        await queueOperation({
          type: 'UPDATE_CARD',
          entityType: 'card',
          entityId: id,
          payload: { changes, card: updated },
          baseVersion: existing.version,
          message: `Updated card "${updated.title}"`
        });
      });

      set(await refreshLocalState());
    },
    moveCard: async (id, columnId, position) => {
      const existing = await db.cards.get(id);
      const targetColumn = await db.columns.get(columnId);
      if (!existing || existing.deletedAt || !targetColumn || targetColumn.deletedAt) {
        return;
      }

      const updated: LocalCard = {
        ...existing,
        boardId: targetColumn.boardId,
        columnId,
        position,
        version: existing.version + 1,
        updatedAt: nowIso()
      };

      await db.transaction('rw', db.cards, db.operations, db.activityEvents, async () => {
        await db.cards.put(updated);
        await queueOperation({
          type: 'MOVE_CARD',
          entityType: 'card',
          entityId: id,
          payload: {
            card: updated,
            from: { columnId: existing.columnId, position: existing.position },
            to: { columnId, position }
          },
          baseVersion: existing.version,
          message: `Moved card "${updated.title}"`
        });
      });

      set(await refreshLocalState());
    },
    deleteCard: async (id) => {
      const existing = await db.cards.get(id);
      if (!existing || existing.deletedAt) {
        return;
      }

      const timestamp = nowIso();
      const deleted: LocalCard = {
        ...existing,
        version: existing.version + 1,
        updatedAt: timestamp,
        deletedAt: timestamp
      };

      await db.transaction('rw', db.cards, db.operations, db.activityEvents, async () => {
        await db.cards.put(deleted);
        await queueOperation({
          type: 'DELETE_CARD',
          entityType: 'card',
          entityId: id,
          payload: { card: deleted },
          baseVersion: existing.version,
          message: `Deleted card "${existing.title}"`
        });
      });

      set(await refreshLocalState());
    }
  };
});
