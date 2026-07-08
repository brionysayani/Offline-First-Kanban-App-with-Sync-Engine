type BoardsPageProps = {
  onOpenBoard: () => void;
};

function BoardsPage({ onOpenBoard }: BoardsPageProps) {
  return (
    <main className="mx-auto max-w-6xl px-6 py-16">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-400">Boards</p>
          <h1 className="mt-2 text-3xl font-semibold">Your workspace</h1>
        </div>
        <button className="rounded-lg border border-cyan-500 px-4 py-2 text-cyan-400">New board</button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[1, 2, 3].map((board) => (
          <button
            key={board}
            onClick={onOpenBoard}
            className="rounded-2xl border border-slate-800 bg-slate-900 p-6 text-left shadow-lg transition hover:border-cyan-500"
          >
            <h2 className="text-xl font-semibold">Board {board}</h2>
            <p className="mt-2 text-sm text-slate-400">Placeholder board card for offline-first planning.</p>
          </button>
        ))}
      </div>
    </main>
  );
}

export default BoardsPage;
