import type { SyncStatus } from '../../packages/shared';

type SyncStatusBadgeProps = {
  status: SyncStatus;
  pendingCount: number;
};

const statusLabel: Record<SyncStatus, string> = {
  online: 'Online',
  offline: 'Offline',
  syncing: 'Syncing',
  synced: 'Synced',
  conflict: 'Conflict'
};

function SyncStatusBadge({ status, pendingCount }: SyncStatusBadgeProps) {
  const tone =
    status === 'conflict'
      ? 'border-rose-500/40 text-rose-300'
      : status === 'offline'
        ? 'border-amber-500/40 text-amber-300'
        : status === 'syncing'
          ? 'border-cyan-500/40 text-cyan-300'
          : 'border-emerald-500/40 text-emerald-300';

  return (
    <span className={`rounded-full border px-3 py-1 text-sm ${tone}`}>
      {statusLabel[status]} / {pendingCount} pending
    </span>
  );
}

export default SyncStatusBadge;
