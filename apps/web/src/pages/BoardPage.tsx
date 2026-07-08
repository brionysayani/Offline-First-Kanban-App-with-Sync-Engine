import KanbanBoard from '../components/KanbanBoard';
import ConflictPanel from '../components/ConflictPanel';
import OfflineBanner from '../components/OfflineBanner';
import SyncStatusBadge from '../components/SyncStatusBadge';

type BoardPageProps = {
  onBack: () => void;
};

function BoardPage({ onBack }: BoardPageProps) {
  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <button className="text-sm text-cyan-400" onClick={onBack}>
            ← Back to boards
          </button>
          <h1 className="mt-2 text-3xl font-semibold">Demo Board</h1>
        </div>
        <div className="flex items-center gap-3">
          <OfflineBanner />
          <SyncStatusBadge status="idle" />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <KanbanBoard />
        <div className="space-y-4">
          <ConflictPanel />
        </div>
      </div>
    </main>
  );
}

export default BoardPage;
