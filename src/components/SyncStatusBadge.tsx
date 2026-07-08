type SyncStatusBadgeProps = {
  status: 'idle' | 'syncing' | 'error';
};

function SyncStatusBadge({ status }: SyncStatusBadgeProps) {
  const label = status === 'syncing' ? 'Syncing…' : status === 'error' ? 'Sync error' : 'Up to date';
  const tone = status === 'error' ? 'text-rose-400' : status === 'syncing' ? 'text-amber-400' : 'text-emerald-400';

  return <span className={`rounded-full border border-slate-700 px-3 py-1 text-sm ${tone}`}>{label}</span>;
}

export default SyncStatusBadge;
