import { Router } from 'express';
import { z } from 'zod';

import { parse } from '../../lib/validation.js';
import { currentUserId, requireAuth } from '../../middlewares/auth.js';
import { authRateLimit } from '../../middlewares/rate-limit.js';
import * as service from './auth.service.js';

const registerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(255),
  password: z.string().min(6).max(72),
});

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1).max(72),
});

const refreshSchema = z.object({ refreshToken: z.string().min(20) });

export const authRouter = Router();

authRouter.post('/register', authRateLimit, async (req, res) => {
  res.status(201).json(await service.register(parse(registerSchema, req.body)));
});

authRouter.post('/login', authRateLimit, async (req, res) => {
  res.json(await service.login(parse(loginSchema, req.body)));
});

authRouter.post('/refresh', async (req, res) => {
  res.json(await service.refresh(parse(refreshSchema, req.body).refreshToken));
});

authRouter.post('/logout', async (req, res) => {
  await service.logout(parse(refreshSchema, req.body).refreshToken);
  res.status(204).end();
});

authRouter.get('/me', requireAuth, async (_req, res) => {
  res.json(await service.getUser(currentUserId(res)));
});
