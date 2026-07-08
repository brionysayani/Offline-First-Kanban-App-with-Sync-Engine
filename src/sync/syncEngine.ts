export type SyncStatus = 'idle' | 'syncing' | 'error';

export interface SyncEngine {
  status: SyncStatus;
  syncNow: () => Promise<void>;
  pushChanges: () => Promise<void>;
  pullChanges: () => Promise<void>;
}

export const createSyncEngine = (): SyncEngine => ({
  status: 'idle',
  syncNow: async () => undefined,
  pushChanges: async () => undefined,
  pullChanges: async () => undefined
});
