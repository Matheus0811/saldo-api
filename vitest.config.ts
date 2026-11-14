import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Cada arquivo de teste roda isolado, com um PostgreSQL em memória (PGlite) só dele.
    env: {
      NODE_ENV: 'test',
      JWT_SECRET: 'segredo-de-teste-com-mais-de-32-caracteres',
      DATABASE_URL: '',
    },
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
