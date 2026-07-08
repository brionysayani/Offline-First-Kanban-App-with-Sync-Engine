import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

const router = Router();
const prisma = new PrismaClient();

const normalizeEmail = (email: unknown): string => (typeof email === 'string' ? email.trim().toLowerCase() : '');

const signToken = (user: { id: string; email: string }) =>
  jwt.sign({ id: user.id, email: user.email }, env.jwtSecret, { expiresIn: '7d' });

router.post('/register', async (req: Request, res: Response) => {
  const body = req.body as { email?: string; password?: string };
  const email = normalizeEmail(body.email);
  const password = body.password ?? '';

  if (!email || password.length < 8) {
    res.status(400).json({ error: 'Email and a password of at least 8 characters are required' });
    return;
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });

  if (existingUser) {
    res.status(409).json({ error: 'An account with this email already exists' });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: {
      email,
      password: passwordHash
    }
  });

  res.status(201).json({
    token: signToken(user),
    user: { id: user.id, email: user.email }
  });
});

router.post('/login', async (req: Request, res: Response) => {
  const body = req.body as { email?: string; password?: string };
  const email = normalizeEmail(body.email);
  const password = body.password ?? '';
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !(await bcrypt.compare(password, user.password))) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  res.json({
    token: signToken(user),
    user: { id: user.id, email: user.email }
  });
});

export default router;
