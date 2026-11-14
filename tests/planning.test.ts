import { describe, expect, it } from 'vitest';

import { api, categoryId, createAccount, signUp } from './helpers.js';

const expense = (accountId: number, categoryId: number, amountCents: number, date: string) => ({
  type: 'expense',
  amountCents,
  description: 'Gasto',
  date,
  accountId,
  categoryId,
});

describe('orçamentos', () => {
  it('mostra gasto, saldo e status por categoria no mês', async () => {
    const { auth } = await signUp();
    const account = await createAccount(auth);
    const mercado = await categoryId(auth, 'Mercado');
    const lazer = await categoryId(auth, 'Lazer');

    await api().post('/api/budgets').set(auth).send({ categoryId: mercado, amountCents: 50_000 }).expect(201);
    await api().post('/api/budgets').set(auth).send({ categoryId: lazer, amountCents: 10_000 }).expect(201);

    await api().post('/api/transactions').set(auth).send(expense(account.id, mercado, 42_000, '2026-11-05')).expect(201);
    await api().post('/api/transactions').set(auth).send(expense(account.id, lazer, 12_500, '2026-11-08')).expect(201);
    // Gasto de outro mês não conta.
    await api().post('/api/transactions').set(auth).send(expense(account.id, mercado, 99_000, '2026-10-20')).expect(201);

    const res = await api().get('/api/budgets?month=2026-11').set(auth);
    const byName = Object.fromEntries(res.body.budgets.map((b: { category: { name: string } }) => [b.category.name, b]));
    expect(byName.Mercado).toMatchObject({ spentCents: 42_000, remainingCents: 8_000, percentUsed: 84, status: 'warning' });
    expect(byName.Lazer).toMatchObject({ spentCents: 12_500, status: 'exceeded' });
    expect(res.body.alerts).toBe(2);
  });

  it('não permite orçamento duplicado nem em categoria de receita', async () => {
    const { auth } = await signUp();
    const mercado = await categoryId(auth, 'Mercado');
    await api().post('/api/budgets').set(auth).send({ categoryId: mercado, amountCents: 1_000 }).expect(201);
    expect((await api().post('/api/budgets').set(auth).send({ categoryId: mercado, amountCents: 2_000 })).status).toBe(409);
    const salario = await categoryId(auth, 'Salário');
    expect((await api().post('/api/budgets').set(auth).send({ categoryId: salario, amountCents: 2_000 })).status).toBe(422);
  });
});

describe('metas', () => {
  it('acompanha depósitos e impede retirar mais do que tem', async () => {
    const { auth } = await signUp();
    const goal = await api().post('/api/goals').set(auth).send({ name: 'Viagem', targetCents: 100_000 }).expect(201);

    const deposit = await api().post(`/api/goals/${goal.body.id}/deposits`).set(auth).send({ amountCents: 25_000 });
    expect(deposit.body).toMatchObject({ savedCents: 25_000, progress: 25, remainingCents: 75_000, completed: false });

    const tooMuch = await api().post(`/api/goals/${goal.body.id}/deposits`).set(auth).send({ amountCents: -30_000 });
    expect(tooMuch.status).toBe(422);
  });
});

describe('relatórios', () => {
  it('resumo do mês compara com o mês anterior', async () => {
    const { auth } = await signUp();
    const account = await createAccount(auth);
    const salario = await categoryId(auth, 'Salário');
    const mercado = await categoryId(auth, 'Mercado');

    const income = (amountCents: number, date: string) => ({ type: 'income', amountCents, description: 'Salário', date, accountId: account.id, categoryId: salario });
    await api().post('/api/transactions').set(auth).send(income(400_000, '2026-10-05')).expect(201);
    await api().post('/api/transactions').set(auth).send(expense(account.id, mercado, 100_000, '2026-10-10')).expect(201);
    await api().post('/api/transactions').set(auth).send(income(500_000, '2026-11-05')).expect(201);
    await api().post('/api/transactions').set(auth).send(expense(account.id, mercado, 150_000, '2026-11-10')).expect(201);

    const res = await api().get('/api/reports/summary?month=2026-11').set(auth);
    expect(res.body).toMatchObject({
      incomeCents: 500_000,
      expenseCents: 150_000,
      balanceCents: 350_000,
      savingsRate: 70,
      changes: { incomePercent: 25, expensePercent: 50 },
    });
    expect(res.body.topExpenseCategory.name).toBe('Mercado');
  });

  it('gastos por categoria somam 100%', async () => {
    const { auth } = await signUp();
    const account = await createAccount(auth);
    await api().post('/api/transactions').set(auth).send(expense(account.id, await categoryId(auth, 'Mercado'), 30_000, '2026-11-02')).expect(201);
    await api().post('/api/transactions').set(auth).send(expense(account.id, await categoryId(auth, 'Transporte'), 10_000, '2026-11-03')).expect(201);

    const res = await api().get('/api/reports/by-category?from=2026-11-01&to=2026-11-30').set(auth);
    expect(res.body.map((c: { name: string; percent: number }) => [c.name, c.percent])).toEqual([
      ['Mercado', 75],
      ['Transporte', 25],
    ]);
  });

  it('fluxo de caixa preenche meses sem movimento', async () => {
    const { auth } = await signUp();
    const account = await createAccount(auth);
    await api().post('/api/transactions').set(auth).send({ type: 'income', amountCents: 1_000, description: 'Pix', date: '2026-09-10', accountId: account.id }).expect(201);
    await api().post('/api/transactions').set(auth).send({ type: 'income', amountCents: 2_000, description: 'Pix', date: '2026-11-10', accountId: account.id }).expect(201);

    const res = await api().get('/api/reports/cash-flow?months=3&until=2026-11').set(auth);
    expect(res.body.map((m: { month: string; incomeCents: number; accumulatedCents: number }) => [m.month, m.incomeCents, m.accumulatedCents])).toEqual([
      ['2026-09', 1_000, 1_000],
      ['2026-10', 0, 1_000],
      ['2026-11', 2_000, 3_000],
    ]);
  });
});

describe('documentação', () => {
  it('publica a especificação OpenAPI e as páginas', async () => {
    const spec = await api().get('/openapi.json');
    expect(spec.body.openapi).toBe('3.1.0');
    expect(Object.keys(spec.body.paths).length).toBeGreaterThan(15);
    expect((await api().get('/docs')).text).toContain('swagger-ui');
    expect((await api().get('/')).text).toContain('Saldo API');
  });
});
