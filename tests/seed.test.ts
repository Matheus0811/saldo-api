import { describe, expect, it } from 'vitest';

import { ready } from '../src/db/client.js';
import { DEMO_EMAIL, DEMO_PASSWORD, seedDemo } from '../src/db/seed.js';
import { api } from './helpers.js';

describe('conta de demonstração', () => {
  it('é criada com dados consistentes e pode ser recriada', async () => {
    await ready();
    const first = await seedDemo();
    expect(first.transactions).toBeGreaterThan(100);
    await seedDemo(); // recriar não pode falhar

    const login = await api().post('/api/auth/login').send({ email: DEMO_EMAIL, password: DEMO_PASSWORD });
    expect(login.status).toBe(200);
    const auth = { Authorization: `Bearer ${login.body.accessToken}` };

    const summary = await api().get('/api/reports/summary').set(auth);
    expect(summary.status).toBe(200);
    expect(summary.body.incomeCents).toBeGreaterThan(0);

    // Só o cartão de crédito pode ficar negativo (é a fatura em aberto).
    const accounts = await api().get('/api/accounts').set(auth);
    for (const account of accounts.body as { type: string; balanceCents: number }[]) {
      if (account.type !== 'credit_card') expect(account.balanceCents).toBeGreaterThanOrEqual(0);
    }

    const budgets = await api().get('/api/budgets').set(auth);
    expect(budgets.body.budgets).toHaveLength(5);

    const goals = await api().get('/api/goals').set(auth);
    expect(goals.body.some((goal: { completed: boolean }) => goal.completed)).toBe(true);
  });
});
