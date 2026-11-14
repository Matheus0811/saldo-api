import { rateLimit } from 'express-rate-limit';

import { env } from '../config/env.js';

/** Limita tentativas de login/cadastro para dificultar ataques de força bruta. */
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => env.NODE_ENV === 'test',
  message: {
    error: { code: 'TOO_MANY_REQUESTS', message: 'Muitas tentativas. Aguarde alguns minutos e tente de novo.' },
  },
});
