import { Router } from 'express';
import { z } from 'zod';

import { ACCOUNT_TYPES } from '../../db/schema.js';
import { booleanQuery, hexColor, idParam, parse } from '../../lib/validation.js';
import { currentUserId } from '../../middlewares/auth.js';
import * as service from './accounts.service.js';

const accountSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    type: z.enum(ACCOUNT_TYPES),
    initialBalanceCents: z.number().int().min(-1_000_000_000).max(1_000_000_000).optional(),
    color: hexColor.optional(),
    archived: z.boolean().optional(),
  })
  .strict();

export const accountsRouter = Router();

accountsRouter.get('/', async (req, res) => {
  const { includeArchived } = parse(z.object({ includeArchived: booleanQuery.optional() }), req.query);
  res.json(await service.listAccounts(currentUserId(res), includeArchived ?? false));
});

accountsRouter.post('/', async (req, res) => {
  res.status(201).json(await service.createAccount(currentUserId(res), parse(accountSchema, req.body)));
});

accountsRouter.get('/:id', async (req, res) => {
  const { id } = parse(idParam, req.params);
  res.json(await service.getAccount(currentUserId(res), id));
});

accountsRouter.patch('/:id', async (req, res) => {
  const { id } = parse(idParam, req.params);
  res.json(await service.updateAccount(currentUserId(res), id, parse(accountSchema.partial(), req.body)));
});

accountsRouter.delete('/:id', async (req, res) => {
  const { id } = parse(idParam, req.params);
  await service.deleteAccount(currentUserId(res), id);
  res.status(204).end();
});
