import { describe, expect, it } from 'vitest';

import { api, categoryId, createAccount, signUp } from './helpers.js';

describe('lançamentos e saldos', () => {
  it('atualiza o saldo da conta com receitas e despesas pagas', async () => {
    const { auth } = await signUp();
    const account = await createAccount(auth, { initialBalanceCents: 10_000 });

    await api()
      .post('/api/transactions')
      .set(auth)
      .send({ type: 'income', amountCents: 500_000, description: 'Salário', date: '2026-11-05', accountId: account.id, categoryId: await categoryId(auth, 'Salário') })
      .expect(201);
    await api()
      .post('/api/transactions')
      .set(auth)
      .send({ type: 'expense', amountCents: 120_000, description: 'Aluguel', date: '2026-11-10', accountId: account.id, categoryId: await categoryId(auth, 'Moradia') })
      .expect(201);
    // Conta a pagar: não mexe no saldo atual, só no previsto.
    await api()
      .post('/api/transactions')
      .set(auth)
      .send({ type: 'expense', amountCents: 20_000, description: 'Luz', date: '2026-11-25', accountId: account.id, paid: false })
      .expect(201);

    const res = await api().get(`/api/accounts/${account.id}`).set(auth);
    expect(res.body.balanceCents).toBe(10_000 + 500_000 - 120_000);
    expect(res.body.projectedBalanceCents).toBe(10_000 + 500_000 - 120_000 - 20_000);
  });

  it('não aceita categoria de tipo diferente do lançamento', async () => {
    const { auth } = await signUp();
    const account = await createAccount(auth);
    const res = await api()
      .post('/api/transactions')
      .set(auth)
      .send({ type: 'expense', amountCents: 1_000, description: 'Teste', date: '2026-11-01', accountId: account.id, categoryId: await categoryId(auth, 'Salário') });
    expect(res.status).toBe(422);
    expect(res.body.error.details[0].field).toBe('categoryId');
  });

  it('cria compra parcelada com valores e datas corretos', async () => {
    const { auth } = await signUp();
    const card = await createAccount(auth, { name: 'Cartão', type: 'credit_card' });
    const res = await api()
      .post('/api/transactions')
      .set(auth)
      .send({ type: 'expense', amountCents: 100_000, description: 'Celular', date: '2026-01-31', accountId: card.id, installments: 3 })
      .expect(201);

    const parts = res.body.transactions;
    expect(parts).toHaveLength(3);
    expect(parts.map((p: { amountCents: number }) => p.amountCents)).toEqual([33_334, 33_333, 33_333]);
    expect(parts.map((p: { date: string }) => p.date)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31']);
    expect(parts.map((p: { description: string }) => p.description)).toEqual(['Celular (1/3)', 'Celular (2/3)', 'Celular (3/3)']);
    expect(parts[1].paid).toBe(false);

    // Excluir "esta e as próximas" a partir da 2ª parcela remove 2 lançamentos.
    const del = await api().delete(`/api/transactions/${parts[1].id}?scope=future`).set(auth);
    expect(del.status).toBe(204);
    expect(del.headers['x-deleted-count']).toBe('2');
  });

  it('filtra, pagina e devolve os totais do conjunto filtrado', async () => {
    const { auth } = await signUp();
    const account = await createAccount(auth);
    for (let day = 1; day <= 25; day += 1) {
      await api()
        .post('/api/transactions')
        .set(auth)
        .send({ type: 'expense', amountCents: 1_000, description: day % 5 === 0 ? `Mercado dia ${day}` : `Café ${day}`, date: `2026-10-${String(day).padStart(2, '0')}`, accountId: account.id })
        .expect(201);
    }

    const page = await api().get('/api/transactions?from=2026-10-01&to=2026-10-31&pageSize=10&page=3').set(auth);
    expect(page.body.data).toHaveLength(5);
    expect(page.body.meta).toMatchObject({ page: 3, total: 25, totalPages: 3 });
    expect(page.body.summary.expenseCents).toBe(25_000);

    const search = await api().get('/api/transactions?search=mercado').set(auth);
    expect(search.body.meta.total).toBe(5);

    const sorted = await api().get('/api/transactions?sort=date&pageSize=1').set(auth);
    expect(sorted.body.data[0].date).toBe('2026-10-01');
  });

  it('transferência move o saldo mas não conta como receita nem despesa', async () => {
    const { auth } = await signUp();
    const checking = await createAccount(auth, { initialBalanceCents: 100_000 });
    const savings = await createAccount(auth, { name: 'Poupança', type: 'savings' });

    const transfer = await api()
      .post('/api/transfers')
      .set(auth)
      .send({ fromAccountId: checking.id, toAccountId: savings.id, amountCents: 40_000, date: '2026-11-06' })
      .expect(201);
    expect(transfer.body.from.isTransfer).toBe(true);

    const accounts = await api().get('/api/accounts').set(auth);
    const byId = Object.fromEntries(accounts.body.map((a: { id: number; balanceCents: number }) => [a.id, a.balanceCents]));
    expect(byId[checking.id]).toBe(60_000);
    expect(byId[savings.id]).toBe(40_000);

    const summary = await api().get('/api/reports/summary?month=2026-11').set(auth);
    expect(summary.body.incomeCents).toBe(0);
    expect(summary.body.expenseCents).toBe(0);

    // Excluir uma ponta exclui a transferência inteira.
    const del = await api().delete(`/api/transactions/${transfer.body.to.id}`).set(auth);
    expect(del.headers['x-deleted-count']).toBe('2');
  });

  it('exporta CSV no formato brasileiro', async () => {
    const { auth } = await signUp();
    const account = await createAccount(auth);
    await api()
      .post('/api/transactions')
      .set(auth)
      .send({ type: 'expense', amountCents: 4_590, description: 'Farmácia; remédios', date: '2026-11-03', accountId: account.id, categoryId: await categoryId(auth, 'Saúde') })
      .expect(201);

    const res = await api().get('/api/transactions/export?from=2026-11-01&to=2026-11-30').set(auth);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text).toContain('03/11/2026;"Farmácia; remédios";Saúde;Conta corrente;Saída;-45,90;Pago');
  });

  it('um usuário não enxerga nem altera dados de outro', async () => {
    const alice = await signUp('Alice');
    const bob = await signUp('Bob');
    const account = await createAccount(alice.auth);

    expect((await api().get(`/api/accounts/${account.id}`).set(bob.auth)).status).toBe(404);
    const res = await api()
      .post('/api/transactions')
      .set(bob.auth)
      .send({ type: 'income', amountCents: 100, description: 'Invasão', date: '2026-11-01', accountId: account.id });
    expect(res.status).toBe(404);
  });

  it('não exclui conta com lançamentos', async () => {
    const { auth } = await signUp();
    const account = await createAccount(auth);
    await api()
      .post('/api/transactions')
      .set(auth)
      .send({ type: 'income', amountCents: 100, description: 'Pix', date: '2026-11-01', accountId: account.id })
      .expect(201);
    expect((await api().delete(`/api/accounts/${account.id}`).set(auth)).status).toBe(409);
  });
});
