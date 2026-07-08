function ConflictPanel() {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-lg">
      <h2 className="text-lg font-semibold">Conflict resolution</h2>
      <p className="mt-2 text-sm text-slate-400">
        Pending merge decisions and local-vs-remote changes will appear here.
      </p>
      <div className="mt-4 rounded-lg border border-dashed border-slate-700 p-4 text-sm text-slate-500">
        No conflicts detected yet.
      </div>
    </div>
  );
}

export default ConflictPanel;
