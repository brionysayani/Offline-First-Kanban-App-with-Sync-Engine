const columns = [
  { id: 'todo', title: 'To Do' },
  { id: 'doing', title: 'Doing' },
  { id: 'done', title: 'Done' }
];

function KanbanBoard() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {columns.map((column) => (
        <section key={column.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-lg">
          <h2 className="text-lg font-semibold">{column.title}</h2>
          <div className="mt-4 space-y-3">
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
              <p className="font-medium">Sample task</p>
              <p className="mt-1 text-sm text-slate-400">This placeholder card will later support drag and drop.</p>
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}

export default KanbanBoard;
