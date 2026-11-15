/**
 * Conexão com o banco.
 * - Produção (DATABASE_URL definida): PostgreSQL via node-postgres (ex.: Neon, Docker).
 * - Desenvolvimento sem DATABASE_URL: PGlite, um PostgreSQL de verdade que roda dentro do Node,
 *   sem instalar nada. Os dados ficam em PGLITE_DIR.
 * - Testes: PGlite em memória, um banco novo e limpo para cada arquivo de teste.
 */
import { mkdirSync } from 'node:fs';

import { PGlite } from '@electric-sql/pglite';
import { drizzle as drizzlePg, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import pg from 'pg';

import { env } from '../config/env.js';
import { runMigrations, type SqlRunner } from './migrate.js';
import * as schema from './schema.js';

export type Database = NodePgDatabase<typeof schema>;

const MIGRATION_LOCK_ID = 727_001;

let database: Database | null = null;
let readyPromise: Promise<Database> | null = null;

async function connect(): Promise<{ db: Database; runner: SqlRunner }> {
  if (env.DATABASE_URL) {
    const pool = new pg.Pool({ connectionString: env.DATABASE_URL, max: 5 });
    const runner: SqlRunner = {
      async withLock(fn) {
        const client = await pool.connect();
        try {
          // Trava de transação (pg_advisory_xact_lock): é liberada sozinha no COMMIT/ROLLBACK e
          // funciona também atrás de poolers como o PgBouncer do Neon, ao contrário da trava de sessão.
          await client.query('BEGIN');
          await client.query(`SELECT pg_advisory_xact_lock(${MIGRATION_LOCK_ID})`);
          const result = await fn({
            exec: async (sql) => {
              await client.query(sql);
            },
            rows: async (sql) => (await client.query(sql)).rows,
          });
          await client.query('COMMIT');
          return result;
        } catch (error) {
          await client.query('ROLLBACK').catch(() => undefined);
          throw error;
        } finally {
          client.release();
        }
      },
    };
    return { db: drizzlePg({ client: pool, schema }), runner };
  }

  if (env.NODE_ENV !== 'test') mkdirSync(env.PGLITE_DIR, { recursive: true });
  const client = env.NODE_ENV === 'test' ? new PGlite() : new PGlite(env.PGLITE_DIR);
  const runner: SqlRunner = {
    async withLock(fn) {
      // PGlite tem uma conexão só, então a transação já garante a exclusividade.
      await client.exec('BEGIN');
      try {
        const result = await fn({
          exec: async (sql) => {
            await client.exec(sql);
          },
          rows: async (sql) => (await client.query<Record<string, unknown>>(sql)).rows,
        });
        await client.exec('COMMIT');
        return result;
      } catch (error) {
        await client.exec('ROLLBACK').catch(() => undefined);
        throw error;
      }
    },
  };
  // PGlite e node-postgres expõem a mesma API do Drizzle para PostgreSQL.
  return { db: drizzlePglite({ client, schema }) as unknown as Database, runner };
}

/** Conecta, aplica migrações e (opcionalmente) cria a conta de demonstração. Executa uma vez só. */
export function ready(): Promise<Database> {
  if (!readyPromise) {
    readyPromise = (async () => {
      const { db, runner } = await connect();
      await runMigrations(runner);
      database = db;
      if (env.SEED_DEMO) {
        const { seedDemoIfMissing } = await import('./seed.js');
        // Se duas instâncias tentarem criar a demo ao mesmo tempo, uma falha e tudo bem.
        await seedDemoIfMissing().catch((error) => console.warn('Demo não criada nesta instância:', error?.message));
      }
      return db;
    })().catch((error) => {
      readyPromise = null;
      throw error;
    });
  }
  return readyPromise;
}

export function getDb(): Database {
  if (!database) throw new Error('O banco ainda não foi inicializado. Chame ready() antes.');
  return database;
}
