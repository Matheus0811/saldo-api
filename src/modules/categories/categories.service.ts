import { and, asc, eq, sql } from 'drizzle-orm';

import { getDb } from '../../db/client.js';
import { categories, transactions, type Category, type CategoryType } from '../../db/schema.js';
import { conflict, notFound } from '../../lib/errors.js';

export interface CategoryInput {
  name: string;
  type: CategoryType;
  color?: string;
  icon?: string;
}

export async function getOwnedCategory(userId: number, id: number): Promise<Category> {
  const [category] = await getDb()
    .select()
    .from(categories)
    .where(and(eq(categories.id, id), eq(categories.userId, userId)))
    .limit(1);
  if (!category) throw notFound('Categoria não encontrada.');
  return category;
}

export async function listCategories(userId: number, type?: CategoryType): Promise<Category[]> {
  const conditions = [eq(categories.userId, userId)];
  if (type) conditions.push(eq(categories.type, type));
  return getDb()
    .select()
    .from(categories)
    .where(and(...conditions))
    .orderBy(asc(categories.type), asc(categories.name));
}

async function ensureUniqueName(userId: number, name: string, type: CategoryType, ignoreId?: number) {
  const [existing] = await getDb()
    .select({ id: categories.id })
    .from(categories)
    .where(
      and(eq(categories.userId, userId), eq(categories.type, type), sql`lower(${categories.name}) = lower(${name})`),
    )
    .limit(1);
  if (existing && existing.id !== ignoreId) throw conflict(`Você já tem a categoria "${name}".`);
}

export async function createCategory(userId: number, input: CategoryInput): Promise<Category> {
  await ensureUniqueName(userId, input.name, input.type);
  const [category] = await getDb()
    .insert(categories)
    .values({ userId, ...input })
    .returning();
  return category;
}

export async function updateCategory(userId: number, id: number, input: Partial<CategoryInput>): Promise<Category> {
  const current = await getOwnedCategory(userId, id);
  if (input.type && input.type !== current.type) {
    const [{ total }] = await getDb()
      .select({ total: sql<number>`count(*)`.mapWith(Number) })
      .from(transactions)
      .where(eq(transactions.categoryId, id));
    if (total > 0) throw conflict('Não é possível mudar o tipo de uma categoria que já tem lançamentos.');
  }
  if (input.name || input.type) {
    await ensureUniqueName(userId, input.name ?? current.name, input.type ?? current.type, id);
  }
  if (!Object.keys(input).length) return current;
  const [category] = await getDb().update(categories).set(input).where(eq(categories.id, id)).returning();
  return category;
}

export async function deleteCategory(userId: number, id: number): Promise<void> {
  await getOwnedCategory(userId, id);
  const [{ total }] = await getDb()
    .select({ total: sql<number>`count(*)`.mapWith(Number) })
    .from(transactions)
    .where(eq(transactions.categoryId, id));
  if (total > 0) {
    throw conflict(`Esta categoria tem ${total} lançamento(s). Mova os lançamentos para outra categoria antes de excluir.`);
  }
  await getDb().delete(categories).where(eq(categories.id, id));
}
