import { Router } from 'express';
import { z } from 'zod';

import { currentMonth } from '../../lib/dates.js';
import { cents, idParam, monthString, parse } from '../../lib/validation.js';
import { currentUserId } from '../../middlewares/auth.js';
import * as service from './budgets.service.js';

export const budgetsRouter = Router();

budgetsRouter.get('/', async (req, res) => {
  const { month } = parse(z.object({ month: monthString.optional() }), req.query);
  res.json(await service.listBudgets(currentUserId(res), month ?? currentMonth()));
});

budgetsRouter.post('/', async (req, res) => {
  const input = parse(z.object({ categoryId: z.number().int().positive(), amountCents: cents }).strict(), req.body);
  res.status(201).json(await service.createBudget(currentUserId(res), input));
});

budgetsRouter.patch('/:id', async (req, res) => {
  const { id } = parse(idParam, req.params);
  const { amountCents } = parse(z.object({ amountCents: cents }).strict(), req.body);
  res.json(await service.updateBudget(currentUserId(res), id, amountCents));
});

budgetsRouter.delete('/:id', async (req, res) => {
  const { id } = parse(idParam, req.params);
  await service.deleteBudget(currentUserId(res), id);
  res.status(204).end();
});
