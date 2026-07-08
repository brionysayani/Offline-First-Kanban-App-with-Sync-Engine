import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/', authMiddleware, (_req: AuthRequest, res: Response) => {
  res.json({ boards: [] });
});

router.post('/', authMiddleware, (_req: AuthRequest, res: Response) => {
  res.status(201).json({ message: 'Board creation endpoint scaffolded' });
});

export default router;
