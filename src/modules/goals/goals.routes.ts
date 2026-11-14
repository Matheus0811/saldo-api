import { Router } from 'express';
import { z } from 'zod';

import { cents, dateString, hexColor, idParam, parse } from '../../lib/validation.js';
import { currentUserId } from '../../middlewares/auth.js';
import * as service from './goals.service.js';

const goalSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    targetCents: cents,
    savedCents: z.number().int().min(0).max(1_000_000_000).optional(),
    deadline: dateString.nullable().optional(),
    color: hexColor.optional(),
  })
  .strict();

export const goalsRouter = Router();

goalsRouter.get('/', async (_req, res) => {
  res.json(await service.listGoals(currentUserId(res)));
});

goalsRouter.post('/', async (req, res) => {
  res.status(201).json(await service.createGoal(currentUserId(res), parse(goalSchema, req.body)));
});

goalsRouter.patch('/:id', async (req, res) => {
  const { id } = parse(idParam, req.params);
  res.json(await service.updateGoal(currentUserId(res), id, parse(goalSchema.partial(), req.body)));
});

goalsRouter.post('/:id/deposits', async (req, res) => {
  const { id } = parse(idParam, req.params);
  const { amountCents } = parse(
    z
      .object({
        amountCents: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .refine((value) => value !== 0, 'O valor não pode ser zero.'),
      })
      .strict(),
    req.body,
  );
  res.json(await service.deposit(currentUserId(res), id, amountCents));
});

goalsRouter.delete('/:id', async (req, res) => {
  const { id } = parse(idParam, req.params);
  await service.deleteGoal(currentUserId(res), id);
  res.status(204).end();
});
