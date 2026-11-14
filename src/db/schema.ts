/**
 * Tabelas do banco (Drizzle ORM). A criação real das tabelas fica em migrations.ts.
 * Valores em dinheiro são sempre inteiros em centavos (R$ 12,34 = 1234) para evitar erros de arredondamento.
 */
import { boolean, date, integer, pgTable, serial, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

export const ACCOUNT_TYPES = ['checking', 'savings', 'wallet', 'credit_card', 'investment'] as const;
export const CATEGORY_TYPES = ['income', 'expense'] as const;
export const TRANSACTION_TYPES = ['income', 'expense'] as const;

export type AccountType = (typeof ACCOUNT_TYPES)[number];
export type CategoryType = (typeof CATEGORY_TYPES)[number];
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 120 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: createdAt(),
});

export const refreshTokens = pgTable('refresh_tokens', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: createdAt(),
});

export const accounts = pgTable('accounts', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 80 }).notNull(),
  type: varchar('type', { length: 20 }).$type<AccountType>().notNull(),
  initialBalanceCents: integer('initial_balance_cents').notNull().default(0),
  color: varchar('color', { length: 9 }).notNull().default('#2563EB'),
  archived: boolean('archived').notNull().default(false),
  createdAt: createdAt(),
});

export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 60 }).notNull(),
  type: varchar('type', { length: 10 }).$type<CategoryType>().notNull(),
  color: varchar('color', { length: 9 }).notNull().default('#64748B'),
  icon: varchar('icon', { length: 40 }).notNull().default('tag'),
  createdAt: createdAt(),
});

export const transactions = pgTable('transactions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  accountId: integer('account_id')
    .notNull()
    .references(() => accounts.id, { onDelete: 'cascade' }),
  categoryId: integer('category_id').references(() => categories.id, { onDelete: 'set null' }),
  type: varchar('type', { length: 10 }).$type<TransactionType>().notNull(),
  amountCents: integer('amount_cents').notNull(),
  description: varchar('description', { length: 160 }).notNull(),
  date: date('date', { mode: 'string' }).notNull(),
  paid: boolean('paid').notNull().default(true),
  notes: text('notes').notNull().default(''),
  isTransfer: boolean('is_transfer').notNull().default(false),
  transferGroup: uuid('transfer_group'),
  installmentGroup: uuid('installment_group'),
  installmentNumber: integer('installment_number'),
  installmentTotal: integer('installment_total'),
  createdAt: createdAt(),
});

export const budgets = pgTable('budgets', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  categoryId: integer('category_id')
    .notNull()
    .references(() => categories.id, { onDelete: 'cascade' }),
  amountCents: integer('amount_cents').notNull(),
  createdAt: createdAt(),
});

export const goals = pgTable('goals', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 80 }).notNull(),
  targetCents: integer('target_cents').notNull(),
  savedCents: integer('saved_cents').notNull().default(0),
  deadline: date('deadline', { mode: 'string' }),
  color: varchar('color', { length: 9 }).notNull().default('#7C3AED'),
  createdAt: createdAt(),
});

export type User = typeof users.$inferSelect;
export type Account = typeof accounts.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type Budget = typeof budgets.$inferSelect;
export type Goal = typeof goals.$inferSelect;
