/** Servidor local: npm run dev */
import app from './app.js';
import { env } from './config/env.js';
import { ready } from './db/client.js';

await ready();

app.listen(env.PORT, () => {
  const url = `http://localhost:${env.PORT}`;
  console.log(`\n  Saldo API rodando em ${url}`);
  console.log(`  Documentação:        ${url}/docs`);
  console.log(`  Banco:               ${env.DATABASE_URL ? 'PostgreSQL (DATABASE_URL)' : `PGlite em ${env.PGLITE_DIR}`}\n`);
});
