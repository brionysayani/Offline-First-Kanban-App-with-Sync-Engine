import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import OfflineBanner from '../components/OfflineBanner';
import SyncStatusBadge from '../components/SyncStatusBadge';

type BoardsPageProps = {
  onOpenBoard: (boardId: string) => void;
};

function BoardsPage({ onOpenBoard }: BoardsPageProps) {
  const [title, setTitle] = useState('');
  const { boards, columns, cards, operations, syncStatus, isOnline, hydrate, createBoard, setOnline, syncNow } =
    useAppStore();
  const pendingCount = useMemo(
    () => operations.filter((operation) => operation.status !== 'synced' && operation.status !== 'conflict').length,
    [operations]
  );

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (isOnline) {
      void syncNow();
    }
  }, [isOnline, syncNow]);

  const handleCreateBoard = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextTitle = title.trim();

    if (!nextTitle) {
      return;
    }

    const board = await createBoard(nextTitle);
    setTitle('');
    onOpenBoard(board.id);
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-cyan-400">Boards</p>
          <h1 className="mt-2 text-3xl font-semibold">Your workspace</h1>
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

      <form onSubmit={handleCreateBoard} className="mb-6 flex flex-col gap-3 sm:flex-row">
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="New board name"
          className="min-h-11 flex-1 rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-500"
        />
        <button
          type="submit"
          className="min-h-11 rounded-md bg-cyan-500 px-4 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
        >
          Create board
        </button>
      </form>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {boards.map((board) => {
          const columnCount = columns.filter((column) => column.boardId === board.id).length;
          const cardCount = cards.filter((card) => card.boardId === board.id).length;

          return (
            <button
              key={board.id}
              onClick={() => onOpenBoard(board.id)}
              className="min-h-36 rounded-md border border-slate-800 bg-slate-900 p-5 text-left shadow-lg transition hover:border-cyan-500"
            >
              <h2 className="text-xl font-semibold">{board.title}</h2>
              <p className="mt-2 text-sm text-slate-400">
                {columnCount} columns, {cardCount} cards
              </p>
              <p className="mt-6 text-xs text-slate-500">Updated {new Date(board.updatedAt).toLocaleString()}</p>
            </button>
          );
        })}
      </div>

      {boards.length === 0 ? (
        <div className="mt-8 rounded-md border border-dashed border-slate-700 p-8 text-center text-sm text-slate-400">
          Create a board to start planning offline.
        </div>
      ) : null}
    </main>
  );
}

export default BoardsPage;
