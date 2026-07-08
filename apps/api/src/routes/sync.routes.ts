import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

router.post('/pull', authMiddleware, (_req: AuthRequest, res: Response) => {
  res.json({ changes: [], syncedAt: new Date().toISOString() });
});

router.post('/push', authMiddleware, (_req: AuthRequest, res: Response) => {
  res.json({ accepted: true, message: 'Sync push endpoint scaffolded' });
});

export default router;
