import Dexie, { Table } from 'dexie';

export interface LocalTask {
  id: string;
  title: string;
  status: string;
  updatedAt: string;
}

export class OfflineKanbanDb extends Dexie {
  tasks!: Table<LocalTask, string>;

  constructor() {
    super('offline-kanban-db');
    this.version(1).stores({
      tasks: 'id, status, updatedAt'
    });
  }
}

export const db = new OfflineKanbanDb();
