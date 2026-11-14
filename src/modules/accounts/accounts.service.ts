import { and, asc, eq, sql } from 'drizzle-orm';

import { getDb } from '../../db/client.js';
import { accounts, transactions, type Account, type AccountType } from '../../db/schema.js';
import { conflict, notFound } from '../../lib/errors.js';

export interface AccountWithBalance extends Account {
  /** Saldo atual: saldo inicial + lançamentos já pagos/recebidos. */
  balanceCents: number;
  /** Saldo previsto: inclui também os lançamentos pendentes. */
  projectedBalanceCents: number;
}

export interface AccountInput {
  name: string;
  type: AccountType;
  initialBalanceCents?: number;
  color?: string;
  archived?: boolean;
}

/** Soma dos lançamentos por conta, separando pagos e pendentes. */
async function netByAccount(userId: number) {
  const signed = sql`case when ${transactions.type} = 'income' then ${transactions.amountCents} else 0 - ${transactions.amountCents} end`;
  const rows = await getDb()
    .select({
      accountId: transactions.accountId,
      paid: sql<number>`coalesce(sum(case when ${transactions.paid} then ${signed} else 0 end), 0)`.mapWith(Number),
      pending: sql<number>`coalesce(sum(case when ${transactions.paid} then 0 else ${signed} end), 0)`.mapWith(Number),
    })
    .from(transactions)
    .where(eq(transactions.userId, userId))
    .groupBy(transactions.accountId);
  return new Map(rows.map((row) => [row.accountId, row]));
}

function withBalance(account: Account, net: Map<number, { paid: number; pending: number }>): AccountWithBalance {
  const sums = net.get(account.id) ?? { paid: 0, pending: 0 };
  const balanceCents = account.initialBalanceCents + sums.paid;
  return { ...account, balanceCents, projectedBalanceCents: balanceCents + sums.pending };
}

export async function getOwnedAccount(userId: number, id: number): Promise<Account> {
  const [account] = await getDb()
    .select()
    .from(accounts)
    .where(and(eq(accounts.id, id), eq(accounts.userId, userId)))
    .limit(1);
  if (!account) throw notFound('Conta não encontrada.');
  return account;
}

export async function listAccounts(userId: number, includeArchived = false): Promise<AccountWithBalance[]> {
  const conditions = [eq(accounts.userId, userId)];
  if (!includeArchived) conditions.push(eq(accounts.archived, false));
  const rows = await getDb()
    .select()
    .from(accounts)
    .where(and(...conditions))
    .orderBy(asc(accounts.archived), asc(accounts.name));
  const net = await netByAccount(userId);
  return rows.map((account) => withBalance(account, net));
}

export async function getAccount(userId: number, id: number): Promise<AccountWithBalance> {
  const account = await getOwnedAccount(userId, id);
  return withBalance(account, await netByAccount(userId));
}

export async function createAccount(userId: number, input: AccountInput): Promise<AccountWithBalance> {
  const [account] = await getDb()
    .insert(accounts)
    .values({ userId, ...input })
    .returning();
  return { ...account, balanceCents: account.initialBalanceCents, projectedBalanceCents: account.initialBalanceCents };
}

export async function updateAccount(userId: number, id: number, input: Partial<AccountInput>) {
  await getOwnedAccount(userId, id);
  if (Object.keys(input).length) await getDb().update(accounts).set(input).where(eq(accounts.id, id));
  return getAccount(userId, id);
}

export async function deleteAccount(userId: number, id: number): Promise<void> {
  await getOwnedAccount(userId, id);
  const [{ total }] = await getDb()
    .select({ total: sql<number>`count(*)`.mapWith(Number) })
    .from(transactions)
    .where(eq(transactions.accountId, id));
  if (total > 0) {
    throw conflict(`Esta conta tem ${total} lançamento(s). Arquive a conta em vez de excluir para manter o histórico.`);
  }
  await getDb().delete(accounts).where(eq(accounts.id, id));
}

/** Soma do saldo atual de todas as contas não arquivadas. */
export async function totalBalance(userId: number): Promise<number> {
  const list = await listAccounts(userId);
  return list.reduce((sum, account) => sum + account.balanceCents, 0);
}
