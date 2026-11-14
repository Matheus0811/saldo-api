import { and, asc, eq, gte, lte, sql } from 'drizzle-orm';

import { getDb } from '../../db/client.js';
import { budgets, categories, transactions } from '../../db/schema.js';
import { monthRange } from '../../lib/dates.js';
import { conflict, notFound, unprocessable } from '../../lib/errors.js';
import { percent } from '../../lib/money.js';
import { getOwnedCategory } from '../categories/categories.service.js';

export type BudgetStatus = 'ok' | 'warning' | 'exceeded';

/** A partir de 80% do limite o orçamento entra em alerta; acima de 100%, estourado. */
export const WARNING_THRESHOLD = 0.8;

export function budgetStatus(spentCents: number, limitCents: number): BudgetStatus {
  if (spentCents > limitCents) return 'exceeded';
  if (spentCents >= limitCents * WARNING_THRESHOLD) return 'warning';
  return 'ok';
}

async function getOwnedBudget(userId: number, id: number) {
  const [budget] = await getDb()
    .select()
    .from(budgets)
    .where(and(eq(budgets.id, id), eq(budgets.userId, userId)))
    .limit(1);
  if (!budget) throw notFound('Orçamento não encontrado.');
  return budget;
}

/** Orçamentos do mês com quanto já foi gasto em cada categoria. */
export async function listBudgets(userId: number, month: string) {
  const { from, to } = monthRange(month);
  const db = getDb();

  const rows = await db
    .select({
      id: budgets.id,
      amountCents: budgets.amountCents,
      categoryId: categories.id,
      categoryName: categories.name,
      categoryColor: categories.color,
      categoryIcon: categories.icon,
    })
    .from(budgets)
    .innerJoin(categories, eq(budgets.categoryId, categories.id))
    .where(eq(budgets.userId, userId))
    .orderBy(asc(categories.name));

  const spentRows = await db
    .select({
      categoryId: transactions.categoryId,
      spentCents: sql<number>`coalesce(sum(${transactions.amountCents}), 0)`.mapWith(Number),
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.type, 'expense'),
        eq(transactions.isTransfer, false),
        gte(transactions.date, from),
        lte(transactions.date, to),
      ),
    )
    .groupBy(transactions.categoryId);
  const spentByCategory = new Map(spentRows.map((row) => [row.categoryId, row.spentCents]));

  const items = rows.map((row) => {
    const spentCents = spentByCategory.get(row.categoryId) ?? 0;
    return {
      id: row.id,
      category: { id: row.categoryId, name: row.categoryName, color: row.categoryColor, icon: row.categoryIcon },
      limitCents: row.amountCents,
      spentCents,
      remainingCents: row.amountCents - spentCents,
      percentUsed: percent(spentCents, row.amountCents) ?? 0,
      status: budgetStatus(spentCents, row.amountCents),
    };
  });

  const totalLimitCents = items.reduce((sum, item) => sum + item.limitCents, 0);
  const totalSpentCents = items.reduce((sum, item) => sum + item.spentCents, 0);
  return {
    month,
    totalLimitCents,
    totalSpentCents,
    percentUsed: percent(totalSpentCents, totalLimitCents) ?? 0,
    alerts: items.filter((item) => item.status !== 'ok').length,
    budgets: items,
  };
}

export async function createBudget(userId: number, input: { categoryId: number; amountCents: number }) {
  const category = await getOwnedCategory(userId, input.categoryId);
  if (category.type !== 'expense') {
    throw unprocessable('Orçamentos só podem ser criados para categorias de despesa.', [
      { field: 'categoryId', message: 'Escolha uma categoria de despesa.' },
    ]);
  }
  const [existing] = await getDb()
    .select({ id: budgets.id })
    .from(budgets)
    .where(and(eq(budgets.userId, userId), eq(budgets.categoryId, input.categoryId)))
    .limit(1);
  if (existing) throw conflict(`Já existe um orçamento para "${category.name}". Edite o existente.`);

  const [budget] = await getDb()
    .insert(budgets)
    .values({ userId, ...input })
    .returning();
  return budget;
}

export async function updateBudget(userId: number, id: number, amountCents: number) {
  await getOwnedBudget(userId, id);
  const [budget] = await getDb().update(budgets).set({ amountCents }).where(eq(budgets.id, id)).returning();
  return budget;
}

export async function deleteBudget(userId: number, id: number) {
  await getOwnedBudget(userId, id);
  await getDb().delete(budgets).where(eq(budgets.id, id));
}
