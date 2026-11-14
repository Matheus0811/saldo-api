/**
 * Conta de demonstração com 6 meses de movimentação realista.
 * Login: demo@saldo.dev / demo123
 */
import { randomUUID } from 'node:crypto';

import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';

import { addDays, addMonths, currentMonth, monthRange, shiftMonth, today } from '../lib/dates.js';
import { splitInstallments } from '../lib/money.js';
import { DEFAULT_CATEGORIES } from '../modules/categories/default-categories.js';
import { getDb } from './client.js';
import { accounts, budgets, categories, goals, transactions, users, type NewTransaction } from './schema.js';

export const DEMO_EMAIL = 'demo@saldo.dev';
export const DEMO_PASSWORD = 'demo123';

/** Gerador pseudoaleatório com semente: a demo sai igual toda vez. */
function random(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
    return state / 2_147_483_648;
  };
}

export async function seedDemo(): Promise<{ transactions: number }> {
  const db = getDb();
  await db.delete(users).where(eq(users.email, DEMO_EMAIL));

  const rand = random(42);
  const between = (min: number, max: number) => Math.round(min + rand() * (max - min));

  const [user] = await db
    .insert(users)
    .values({ name: 'Conta Demo', email: DEMO_EMAIL, passwordHash: await bcrypt.hash(DEMO_PASSWORD, 10) })
    .returning();
  const userId = user.id;

  const createdCategories = await db
    .insert(categories)
    .values(DEFAULT_CATEGORIES.map((category) => ({ ...category, userId })))
    .returning();
  const cat = (name: string) => createdCategories.find((category) => category.name === name)!.id;

  const createdAccounts = await db
    .insert(accounts)
    .values([
      { userId, name: 'Conta corrente', type: 'checking' as const, initialBalanceCents: 185_000, color: '#7C3AED' },
      { userId, name: 'Carteira', type: 'wallet' as const, initialBalanceCents: 12_000, color: '#16A34A' },
      { userId, name: 'Cartão de crédito', type: 'credit_card' as const, initialBalanceCents: 0, color: '#F97316' },
      { userId, name: 'Investimentos', type: 'investment' as const, initialBalanceCents: 350_000, color: '#0EA5E9' },
    ])
    .returning();
  const acc = (name: string) => createdAccounts.find((account) => account.name === name)!.id;

  const todayStr = today();
  const thisMonth = currentMonth();
  const rows: NewTransaction[] = [];

  const add = (
    month: string,
    day: number,
    type: 'income' | 'expense',
    amountCents: number,
    description: string,
    category: string,
    account = 'Conta corrente',
    extra: Partial<NewTransaction> = {},
  ) => {
    const { to } = monthRange(month);
    const date = `${month}-${String(Math.min(day, Number(to.slice(8)))).padStart(2, '0')}`;
    rows.push({
      userId,
      type,
      amountCents,
      description,
      date,
      categoryId: cat(category),
      accountId: acc(account),
      paid: date <= todayStr,
      ...extra,
    });
  };

  for (let offset = -5; offset <= 0; offset += 1) {
    const month = shiftMonth(thisMonth, offset);

    add(month, 5, 'income', 420_000, 'Salário', 'Salário');
    if (offset % 2 === 0) add(month, between(12, 20), 'income', between(60_000, 140_000), 'Projeto freelance de site', 'Freelance');
    add(month, 28, 'income', between(1_800, 2_600), 'Rendimento da reserva', 'Rendimentos', 'Investimentos');

    add(month, 10, 'expense', 120_000, 'Aluguel', 'Moradia');
    add(month, 12, 'expense', between(14_000, 21_000), 'Conta de luz', 'Contas de casa');
    add(month, 12, 'expense', 9_990, 'Internet fibra', 'Contas de casa');
    add(month, 15, 'expense', 65_000, 'Mensalidade da faculdade', 'Educação');
    add(month, 8, 'expense', 5_590, 'Streaming de vídeo', 'Assinaturas', 'Cartão de crédito');
    add(month, 8, 'expense', 2_190, 'Streaming de música', 'Assinaturas', 'Cartão de crédito');
    add(month, 20, 'expense', 9_900, 'Academia', 'Saúde', 'Cartão de crédito');

    for (const week of [3, 10, 17, 24]) {
      add(month, week, 'expense', between(16_000, 32_000), 'Compras do mês no mercado', 'Mercado', 'Cartão de crédito');
    }
    for (let i = 0; i < between(3, 6); i += 1) {
      const places = ['Almoço no restaurante', 'Pizza com amigos', 'Lanche', 'Delivery de comida japonesa', 'Padaria'];
      add(month, between(1, 28), 'expense', between(2_500, 11_000), places[between(0, places.length - 1)], 'Restaurantes', 'Cartão de crédito');
    }
    for (let i = 0; i < between(4, 7); i += 1) {
      const rides = ['Corrida de aplicativo', 'Combustível', 'Recarga do cartão de transporte'];
      add(month, between(1, 28), 'expense', between(1_800, 16_000), rides[between(0, rides.length - 1)], 'Transporte', i % 3 === 0 ? 'Carteira' : 'Cartão de crédito');
    }
    if (rand() > 0.4) add(month, between(5, 27), 'expense', between(4_000, 18_000), 'Cinema e passeio', 'Lazer', 'Carteira');
    if (rand() > 0.6) add(month, between(5, 27), 'expense', between(3_500, 15_000), 'Farmácia', 'Saúde');

    // Pagamento da fatura do cartão (transferência da conta corrente para o cartão).
    const group = randomUUID();
    const invoiceDate = `${month}-07`;
    for (const [type, account] of [
      ['expense', 'Conta corrente'],
      ['income', 'Cartão de crédito'],
    ] as const) {
      rows.push({
        userId,
        type,
        amountCents: between(160_000, 210_000),
        description: 'Pagamento da fatura do cartão',
        date: invoiceDate,
        accountId: acc(account),
        categoryId: null,
        paid: invoiceDate <= todayStr,
        isTransfer: true,
        transferGroup: group,
      });
    }
    // As duas pontas da transferência precisam ter o mesmo valor.
    rows[rows.length - 1].amountCents = rows[rows.length - 2].amountCents;

    // Todo mês guarda um pouco nos investimentos.
    const saveGroup = randomUUID();
    const saveDate = `${month}-06`;
    for (const [type, account] of [
      ['expense', 'Conta corrente'],
      ['income', 'Investimentos'],
    ] as const) {
      rows.push({
        userId,
        type,
        amountCents: 50_000,
        description: 'Aporte na reserva de emergência',
        date: saveDate,
        accountId: acc(account),
        categoryId: null,
        paid: saveDate <= todayStr,
        isTransfer: true,
        transferGroup: saveGroup,
      });
    }
  }

  // Uma compra parcelada em 10x que começou há 3 meses.
  const installmentGroup = randomUUID();
  const firstDate = addMonths(`${shiftMonth(thisMonth, -3)}-14`, 0);
  splitInstallments(389_900, 10).forEach((amountCents, index) => {
    const date = addMonths(firstDate, index);
    rows.push({
      userId,
      type: 'expense',
      amountCents,
      description: `Notebook novo (${index + 1}/10)`,
      date,
      categoryId: cat('Compras'),
      accountId: acc('Cartão de crédito'),
      paid: date <= todayStr,
      installmentGroup,
      installmentNumber: index + 1,
      installmentTotal: 10,
    });
  });

  // Algumas contas a pagar nos próximos dias.
  add(shiftMonth(thisMonth, 1), 10, 'expense', 120_000, 'Aluguel', 'Moradia', 'Conta corrente', {
    date: addDays(todayStr, 9),
    paid: false,
  });

  await db.insert(transactions).values(rows);

  await db.insert(budgets).values([
    { userId, categoryId: cat('Mercado'), amountCents: 100_000 },
    { userId, categoryId: cat('Restaurantes'), amountCents: 30_000 },
    { userId, categoryId: cat('Transporte'), amountCents: 35_000 },
    { userId, categoryId: cat('Lazer'), amountCents: 15_000 },
    { userId, categoryId: cat('Assinaturas'), amountCents: 10_000 },
  ]);

  await db.insert(goals).values([
    {
      userId,
      name: 'Reserva de emergência',
      targetCents: 1_500_000,
      savedCents: 650_000,
      deadline: addMonths(todayStr, 12),
      color: '#0EA5E9',
    },
    { userId, name: 'Viagem para o Nordeste', targetCents: 600_000, savedCents: 185_000, deadline: addMonths(todayStr, 8), color: '#F97316' },
    { userId, name: 'Curso de inglês', targetCents: 240_000, savedCents: 240_000, deadline: null, color: '#16A34A' },
  ]);

  return { transactions: rows.length };
}

/** Cria a demo apenas se ela ainda não existir (usado ao iniciar com SEED_DEMO=true). */
export async function seedDemoIfMissing(): Promise<void> {
  const [existing] = await getDb().select({ id: users.id }).from(users).where(eq(users.email, DEMO_EMAIL)).limit(1);
  if (!existing) await seedDemo();
}
