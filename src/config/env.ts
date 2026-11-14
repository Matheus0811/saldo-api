import 'dotenv/config';
import { z } from 'zod';

const emptyToUndefined = (value: unknown) => (value === '' ? undefined : value);

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3333),
  // Sem DATABASE_URL, a API usa o PGlite (PostgreSQL embutido) e salva os dados em PGLITE_DIR.
  DATABASE_URL: z.preprocess(emptyToUndefined, z.string().optional()),
  PGLITE_DIR: z.string().default('.data/pglite'),
  JWT_SECRET: z.string().min(16).default('dev-secret-troque-antes-de-publicar-0123456789'),
  ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().int().positive().default(15),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),
  SEED_DEMO: z.preprocess(emptyToUndefined, z.enum(['true', 'false']).optional()).transform((v) => v === 'true'),
});

export const env = schema.parse(process.env);
