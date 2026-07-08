import { useEffect, useMemo } from 'react';
import KanbanBoard from '../components/KanbanBoard';
import ConflictPanel from '../components/ConflictPanel';
import OfflineBanner from '../components/OfflineBanner';
import SyncStatusBadge from '../components/SyncStatusBadge';
import ActivityLogPanel from '../components/ActivityLogPanel';
import { useAppStore } from '../store/useAppStore';

type BoardPageProps = {
  boardId?: string;
  onBack: () => void;
};

function BoardPage({ boardId, onBack }: BoardPageProps) {
  const { boards, operations, syncStatus, isOnline, hydrate, setOnline, syncNow } = useAppStore();
  const board = boards.find((item) => item.id === boardId);
  const pendingCount = useMemo(
    () => operations.filter((operation) => operation.status !== 'synced' && operation.status !== 'conflict').length,
    [operations]
  );

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  if (!boardId || !board) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <button className="mb-6 text-sm text-cyan-400" onClick={onBack}>
          Back to boards
        </button>
        <div className="rounded-md border border-slate-800 bg-slate-900 p-8 text-sm text-slate-400">
          Select or create a board.
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <button className="text-sm text-cyan-400" onClick={onBack}>
            Back to boards
          </button>
          <h1 className="mt-2 text-3xl font-semibold">{board.title}</h1>
          <p className="mt-1 text-sm text-slate-400">Updated {new Date(board.updatedAt).toLocaleString()}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <OfflineBanner />
          <SyncStatusBadge status={syncStatus} pendingCount={pendingCount} />
          <button
            type="button"
            onClick={() => setOnline(!isOnline)}
            className="rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-200 transition hover:border-cyan-500"
          >
            {isOnline ? 'Go offline' : 'Go online'}
          </button>
          <button
            type="button"
            onClick={() => void syncNow()}
            className="rounded-md bg-cyan-500 px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
          >
            Sync
          </button>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <KanbanBoard boardId={boardId} />
        <div className="space-y-4">
          <ConflictPanel boardId={boardId} />
          <ActivityLogPanel boardId={boardId} />
        </div>
      </div>
    </main>
  );
}

export default BoardPage;
