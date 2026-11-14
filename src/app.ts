/**
 * Aplicação Express da Saldo API.
 * Este arquivo é o ponto de entrada na Vercel (export default app).
 * Para rodar localmente use `npm run dev`, que sobe o servidor em src/main.ts.
 */
import cors from 'cors';
import express, { Router } from 'express';
import helmet from 'helmet';

import { ready } from './db/client.js';
import { docsPage, homePage } from './docs/pages.js';
import { openApiDocument } from './docs/openapi.js';
import { requireAuth } from './middlewares/auth.js';
import { errorHandler, notFoundHandler } from './middlewares/error-handler.js';
import { accountsRouter } from './modules/accounts/accounts.routes.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { budgetsRouter } from './modules/budgets/budgets.routes.js';
import { categoriesRouter } from './modules/categories/categories.routes.js';
import { goalsRouter } from './modules/goals/goals.routes.js';
import { reportsRouter } from './modules/reports/reports.routes.js';
import { transactionsRouter, transfersRouter } from './modules/transactions/transactions.routes.js';

const app = express();

app.set('trust proxy', 1);
app.disable('x-powered-by');
// A documentação usa scripts de CDN, então a CSP padrão do helmet fica desligada.
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ exposedHeaders: ['Content-Disposition', 'X-Deleted-Count'] }));
app.use(express.json({ limit: '100kb' }));

// Páginas públicas (não precisam do banco).
app.get('/', (_req, res) => {
  res.type('html').send(homePage());
});
app.get('/docs', (_req, res) => {
  res.type('html').send(docsPage());
});
app.get('/openapi.json', (_req, res) => {
  res.json(openApiDocument);
});

const api = Router();

api.get('/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Garante banco conectado e migrado antes de qualquer rota de dados.
api.use(async (_req, _res, next) => {
  await ready();
  next();
});

api.use('/auth', authRouter);
api.use('/accounts', requireAuth, accountsRouter);
api.use('/categories', requireAuth, categoriesRouter);
api.use('/transactions', requireAuth, transactionsRouter);
api.use('/transfers', requireAuth, transfersRouter);
api.use('/budgets', requireAuth, budgetsRouter);
api.use('/goals', requireAuth, goalsRouter);
api.use('/reports', requireAuth, reportsRouter);

app.use('/api', api);
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
