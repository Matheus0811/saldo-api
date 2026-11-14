import { randomUUID } from 'node:crypto';

import { and, asc, desc, eq, getTableColumns, gte, ilike, isNull, lte, sql, type SQL } from 'drizzle-orm';

import { getDb } from '../../db/client.js';
import { accounts, categories, transactions, type Transaction, type TransactionType } from '../../db/schema.js';
import { addMonths } from '../../lib/dates.js';
import { badRequest, conflict, notFound, unprocessable } from '../../lib/errors.js';
import { splitInstallments } from '../../lib/money.js';
import { getOwnedAccount } from '../accounts/accounts.service.js';
import { getOwnedCategory } from '../categories/categories.service.js';

export interface TransactionInput {
  type: TransactionType;
  amountCents: number;
  description: string;
  date: string;
  accountId: number;
  categoryId?: number | null;
  paid?: boolean;
  notes?: string;
  installments?: number;
}

export interface TransactionFilters {
  from?: string;
  to?: string;
  accountId?: number;
  categoryId?: number;
  uncategorized?: boolean;
  type?: TransactionType;
  paid?: boolean;
  search?: string;
  includeTransfers?: boolean;
  page: number;
  pageSize: number;
  sort: 'date' | '-date' | 'amount' | '-amount';
}

/** Formato de saída: lançamento + dados da conta e da categoria. */
export interface TransactionView extends Transaction {
  account: { id: number; name: string };
  category: { id: number; name: string; color: string; icon: string } | null;
}

const viewColumns = {
  ...getTableColumns(transactions),
  accountName: accounts.name,
  categoryName: categories.name,
  categoryColor: categories.color,
  categoryIcon: categories.icon,
};

type ViewRow = Transaction & {
  accountName: string;
  categoryName: string | null;
  categoryColor: string | null;
  categoryIcon: string | null;
};

function toView(row: ViewRow): TransactionView {
  const { accountName, categoryName, categoryColor, categoryIcon, ...transaction } = row;
  return {
    ...transaction,
    account: { id: transaction.accountId, name: accountName },
    category:
      transaction.categoryId && categoryName
        ? { id: transaction.categoryId, name: categoryName, color: categoryColor ?? '#64748B', icon: categoryIcon ?? 'tag' }
        : null,
  };
}

function baseViewQuery() {
  return getDb()
    .select(viewColumns)
    .from(transactions)
    .innerJoin(accounts, eq(transactions.accountId, accounts.id))
    .leftJoin(categories, eq(transactions.categoryId, categories.id));
}

async function getOwnedTransaction(userId: number, id: number): Promise<Transaction> {
  const [row] = await getDb()
    .select()
    .from(transactions)
    .where(and(eq(transactions.id, id), eq(transactions.userId, userId)))
    .limit(1);
  if (!row) throw notFound('Lançamento não encontrado.');
  return row;
}

async function validateCategory(userId: number, categoryId: number | null | undefined, type: TransactionType) {
  if (categoryId == null) return;
  const category = await getOwnedCategory(userId, categoryId);
  if (category.type !== type) {
    const label = type === 'income' ? 'receita' : 'despesa';
    throw unprocessable(`A categoria "${category.name}" não é de ${label}.`, [
      { field: 'categoryId', message: `Escolha uma categoria de ${label}.` },
    ]);
  }
}

export async function getTransaction(userId: number, id: number): Promise<TransactionView> {
  const [row] = await baseViewQuery()
    .where(and(eq(transactions.id, id), eq(transactions.userId, userId)))
    .limit(1);
  if (!row) throw notFound('Lançamento não encontrado.');
  return toView(row);
}

/**
 * Cria um lançamento. Com `installments` > 1, cria uma compra parcelada:
 * o valor total é dividido e cada parcela cai no mesmo dia dos meses seguintes.
 */
export async function createTransaction(userId: number, input: TransactionInput) {
  await getOwnedAccount(userId, input.accountId);
  await validateCategory(userId, input.categoryId, input.type);

  const installments = input.installments ?? 1;
  const paid = input.paid ?? true;
  const base = {
    userId,
    type: input.type,
    accountId: input.accountId,
    categoryId: input.categoryId ?? null,
    notes: input.notes ?? '',
  };

  if (installments === 1) {
    const [created] = await getDb()
      .insert(transactions)
      .values({ ...base, amountCents: input.amountCents, description: input.description, date: input.date, paid })
      .returning();
    return getTransaction(userId, created.id);
  }

  if (input.amountCents < installments) throw badRequest('Valor pequeno demais para essa quantidade de parcelas.');

  const group = randomUUID();
  const parts = splitInstallments(input.amountCents, installments);
  const rows = parts.map((amountCents, index) => ({
    ...base,
    amountCents,
    description: `${input.description} (${index + 1}/${installments})`,
    date: addMonths(input.date, index),
    // Só a primeira parcela herda o "pago"; as próximas ficam pendentes.
    paid: index === 0 ? paid : false,
    installmentGroup: group,
    installmentNumber: index + 1,
    installmentTotal: installments,
  }));
  await getDb().insert(transactions).values(rows);

  const created = await baseViewQuery()
    .where(and(eq(transactions.userId, userId), eq(transactions.installmentGroup, group)))
    .orderBy(asc(transactions.installmentNumber));
  return { installmentGroup: group, totalCents: input.amountCents, transactions: created.map(toView) };
}

function buildFilters(userId: number, filters: Omit<TransactionFilters, 'page' | 'pageSize' | 'sort'>): SQL {
  const conditions: SQL[] = [eq(transactions.userId, userId)];
  if (filters.from) conditions.push(gte(transactions.date, filters.from));
  if (filters.to) conditions.push(lte(transactions.date, filters.to));
  if (filters.accountId) conditions.push(eq(transactions.accountId, filters.accountId));
  if (filters.categoryId) conditions.push(eq(transactions.categoryId, filters.categoryId));
  if (filters.uncategorized) conditions.push(isNull(transactions.categoryId));
  if (filters.type) conditions.push(eq(transactions.type, filters.type));
  if (filters.paid !== undefined) conditions.push(eq(transactions.paid, filters.paid));
  if (filters.includeTransfers === false) conditions.push(eq(transactions.isTransfer, false));
  if (filters.search) {
    const escaped = filters.search.replace(/[\\%_]/g, (char) => `\\${char}`);
    conditions.push(ilike(transactions.description, `%${escaped}%`));
  }
  return and(...conditions) as SQL;
}

/** Lista paginada + resumo (entradas, saídas e saldo) de todo o conjunto filtrado. */
export async function listTransactions(userId: number, filters: TransactionFilters) {
  const where = buildFilters(userId, filters);
  const db = getDb();

  const notTransfer = sql`not ${transactions.isTransfer}`;
  const [totals] = await db
    .select({
      total: sql<number>`count(*)`.mapWith(Number),
      incomeCents: sql<number>`coalesce(sum(case when ${transactions.type} = 'income' and ${notTransfer} then ${transactions.amountCents} else 0 end), 0)`.mapWith(
        Number,
      ),
      expenseCents: sql<number>`coalesce(sum(case when ${transactions.type} = 'expense' and ${notTransfer} then ${transactions.amountCents} else 0 end), 0)`.mapWith(
        Number,
      ),
    })
    .from(transactions)
    .where(where);

  const orderBy = {
    date: [asc(transactions.date), asc(transactions.id)],
    '-date': [desc(transactions.date), desc(transactions.id)],
    amount: [asc(transactions.amountCents), desc(transactions.date)],
    '-amount': [desc(transactions.amountCents), desc(transactions.date)],
  }[filters.sort];

  const rows = await baseViewQuery()
    .where(where)
    .orderBy(...orderBy)
    .limit(filters.pageSize)
    .offset((filters.page - 1) * filters.pageSize);

  return {
    data: rows.map(toView),
    meta: {
      page: filters.page,
      pageSize: filters.pageSize,
      total: totals.total,
      totalPages: Math.max(1, Math.ceil(totals.total / filters.pageSize)),
    },
    summary: {
      incomeCents: totals.incomeCents,
      expenseCents: totals.expenseCents,
      balanceCents: totals.incomeCents - totals.expenseCents,
    },
  };
}

export async function updateTransaction(
  userId: number,
  id: number,
  input: Partial<Omit<TransactionInput, 'installments'>>,
): Promise<TransactionView> {
  const current = await getOwnedTransaction(userId, id);

  if (current.isTransfer) {
    const blocked = (['type', 'amountCents', 'accountId', 'categoryId'] as const).filter((key) => key in input);
    if (blocked.length) {
      throw conflict('Este lançamento faz parte de uma transferência. Exclua e crie a transferência de novo para mudar valor ou contas.');
    }
  }
  if (input.accountId) await getOwnedAccount(userId, input.accountId);

  const type = input.type ?? current.type;
  const categoryId = input.categoryId === undefined ? current.categoryId : input.categoryId;
  if (input.type || input.categoryId !== undefined) await validateCategory(userId, categoryId, type);

  if (Object.keys(input).length) {
    await getDb().update(transactions).set(input).where(eq(transactions.id, id));
  }
  return getTransaction(userId, id);
}

export type DeleteScope = 'one' | 'future' | 'all';

/**
 * Exclui um lançamento. Para parcelas, `scope` permite excluir esta e as próximas (future)
 * ou todas (all). Transferências são sempre excluídas nas duas pontas.
 */
export async function deleteTransaction(userId: number, id: number, scope: DeleteScope = 'one'): Promise<number> {
  const current = await getOwnedTransaction(userId, id);
  const db = getDb();

  if (current.isTransfer && current.transferGroup) {
    const removed = await db
      .delete(transactions)
      .where(and(eq(transactions.userId, userId), eq(transactions.transferGroup, current.transferGroup)))
      .returning({ id: transactions.id });
    return removed.length;
  }

  if (scope !== 'one' && current.installmentGroup) {
    const conditions = [eq(transactions.userId, userId), eq(transactions.installmentGroup, current.installmentGroup)];
    if (scope === 'future') conditions.push(gte(transactions.installmentNumber, current.installmentNumber ?? 1));
    const removed = await db
      .delete(transactions)
      .where(and(...conditions))
      .returning({ id: transactions.id });
    return removed.length;
  }

  await db.delete(transactions).where(eq(transactions.id, id));
  return 1;
}

// ---------- Transferências ----------
export interface TransferInput {
  fromAccountId: number;
  toAccountId: number;
  amountCents: number;
  date: string;
  description?: string;
  paid?: boolean;
}

/** Transferência = saída na conta de origem + entrada na de destino, ligadas pelo mesmo transferGroup. */
export async function createTransfer(userId: number, input: TransferInput) {
  if (input.fromAccountId === input.toAccountId) {
    throw unprocessable('Escolha contas diferentes para transferir.', [
      { field: 'toAccountId', message: 'Deve ser diferente da conta de origem.' },
    ]);
  }
  const from = await getOwnedAccount(userId, input.fromAccountId);
  const to = await getOwnedAccount(userId, input.toAccountId);

  const group = randomUUID();
  const description = input.description?.trim() || `Transferência ${from.name} → ${to.name}`;
  const common = {
    userId,
    amountCents: input.amountCents,
    description,
    date: input.date,
    paid: input.paid ?? true,
    isTransfer: true,
    transferGroup: group,
    categoryId: null,
  };

  await getDb()
    .insert(transactions)
    .values([
      { ...common, type: 'expense' as const, accountId: from.id },
      { ...common, type: 'income' as const, accountId: to.id },
    ]);

  const legs = await baseViewQuery().where(and(eq(transactions.userId, userId), eq(transactions.transferGroup, group)));
  return {
    transferGroup: group,
    amountCents: input.amountCents,
    from: toView(legs.find((leg) => leg.type === 'expense')!),
    to: toView(legs.find((leg) => leg.type === 'income')!),
  };
}

// ---------- Exportação ----------
const csvCell = (value: string) => (/[";\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);

/** CSV no padrão brasileiro (separador ";" e vírgula decimal) para abrir direto no Excel. */
export async function exportCsv(userId: number, filters: Omit<TransactionFilters, 'page' | 'pageSize' | 'sort'>) {
  const rows = await baseViewQuery()
    .where(buildFilters(userId, filters))
    .orderBy(asc(transactions.date), asc(transactions.id));

  const header = ['Data', 'Descrição', 'Categoria', 'Conta', 'Tipo', 'Valor', 'Situação'];
  const lines = rows.map((row) => {
    const [y, m, d] = row.date.split('-');
    const signed = (row.type === 'income' ? 1 : -1) * row.amountCents;
    return [
      `${d}/${m}/${y}`,
      csvCell(row.description),
      csvCell(row.isTransfer ? 'Transferência' : (row.categoryName ?? 'Sem categoria')),
      csvCell(row.accountName),
      row.type === 'income' ? 'Entrada' : 'Saída',
      (signed / 100).toFixed(2).replace('.', ','),
      row.paid ? 'Pago' : 'Pendente',
    ].join(';');
  });
  // BOM (﻿) faz o Excel reconhecer os acentos.
  return `﻿${[header.join(';'), ...lines].join('\r\n')}\r\n`;
}
