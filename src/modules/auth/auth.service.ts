import { createHash, randomBytes } from 'node:crypto';

import bcrypt from 'bcryptjs';
import { and, eq, isNull } from 'drizzle-orm';
import jwt from 'jsonwebtoken';

import { env } from '../../config/env.js';
import { getDb } from '../../db/client.js';
import { accounts, categories, refreshTokens, users, type User } from '../../db/schema.js';
import { conflict, unauthorized } from '../../lib/errors.js';
import { DEFAULT_CATEGORIES } from '../categories/default-categories.js';

export interface PublicUser {
  id: number;
  name: string;
  email: string;
  createdAt: Date;
}

export interface Session {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
}

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

export const toPublicUser = (user: User): PublicUser => ({
  id: user.id,
  name: user.name,
  email: user.email,
  createdAt: user.createdAt,
});

async function createSession(user: User): Promise<Session> {
  const expiresIn = env.ACCESS_TOKEN_TTL_MINUTES * 60;
  const accessToken = jwt.sign({ name: user.name }, env.JWT_SECRET, { subject: String(user.id), expiresIn });

  const refreshToken = randomBytes(48).toString('base64url');
  await getDb()
    .insert(refreshTokens)
    .values({
      userId: user.id,
      tokenHash: sha256(refreshToken),
      expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000),
    });

  return { user: toPublicUser(user), accessToken, refreshToken, tokenType: 'Bearer', expiresIn };
}

export async function register(input: { name: string; email: string; password: string }): Promise<Session> {
  const db = getDb();
  const email = input.email.trim().toLowerCase();

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing) throw conflict('Já existe uma conta com este e-mail.');

  const passwordHash = await bcrypt.hash(input.password, 10);

  const user = await db.transaction(async (tx) => {
    const [created] = await tx.insert(users).values({ name: input.name.trim(), email, passwordHash }).returning();
    // Todo usuário novo já começa com categorias prontas e uma carteira.
    await tx.insert(categories).values(DEFAULT_CATEGORIES.map((category) => ({ ...category, userId: created.id })));
    await tx.insert(accounts).values({ userId: created.id, name: 'Carteira', type: 'wallet', color: '#16A34A' });
    return created;
  });

  return createSession(user);
}

export async function login(input: { email: string; password: string }): Promise<Session> {
  const [user] = await getDb()
    .select()
    .from(users)
    .where(eq(users.email, input.email.trim().toLowerCase()))
    .limit(1);

  // Mesma mensagem para e-mail inexistente e senha errada: não revela quais e-mails têm conta.
  if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
    throw unauthorized('E-mail ou senha incorretos.');
  }
  return createSession(user);
}

/** Troca um refresh token por um novo par de tokens (rotação). O token usado deixa de valer. */
export async function refresh(token: string): Promise<Session> {
  const db = getDb();
  const [stored] = await db.select().from(refreshTokens).where(eq(refreshTokens.tokenHash, sha256(token))).limit(1);
  if (!stored) throw unauthorized('Sessão inválida. Faça login novamente.');

  if (stored.revokedAt) {
    // Token já usado sendo reaproveitado: possível roubo. Encerra todas as sessões do usuário.
    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.userId, stored.userId), isNull(refreshTokens.revokedAt)));
    throw unauthorized('Sessão inválida. Faça login novamente.');
  }
  if (stored.expiresAt.getTime() < Date.now()) throw unauthorized('Sessão expirada. Faça login novamente.');

  await db.update(refreshTokens).set({ revokedAt: new Date() }).where(eq(refreshTokens.id, stored.id));

  const [user] = await db.select().from(users).where(eq(users.id, stored.userId)).limit(1);
  if (!user) throw unauthorized('Sessão inválida. Faça login novamente.');
  return createSession(user);
}

export async function logout(token: string): Promise<void> {
  await getDb()
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(refreshTokens.tokenHash, sha256(token)), isNull(refreshTokens.revokedAt)));
}

export async function getUser(userId: number): Promise<PublicUser> {
  const [user] = await getDb().select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw unauthorized('Usuário não encontrado. Faça login novamente.');
  return toPublicUser(user);
}
