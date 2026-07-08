import { FormEvent, useMemo, useState } from 'react';
import { DndContext, DragEndEvent, PointerSensor, useDraggable, useDroppable, useSensor, useSensors } from '@dnd-kit/core';
import { useAppStore } from '../store/useAppStore';
import type { LocalCard, LocalColumn } from '../../packages/shared';

type KanbanBoardProps = {
  boardId: string;
};

type CardComposerState = {
  columnId?: string;
  title: string;
};

const sortByPosition = <T extends { position: number; updatedAt: string }>(items: T[]) =>
  [...items].sort((first, second) => first.position - second.position || first.updatedAt.localeCompare(second.updatedAt));

const getDropPosition = (targetColumnCards: LocalCard[], movingCardId: string, overId: string): number => {
  const cards = targetColumnCards.filter((card) => card.id !== movingCardId);

  if (overId.startsWith('card:')) {
    const targetCardId = overId.replace('card:', '');
    const targetIndex = Math.max(
      cards.findIndex((card) => card.id === targetCardId),
      0
    );
    const previous = cards[targetIndex - 1];
    const target = cards[targetIndex];

    if (!target) {
      return previous ? previous.position + 1 : 0;
    }

    return previous ? (previous.position + target.position) / 2 : target.position - 1;
  }

  const lastCard = cards[cards.length - 1];
  return lastCard ? lastCard.position + 1 : 0;
};

function DraggableCard({ card }: { card: LocalCard }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: card.id });
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: `card:${card.id}` });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;

  return (
    <div ref={setDropRef}>
      <article
        ref={setNodeRef}
        style={style}
        {...listeners}
        {...attributes}
        className={`cursor-grab rounded-md border bg-slate-950 p-3 text-left shadow-sm transition active:cursor-grabbing ${
          isDragging
            ? 'z-20 border-cyan-400 opacity-80'
            : isOver
              ? 'border-cyan-500/70'
              : 'border-slate-800 hover:border-slate-600'
        }`}
      >
        <h3 className="text-sm font-semibold leading-5 text-slate-100">{card.title}</h3>
        {card.description ? <p className="mt-2 text-sm leading-5 text-slate-400">{card.description}</p> : null}
      </article>
    </div>
  );
}

function ColumnLane({
  column,
  cards,
  activeComposer,
  setActiveComposer,
  onCreateCard
}: {
  column: LocalColumn;
  cards: LocalCard[];
  activeComposer: CardComposerState;
  setActiveComposer: (value: CardComposerState) => void;
  onCreateCard: (event: FormEvent<HTMLFormElement>, columnId: string) => Promise<void>;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const isAddingCard = activeComposer.columnId === column.id;

  return (
    <section
      ref={setNodeRef}
      className={`flex min-h-[28rem] flex-col rounded-md border bg-slate-900 transition ${
        isOver ? 'border-cyan-500' : 'border-slate-800'
      }`}
    >
      <div className="flex min-h-14 items-center justify-between border-b border-slate-800 px-4">
        <div>
          <h2 className="font-semibold">{column.title}</h2>
          <p className="text-xs text-slate-500">{cards.length} cards</p>
        </div>
      </div>

      <div className="flex-1 space-y-3 p-3">
        {cards.map((card) => (
          <DraggableCard key={card.id} card={card} />
        ))}
      </div>

      <div className="border-t border-slate-800 p-3">
        {isAddingCard ? (
          <form onSubmit={(event) => void onCreateCard(event, column.id)} className="space-y-2">
            <input
              autoFocus
              value={activeComposer.title}
              onChange={(event) => setActiveComposer({ columnId: column.id, title: event.target.value })}
              placeholder="Card title"
              className="min-h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 outline-none focus:border-cyan-500"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                className="rounded-md bg-cyan-500 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => setActiveComposer({ title: '' })}
                className="rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:border-slate-500"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setActiveComposer({ columnId: column.id, title: '' })}
            className="min-h-10 w-full rounded-md border border-dashed border-slate-700 text-sm text-slate-400 transition hover:border-cyan-500 hover:text-cyan-300"
          >
            Add card
          </button>
        )}
      </div>
    </section>
  );
}

function KanbanBoard({ boardId }: KanbanBoardProps) {
  const [columnTitle, setColumnTitle] = useState('');
  const [activeComposer, setActiveComposer] = useState<CardComposerState>({ title: '' });
  const { columns, cards, createColumn, createCard, moveCard } = useAppStore();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const boardColumns = useMemo(
    () => sortByPosition(columns.filter((column) => column.boardId === boardId)),
    [boardId, columns]
  );
  const boardCards = useMemo(() => sortByPosition(cards.filter((card) => card.boardId === boardId)), [boardId, cards]);

  const cardsByColumn = useMemo(
    () =>
      boardColumns.reduce<Record<string, LocalCard[]>>((grouped, column) => {
        grouped[column.id] = boardCards.filter((card) => card.columnId === column.id);
        return grouped;
      }, {}),
    [boardCards, boardColumns]
  );

  const handleCreateColumn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextTitle = columnTitle.trim();

    if (!nextTitle) {
      return;
    }

    await createColumn(boardId, nextTitle, boardColumns.length);
    setColumnTitle('');
  };

  const handleCreateCard = async (event: FormEvent<HTMLFormElement>, columnId: string) => {
    event.preventDefault();
    const nextTitle = activeComposer.title.trim();

    if (!nextTitle) {
      return;
    }

    await createCard(columnId, { title: nextTitle, position: cardsByColumn[columnId]?.length ?? 0 });
    setActiveComposer({ title: '' });
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const activeCardId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : undefined;

    if (!overId) {
      return;
    }

    const movingCard = boardCards.find((card) => card.id === activeCardId);
    if (!movingCard) {
      return;
    }

    const targetColumnId = overId.startsWith('card:')
      ? boardCards.find((card) => card.id === overId.replace('card:', ''))?.columnId
      : overId;

    if (!targetColumnId || !boardColumns.some((column) => column.id === targetColumnId)) {
      return;
    }

    const position = getDropPosition(cardsByColumn[targetColumnId] ?? [], activeCardId, overId);
    await moveCard(activeCardId, targetColumnId, position);
  };

  return (
    <section className="min-w-0">
      <form onSubmit={handleCreateColumn} className="mb-4 flex flex-col gap-3 sm:flex-row">
        <input
          value={columnTitle}
          onChange={(event) => setColumnTitle(event.target.value)}
          placeholder="New column name"
          className="min-h-11 flex-1 rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-500"
        />
        <button
          type="submit"
          className="min-h-11 rounded-md bg-cyan-500 px-4 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
        >
          Create column
        </button>
      </form>

      {boardColumns.length === 0 ? (
        <div className="rounded-md border border-dashed border-slate-700 p-8 text-center text-sm text-slate-400">
          Create a column to add cards.
        </div>
      ) : (
        <DndContext sensors={sensors} onDragEnd={(event) => void handleDragEnd(event)}>
          <div className="grid gap-4 lg:grid-cols-3 2xl:grid-cols-4">
            {boardColumns.map((column) => (
              <ColumnLane
                key={column.id}
                column={column}
                cards={cardsByColumn[column.id] ?? []}
                activeComposer={activeComposer}
                setActiveComposer={setActiveComposer}
                onCreateCard={handleCreateCard}
              />
            ))}
          </div>
        </DndContext>
      )}
    </section>
  );
}

export default KanbanBoard;
