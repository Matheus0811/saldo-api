import { and, asc, eq } from 'drizzle-orm';

import { getDb } from '../../db/client.js';
import { goals, type Goal } from '../../db/schema.js';
import { monthsBetween, today } from '../../lib/dates.js';
import { notFound, unprocessable } from '../../lib/errors.js';
import { percent } from '../../lib/money.js';

export interface GoalInput {
  name: string;
  targetCents: number;
  savedCents?: number;
  deadline?: string | null;
  color?: string;
}

/** Acrescenta progresso, quanto falta e quanto guardar por mês para bater a meta no prazo. */
export function withProgress(goal: Goal, referenceDate = today()) {
  const remainingCents = Math.max(0, goal.targetCents - goal.savedCents);
  const monthsLeft = goal.deadline ? Math.max(0, monthsBetween(referenceDate.slice(0, 7), goal.deadline.slice(0, 7))) : null;
  const monthlyNeededCents =
    remainingCents === 0 ? 0 : monthsLeft === null ? null : Math.ceil(remainingCents / Math.max(1, monthsLeft));
  return {
    ...goal,
    progress: Math.min(100, percent(goal.savedCents, goal.targetCents) ?? 0),
    remainingCents,
    completed: remainingCents === 0,
    monthsLeft,
    monthlyNeededCents,
  };
}

async function getOwnedGoal(userId: number, id: number): Promise<Goal> {
  const [goal] = await getDb()
    .select()
    .from(goals)
    .where(and(eq(goals.id, id), eq(goals.userId, userId)))
    .limit(1);
  if (!goal) throw notFound('Meta não encontrada.');
  return goal;
}

export async function listGoals(userId: number) {
  const rows = await getDb().select().from(goals).where(eq(goals.userId, userId)).orderBy(asc(goals.createdAt));
  return rows.map((goal) => withProgress(goal));
}

export async function createGoal(userId: number, input: GoalInput) {
  const [goal] = await getDb()
    .insert(goals)
    .values({ userId, ...input })
    .returning();
  return withProgress(goal);
}

export async function updateGoal(userId: number, id: number, input: Partial<GoalInput>) {
  const current = await getOwnedGoal(userId, id);
  if (!Object.keys(input).length) return withProgress(current);
  const [goal] = await getDb().update(goals).set(input).where(eq(goals.id, id)).returning();
  return withProgress(goal);
}

/** Guarda (valor positivo) ou retira (valor negativo) dinheiro da meta. */
export async function deposit(userId: number, id: number, amountCents: number) {
  const goal = await getOwnedGoal(userId, id);
  const savedCents = goal.savedCents + amountCents;
  if (savedCents < 0) {
    throw unprocessable('Não dá para retirar mais do que está guardado na meta.', [
      { field: 'amountCents', message: `O máximo para retirar é ${goal.savedCents} centavos.` },
    ]);
  }
  const [updated] = await getDb().update(goals).set({ savedCents }).where(eq(goals.id, id)).returning();
  return withProgress(updated);
}

export async function deleteGoal(userId: number, id: number) {
  await getOwnedGoal(userId, id);
  await getDb().delete(goals).where(eq(goals.id, id));
}
