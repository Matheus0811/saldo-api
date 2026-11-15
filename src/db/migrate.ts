import { migrations } from './migrations.js';

export interface SqlExecutor {
  exec(sql: string): Promise<void>;
  rows(sql: string): Promise<Record<string, unknown>[]>;
}

export interface SqlRunner {
  /**
   * Executa `fn` dentro de uma única transação e com exclusividade (evita duas instâncias migrando
   * ao mesmo tempo). Se `fn` falhar, a transação inteira é desfeita.
   */
  withLock<T>(fn: (executor: SqlExecutor) => Promise<T>): Promise<T>;
}

/** Aplica as migrações pendentes e retorna o nome das que foram aplicadas agora. */
export async function runMigrations(runner: SqlRunner): Promise<string[]> {
  return runner.withLock(async (db) => {
    await db.exec(
      'CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())',
    );
    const applied = new Set((await db.rows('SELECT name FROM schema_migrations')).map((row) => String(row.name)));

    const done: string[] = [];
    for (const migration of migrations) {
      if (applied.has(migration.name)) continue;
      // Tudo roda na transação aberta pelo runner: se algo falhar, nada fica pela metade.
      await db.exec(`${migration.sql}\nINSERT INTO schema_migrations (name) VALUES ('${migration.name}');`);
      done.push(migration.name);
    }
    return done;
  });
}
