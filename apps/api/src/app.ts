import express, { NextFunction, Request, Response } from 'express';
import authRoutes from './routes/auth.routes';
import boardsRoutes from './routes/boards.routes';
import syncRoutes from './routes/sync.routes';

const app = express();

app.use(express.json());

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'offline-first-kanban-api' });
});

app.use('/api/auth', authRoutes);
app.use('/api/boards', boardsRoutes);
app.use('/api/sync', syncRoutes);

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

export default app;
