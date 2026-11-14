import { Router } from 'express';
import { z } from 'zod';

import { TRANSACTION_TYPES } from '../../db/schema.js';
import { booleanQuery, cents, dateString, idParam, parse } from '../../lib/validation.js';
import { currentUserId } from '../../middlewares/auth.js';
import * as service from './transactions.service.js';

const transactionSchema = z
  .object({
    type: z.enum(TRANSACTION_TYPES),
    amountCents: cents,
    description: z.string().trim().min(1).max(140),
    date: dateString,
    accountId: z.number().int().positive(),
    categoryId: z.number().int().positive().nullable().optional(),
    paid: z.boolean().optional(),
    notes: z.string().max(1000).optional(),
    installments: z.number().int().min(1).max(48).optional(),
  })
  .strict();

const updateSchema = transactionSchema.omit({ installments: true }).partial();

const filterSchema = z
  .object({
    from: dateString.optional(),
    to: dateString.optional(),
    accountId: z.coerce.number().int().positive().optional(),
    categoryId: z.coerce.number().int().positive().optional(),
    uncategorized: booleanQuery.optional(),
    type: z.enum(TRANSACTION_TYPES).optional(),
    paid: booleanQuery.optional(),
    search: z.string().trim().max(100).optional(),
    includeTransfers: booleanQuery.optional(),
  })
  .refine((f) => !f.from || !f.to || f.from <= f.to, { message: 'A data inicial deve ser antes da final.', path: ['to'] });

const listSchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    sort: z.enum(['date', '-date', 'amount', '-amount']).default('-date'),
  })
  .passthrough();

const transferSchema = z
  .object({
    fromAccountId: z.number().int().positive(),
    toAccountId: z.number().int().positive(),
    amountCents: cents,
    date: dateString,
    description: z.string().trim().max(140).optional(),
    paid: z.boolean().optional(),
  })
  .strict();

export const transactionsRouter = Router();

transactionsRouter.get('/', async (req, res) => {
  const filters = parse(filterSchema, req.query);
  const paging = parse(listSchema, req.query);
  res.json(
    await service.listTransactions(currentUserId(res), {
      ...filters,
      page: paging.page,
      pageSize: paging.pageSize,
      sort: paging.sort,
    }),
  );
});

// Precisa vir antes de "/:id" para não ser confundida com um ID.
transactionsRouter.get('/export', async (req, res) => {
  const filters = parse(filterSchema, req.query);
  const csv = await service.exportCsv(currentUserId(res), filters);
  const suffix = [filters.from, filters.to].filter(Boolean).join('_a_') || 'todos';
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="lancamentos_${suffix}.csv"`);
  res.send(csv);
});

transactionsRouter.post('/', async (req, res) => {
  res.status(201).json(await service.createTransaction(currentUserId(res), parse(transactionSchema, req.body)));
});

transactionsRouter.get('/:id', async (req, res) => {
  const { id } = parse(idParam, req.params);
  res.json(await service.getTransaction(currentUserId(res), id));
});

transactionsRouter.patch('/:id', async (req, res) => {
  const { id } = parse(idParam, req.params);
  res.json(await service.updateTransaction(currentUserId(res), id, parse(updateSchema, req.body)));
});

transactionsRouter.delete('/:id', async (req, res) => {
  const { id } = parse(idParam, req.params);
  const { scope } = parse(z.object({ scope: z.enum(['one', 'future', 'all']).default('one') }), req.query);
  const deleted = await service.deleteTransaction(currentUserId(res), id, scope);
  res.setHeader('X-Deleted-Count', String(deleted));
  res.status(204).end();
});

export const transfersRouter = Router();

transfersRouter.post('/', async (req, res) => {
  res.status(201).json(await service.createTransfer(currentUserId(res), parse(transferSchema, req.body)));
});
