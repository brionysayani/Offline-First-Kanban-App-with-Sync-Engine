import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

const router = Router();

router.post('/register', async (_req: Request, res: Response) => {
  const passwordHash = await bcrypt.hash('placeholder-password', 10);
  res.status(201).json({
    message: 'Registration endpoint scaffolded',
    passwordHash
  });
});

router.post('/login', async (_req: Request, res: Response) => {
  const token = jwt.sign({ id: 'user-placeholder', email: 'demo@example.com' }, env.jwtSecret, { expiresIn: '1h' });
  res.json({ token, message: 'Login endpoint scaffolded' });
});

export default router;
