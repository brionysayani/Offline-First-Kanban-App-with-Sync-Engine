import { apiClient } from '../api/client';
import { db } from '../db/indexedDb';
import type {
  LocalBoard,
  LocalCard,
  LocalColumn,
  OutboxOperation,
  SyncBatchResponse,
  SyncBootstrapResponse
} from '../../packages/shared';
import type { SyncPushResult, SyncTransport } from './syncEngine';

const upsertBootstrapState = async (response: SyncBootstrapResponse) => {
  const boards: LocalBoard[] = response.boards.map(({ columns: _columns, cards: _cards, ...board }) => board);
  const columns: LocalColumn[] = response.boards.flatMap((board) => board.columns);
  const cards: LocalCard[] = response.boards.flatMap((board) => board.cards);

  await db.transaction('rw', db.boards, db.columns, db.cards, async () => {
    await db.boards.bulkPut(boards);
    await db.columns.bulkPut(columns);
    await db.cards.bulkPut(cards);
  });
};

export const createHttpSyncTransport = (): SyncTransport => ({
  pushOperations: async (operations: OutboxOperation[]): Promise<SyncPushResult[]> => {
    if (operations.length === 0) {
      return [];
    }

    const response = await apiClient.post<SyncBatchResponse>('/api/sync', { operations });

    return response.results.map((result) => {
      if (result.status === 'conflict') {
        return {
          operationId: result.operationId,
          status: 'conflict',
          remoteValue: result.conflict?.serverValue,
          message: result.conflict?.message ?? result.message
        };
      }

      if (result.status === 'duplicate') {
        return {
          operationId: result.operationId,
          status: 'duplicate'
        };
      }

      if (result.status === 'error') {
        throw new Error(result.message ?? 'Remote sync failed');
      }

      return {
        operationId: result.operationId,
        status: 'accepted'
      };
    });
  },
  pullChanges: async () => {
    const response = await apiClient.post<SyncBootstrapResponse>('/api/sync/bootstrap');
    await upsertBootstrapState(response);
  }
});
