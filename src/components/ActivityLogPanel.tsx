import { useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import type { ActivityEvent } from '../../packages/shared';

type ActivityLogPanelProps = {
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

const eventBelongsToBoard = (event: ActivityEvent, boardId: string): boolean => {
  if (event.entityType === 'board') {
    return event.entityId === boardId;
  }

  return getBoardId(event.metadata) === boardId;
};

function ActivityLogPanel({ boardId }: ActivityLogPanelProps) {
  const activityEvents = useAppStore((state) => state.activityEvents);
  const visibleEvents = useMemo(
    () => activityEvents.filter((event) => eventBelongsToBoard(event, boardId)).slice(0, 12),
    [activityEvents, boardId]
  );

  return (
    <section className="rounded-md border border-slate-800 bg-slate-900 p-4 shadow-lg">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold">Activity</h2>
        <span className="rounded-full border border-slate-700 px-2 py-0.5 text-xs text-slate-400">
          {visibleEvents.length}
        </span>
      </div>

      {visibleEvents.length === 0 ? (
        <div className="mt-4 rounded-md border border-dashed border-slate-700 p-4 text-sm text-slate-500">
          No activity yet.
        </div>
      ) : (
        <ol className="mt-4 space-y-3">
          {visibleEvents.map((event) => (
            <li key={event.id} className="rounded-md border border-slate-800 bg-slate-950 p-3">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium leading-5 text-slate-200">{event.message}</p>
                <span className="shrink-0 rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-400">
                  {event.type}
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-500">{new Date(event.createdAt).toLocaleString()}</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export default ActivityLogPanel;
