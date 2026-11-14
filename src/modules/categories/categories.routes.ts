import { Router } from 'express';
import { z } from 'zod';

import { CATEGORY_TYPES } from '../../db/schema.js';
import { hexColor, idParam, parse } from '../../lib/validation.js';
import { currentUserId } from '../../middlewares/auth.js';
import * as service from './categories.service.js';

const categorySchema = z
  .object({
    name: z.string().trim().min(1).max(60),
    type: z.enum(CATEGORY_TYPES),
    color: hexColor.optional(),
    icon: z
      .string()
      .trim()
      .regex(/^[a-z0-9-]{1,40}$/, 'Use o nome de um ícone, ex.: shopping-cart.')
      .optional(),
  })
  .strict();

export const categoriesRouter = Router();

categoriesRouter.get('/', async (req, res) => {
  const { type } = parse(z.object({ type: z.enum(CATEGORY_TYPES).optional() }), req.query);
  res.json(await service.listCategories(currentUserId(res), type));
});

categoriesRouter.post('/', async (req, res) => {
  res.status(201).json(await service.createCategory(currentUserId(res), parse(categorySchema, req.body)));
});

categoriesRouter.patch('/:id', async (req, res) => {
  const { id } = parse(idParam, req.params);
  res.json(await service.updateCategory(currentUserId(res), id, parse(categorySchema.partial(), req.body)));
});

categoriesRouter.delete('/:id', async (req, res) => {
  const { id } = parse(idParam, req.params);
  await service.deleteCategory(currentUserId(res), id);
  res.status(204).end();
});
