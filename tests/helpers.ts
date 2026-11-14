import request from 'supertest';
import { expect } from 'vitest';

import app from '../src/app.js';

export const api = () => request(app);

let counter = 0;

/** Cadastra um usuário novo e devolve o cabeçalho de autenticação pronto para usar. */
export async function signUp(name = 'Pessoa Teste') {
  counter += 1;
  const email = `pessoa${Date.now()}${counter}@teste.com`;
  const res = await api().post('/api/auth/register').send({ name, email, password: 'segredo123' });
  expect(res.status).toBe(201);
  return {
    email,
    user: res.body.user,
    refreshToken: res.body.refreshToken as string,
    auth: { Authorization: `Bearer ${res.body.accessToken}` },
  };
}

/** Busca o ID de uma categoria padrão pelo nome. */
export async function categoryId(auth: Record<string, string>, name: string): Promise<number> {
  const res = await api().get('/api/categories').set(auth);
  const found = res.body.find((category: { name: string }) => category.name === name);
  if (!found) throw new Error(`Categoria ${name} não encontrada`);
  return found.id;
}

export async function createAccount(auth: Record<string, string>, body: Record<string, unknown> = {}) {
  const res = await api()
    .post('/api/accounts')
    .set(auth)
    .send({ name: 'Conta corrente', type: 'checking', ...body });
  expect(res.status).toBe(201);
  return res.body as { id: number; balanceCents: number };
}
