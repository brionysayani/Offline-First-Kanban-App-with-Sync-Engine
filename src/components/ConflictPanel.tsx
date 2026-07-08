import { useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import type { ConflictRecord } from '../../packages/shared';

type ConflictPanelProps = {
  boardId: string;
};

const hasBoardId = (value: unknown): value is { boardId: string } =>
  Boolean(value && typeof value === 'object' && typeof (value as { boardId?: unknown }).boardId === 'string');

const getBoardId = (value: unknown): string | undefined => {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const record = value as Record<string, unknown>;

  if (hasBoardId(record)) {
    return record.boardId;
  }

  return Object.values(record).find(hasBoardId)?.boardId;
};

const conflictBelongsToBoard = (conflict: ConflictRecord, boardId: string): boolean => {
  if (conflict.entityType === 'board') {
    return conflict.entityId === boardId;
  }

  return getBoardId(conflict.localValue) === boardId;
};

function ConflictPanel({ boardId }: ConflictPanelProps) {
  const conflicts = useAppStore((state) => state.conflicts);
  const boardConflicts = useMemo(
    () => conflicts.filter((conflict) => conflictBelongsToBoard(conflict, boardId)),
    [boardId, conflicts]
  );

  return (
    <section className="rounded-md border border-slate-800 bg-slate-900 p-4 shadow-lg">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold">Conflicts</h2>
        <span className="rounded-full border border-slate-700 px-2 py-0.5 text-xs text-slate-400">
          {boardConflicts.length}
        </span>
      </div>

      {boardConflicts.length === 0 ? (
        <div className="mt-4 rounded-md border border-dashed border-slate-700 p-4 text-sm text-slate-500">
          No conflicts.
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {boardConflicts.map((conflict) => (
            <article key={conflict.id} className="rounded-md border border-rose-500/30 bg-rose-500/10 p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-rose-200">{conflict.entityType}</p>
                <p className="text-xs text-rose-300">v{conflict.baseVersion}</p>
              </div>
              <p className="mt-2 text-sm leading-5 text-slate-300">{conflict.message}</p>
              <p className="mt-3 break-all text-xs text-slate-500">{conflict.entityId}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export default ConflictPanel;
