import { describe, expect, it } from 'vitest';

import { api, signUp } from './helpers.js';

describe('autenticação', () => {
  it('cadastra, entra e lê o próprio perfil', async () => {
    const { email, auth } = await signUp('Maria Silva');

    const login = await api().post('/api/auth/login').send({ email, password: 'segredo123' });
    expect(login.status).toBe(200);
    expect(login.body.accessToken).toBeTruthy();
    expect(login.body.user).not.toHaveProperty('passwordHash');

    const me = await api().get('/api/auth/me').set(auth);
    expect(me.body.name).toBe('Maria Silva');
  });

  it('usuário novo já vem com categorias e uma carteira', async () => {
    const { auth } = await signUp();
    const categories = await api().get('/api/categories').set(auth);
    const accounts = await api().get('/api/accounts').set(auth);
    expect(categories.body.length).toBeGreaterThan(10);
    expect(accounts.body).toHaveLength(1);
    expect(accounts.body[0].type).toBe('wallet');
  });

  it('não permite e-mail repetido', async () => {
    const { email } = await signUp();
    const res = await api().post('/api/auth/register').send({ name: 'Outra', email, password: 'segredo123' });
    expect(res.status).toBe(409);
  });

  it('recusa senha errada com mensagem genérica', async () => {
    const { email } = await signUp();
    const res = await api().post('/api/auth/login').send({ email, password: 'errada' });
    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('E-mail ou senha incorretos.');
  });

  it('exige token nas rotas protegidas', async () => {
    expect((await api().get('/api/accounts')).status).toBe(401);
    expect((await api().get('/api/accounts').set({ Authorization: 'Bearer token-falso' })).status).toBe(401);
  });

  it('renova a sessão e invalida o refresh token usado', async () => {
    const { refreshToken } = await signUp();
    const first = await api().post('/api/auth/refresh').send({ refreshToken });
    expect(first.status).toBe(200);
    expect(first.body.refreshToken).not.toBe(refreshToken);

    const reused = await api().post('/api/auth/refresh').send({ refreshToken });
    expect(reused.status).toBe(401);

    // Reuso de token antigo encerra todas as sessões: o token novo também deixa de valer.
    const afterReuse = await api().post('/api/auth/refresh').send({ refreshToken: first.body.refreshToken });
    expect(afterReuse.status).toBe(401);
  });

  it('valida os dados com mensagens em português', async () => {
    const res = await api().post('/api/auth/register').send({ name: 'A', email: 'invalido', password: '123' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    const fields = res.body.error.details.map((d: { field: string }) => d.field);
    expect(fields).toEqual(expect.arrayContaining(['name', 'email', 'password']));
  });
});
