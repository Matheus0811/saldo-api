import { Router } from 'express';
import { z } from 'zod';

import { TRANSACTION_TYPES } from '../../db/schema.js';
import { currentMonth, monthRange } from '../../lib/dates.js';
import { dateString, monthString, parse } from '../../lib/validation.js';
import { currentUserId } from '../../middlewares/auth.js';
import * as service from './reports.service.js';

export const reportsRouter = Router();

reportsRouter.get('/summary', async (req, res) => {
  const { month } = parse(z.object({ month: monthString.optional() }), req.query);
  res.json(await service.monthlySummary(currentUserId(res), month ?? currentMonth()));
});

reportsRouter.get('/by-category', async (req, res) => {
  const query = parse(
    z.object({
      from: dateString.optional(),
      to: dateString.optional(),
      type: z.enum(TRANSACTION_TYPES).default('expense'),
    }),
    req.query,
  );
  const range = monthRange(currentMonth());
  res.json(
    await service.byCategory(currentUserId(res), {
      from: query.from ?? range.from,
      to: query.to ?? range.to,
      type: query.type,
    }),
  );
});

reportsRouter.get('/cash-flow', async (req, res) => {
  const { months, until } = parse(
    z.object({
      months: z.coerce.number().int().min(1).max(36).default(12),
      until: monthString.optional(),
    }),
    req.query,
  );
  res.json(await service.cashFlow(currentUserId(res), { months, until: until ?? currentMonth() }));
});
