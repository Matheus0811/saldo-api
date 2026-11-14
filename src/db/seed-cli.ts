/** Uso: npm run seed  (recria a conta de demonstração) */
import { ready } from './client.js';
import { DEMO_EMAIL, DEMO_PASSWORD, seedDemo } from './seed.js';

await ready();
const result = await seedDemo();
console.log(`✔ Conta de demonstração criada com ${result.transactions} lançamentos.`);
console.log(`  Login: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
process.exit(0);
