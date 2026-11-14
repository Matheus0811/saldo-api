import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';

import { getDb } from '../../db/client.js';
import { categories, transactions, type TransactionType } from '../../db/schema.js';
import { monthRange, shiftMonth } from '../../lib/dates.js';
import { percent } from '../../lib/money.js';
import { listAccounts } from '../accounts/accounts.service.js';

const income = sql<number>`coalesce(sum(case when ${transactions.type} = 'income' then ${transactions.amountCents} else 0 end), 0)`.mapWith(
  Number,
);
const expense = sql<number>`coalesce(sum(case when ${transactions.type} = 'expense' then ${transactions.amountCents} else 0 end), 0)`.mapWith(
  Number,
);

/** Movimentação real do período: transferências entre contas não contam como receita nem despesa. */
const realMovement = (userId: number, from: string, to: string) =>
  and(
    eq(transactions.userId, userId),
    eq(transactions.isTransfer, false),
    gte(transactions.date, from),
    lte(transactions.date, to),
  );

async function totalsForMonth(userId: number, month: string) {
  const { from, to } = monthRange(month);
  const [row] = await getDb()
    .select({
      incomeCents: income,
      expenseCents: expense,
      pendingExpenseCents: sql<number>`coalesce(sum(case when ${transactions.type} = 'expense' and not ${transactions.paid} then ${transactions.amountCents} else 0 end), 0)`.mapWith(
        Number,
      ),
      count: sql<number>`count(*)`.mapWith(Number),
    })
    .from(transactions)
    .where(realMovement(userId, from, to));
  return { ...row, balanceCents: row.incomeCents - row.expenseCents };
}

const change = (current: number, previous: number) => (previous ? percent(current - previous, previous) : null);

/** Resumo do mês, comparado com o mês anterior. */
export async function monthlySummary(userId: number, month: string) {
  const previousMonth = shiftMonth(month, -1);
  const [current, previous, accountList, top] = await Promise.all([
    totalsForMonth(userId, month),
    totalsForMonth(userId, previousMonth),
    listAccounts(userId),
    byCategory(userId, { ...monthRange(month), type: 'expense' }),
  ]);

  return {
    month,
    incomeCents: current.incomeCents,
    expenseCents: current.expenseCents,
    balanceCents: current.balanceCents,
    pendingExpenseCents: current.pendingExpenseCents,
    transactionsCount: current.count,
    /** Quanto da renda sobrou no mês (%). */
    savingsRate: percent(current.balanceCents, current.incomeCents),
    totalBalanceCents: accountList.reduce((sum, account) => sum + account.balanceCents, 0),
    topExpenseCategory: top[0] ?? null,
    previousMonth: {
      month: previousMonth,
      incomeCents: previous.incomeCents,
      expenseCents: previous.expenseCents,
      balanceCents: previous.balanceCents,
    },
    changes: {
      incomePercent: change(current.incomeCents, previous.incomeCents),
      expensePercent: change(current.expenseCents, previous.expenseCents),
    },
  };
}

/** Total por categoria no período, do maior para o menor, com o percentual de cada uma. */
export async function byCategory(userId: number, params: { from: string; to: string; type: TransactionType }) {
  const rows = await getDb()
    .select({
      categoryId: transactions.categoryId,
      name: categories.name,
      color: categories.color,
      icon: categories.icon,
      totalCents: sql<number>`coalesce(sum(${transactions.amountCents}), 0)`.mapWith(Number),
      count: sql<number>`count(*)`.mapWith(Number),
    })
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .where(and(realMovement(userId, params.from, params.to), eq(transactions.type, params.type)))
    .groupBy(transactions.categoryId, categories.name, categories.color, categories.icon)
    .orderBy(desc(sql`sum(${transactions.amountCents})`));

  const total = rows.reduce((sum, row) => sum + row.totalCents, 0);
  return rows.map((row) => ({
    categoryId: row.categoryId,
    name: row.name ?? 'Sem categoria',
    color: row.color ?? '#94A3B8',
    icon: row.icon ?? 'tag',
    totalCents: row.totalCents,
    count: row.count,
    percent: percent(row.totalCents, total) ?? 0,
  }));
}

/** Entradas e saídas mês a mês (inclui meses sem movimento, com zero). */
export async function cashFlow(userId: number, params: { months: number; until: string }) {
  const firstMonth = shiftMonth(params.until, -(params.months - 1));
  const { from } = monthRange(firstMonth);
  const { to } = monthRange(params.until);
  const monthExpr = sql<string>`to_char(${transactions.date}, 'YYYY-MM')`;

  const rows = await getDb()
    .select({ month: monthExpr, incomeCents: income, expenseCents: expense })
    .from(transactions)
    .where(realMovement(userId, from, to))
    .groupBy(monthExpr);
  const byMonth = new Map(rows.map((row) => [row.month, row]));

  let accumulated = 0;
  return Array.from({ length: params.months }, (_, index) => {
    const month = shiftMonth(firstMonth, index);
    const row = byMonth.get(month);
    const incomeCents = row?.incomeCents ?? 0;
    const expenseCents = row?.expenseCents ?? 0;
    accumulated += incomeCents - expenseCents;
    return { month, incomeCents, expenseCents, balanceCents: incomeCents - expenseCents, accumulatedCents: accumulated };
  });
}
