/** Especificação OpenAPI 3.1 da Saldo API (usada pela documentação em /docs). */

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const json = (schema: object, description = 'OK') => ({ description, content: { 'application/json': { schema } } });
const body = (schema: object, example?: object) => ({
  required: true,
  content: { 'application/json': { schema, ...(example ? { example } : {}) } },
});
const ERROR_LABELS: Record<number, string> = {
  400: 'Requisição inválida',
  401: 'Não autenticado',
  404: 'Não encontrado',
  409: 'Conflito com o estado atual',
  422: 'Dados inválidos',
  429: 'Muitas tentativas',
};
const errors = (...codes: number[]) =>
  Object.fromEntries(
    codes.map((code) => [
      String(code),
      json(ref('Error'), ERROR_LABELS[code] ?? 'Erro'),
    ]),
  );
const idPath = { name: 'id', in: 'path', required: true, schema: { type: 'integer' } };
const q = (name: string, schema: object, description: string) => ({ name, in: 'query', schema, description });
const noContent = { description: 'Sem conteúdo' };
const secured = [{ bearerAuth: [] }];

const money = (description: string) => ({ type: 'integer', description: `${description} (em centavos: 1250 = R$ 12,50)` });
const date = { type: 'string', format: 'date', example: '2026-11-14' };

export const openApiDocument = {
  openapi: '3.1.0',
  info: {
    title: 'Saldo API',
    version: '1.0.0',
    description: [
      'API REST de **controle financeiro pessoal**: contas, categorias, lançamentos (com parcelamento),',
      'transferências, orçamentos com alerta, metas e relatórios.',
      '',
      '**Como testar:**',
      '1. Use `POST /api/auth/login` com `demo@saldo.dev` / `demo123` (conta de demonstração).',
      '2. Copie o `accessToken` da resposta e clique em **Authorize**.',
      '3. Pronto: todas as rotas abaixo funcionam com os dados da demo.',
      '',
      'Valores em dinheiro são **inteiros em centavos** (`1250` = R$ 12,50). Datas no formato `AAAA-MM-DD`.',
    ].join('\n'),
    contact: { name: 'Matheus Galvão', url: 'https://github.com/Matheus0811' },
  },
  servers: [{ url: '/', description: 'Este servidor' }],
  tags: [
    { name: 'Autenticação', description: 'Cadastro, login e renovação de sessão (JWT + refresh token)' },
    { name: 'Contas', description: 'Conta corrente, carteira, cartão de crédito, investimentos' },
    { name: 'Categorias', description: 'Categorias de receitas e despesas' },
    { name: 'Lançamentos', description: 'Receitas e despesas, com filtros, paginação, parcelas e exportação CSV' },
    { name: 'Transferências', description: 'Movimentação entre contas (não conta como receita/despesa)' },
    { name: 'Orçamentos', description: 'Limite mensal por categoria com alerta a partir de 80%' },
    { name: 'Metas', description: 'Objetivos de economia com progresso e valor mensal necessário' },
    { name: 'Relatórios', description: 'Resumo do mês, gastos por categoria e fluxo de caixa' },
    { name: 'Status', description: 'Saúde da API' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'VALIDATION_ERROR' },
              message: { type: 'string', example: 'Dados inválidos. Confira os campos destacados.' },
              details: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: { field: { type: 'string', example: 'amountCents' }, message: { type: 'string' } },
                },
              },
            },
          },
        },
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          name: { type: 'string' },
          email: { type: 'string', format: 'email' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Session: {
        type: 'object',
        properties: {
          user: ref('User'),
          accessToken: { type: 'string', description: 'JWT válido por 15 minutos' },
          refreshToken: { type: 'string', description: 'Use em /api/auth/refresh para renovar a sessão (válido por 7 dias)' },
          tokenType: { type: 'string', example: 'Bearer' },
          expiresIn: { type: 'integer', example: 900 },
        },
      },
      AccountInput: {
        type: 'object',
        required: ['name', 'type'],
        properties: {
          name: { type: 'string', example: 'Conta corrente' },
          type: { type: 'string', enum: ['checking', 'savings', 'wallet', 'credit_card', 'investment'] },
          initialBalanceCents: money('Saldo inicial'),
          color: { type: 'string', example: '#7C3AED' },
          archived: { type: 'boolean' },
        },
      },
      Account: {
        allOf: [
          ref('AccountInput'),
          {
            type: 'object',
            properties: {
              id: { type: 'integer' },
              balanceCents: money('Saldo atual (só lançamentos pagos)'),
              projectedBalanceCents: money('Saldo previsto (inclui pendentes)'),
              createdAt: { type: 'string', format: 'date-time' },
            },
          },
        ],
      },
      CategoryInput: {
        type: 'object',
        required: ['name', 'type'],
        properties: {
          name: { type: 'string', example: 'Mercado' },
          type: { type: 'string', enum: ['income', 'expense'] },
          color: { type: 'string', example: '#F97316' },
          icon: { type: 'string', example: 'shopping-cart' },
        },
      },
      Category: {
        allOf: [ref('CategoryInput'), { type: 'object', properties: { id: { type: 'integer' } } }],
      },
      TransactionInput: {
        type: 'object',
        required: ['type', 'amountCents', 'description', 'date', 'accountId'],
        properties: {
          type: { type: 'string', enum: ['income', 'expense'] },
          amountCents: money('Valor total'),
          description: { type: 'string', example: 'Compras no mercado' },
          date,
          accountId: { type: 'integer' },
          categoryId: { type: ['integer', 'null'] },
          paid: { type: 'boolean', default: true, description: 'false = conta a pagar/receber' },
          notes: { type: 'string' },
          installments: {
            type: 'integer',
            minimum: 1,
            maximum: 48,
            description: 'Parcelar em N vezes: cria N lançamentos mensais que somam o valor total',
          },
        },
      },
      Transaction: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          type: { type: 'string', enum: ['income', 'expense'] },
          amountCents: money('Valor'),
          description: { type: 'string' },
          date,
          paid: { type: 'boolean' },
          notes: { type: 'string' },
          isTransfer: { type: 'boolean' },
          transferGroup: { type: ['string', 'null'], format: 'uuid' },
          installmentGroup: { type: ['string', 'null'], format: 'uuid' },
          installmentNumber: { type: ['integer', 'null'] },
          installmentTotal: { type: ['integer', 'null'] },
          account: { type: 'object', properties: { id: { type: 'integer' }, name: { type: 'string' } } },
          category: {
            type: ['object', 'null'],
            properties: { id: { type: 'integer' }, name: { type: 'string' }, color: { type: 'string' }, icon: { type: 'string' } },
          },
        },
      },
      TransactionPage: {
        type: 'object',
        properties: {
          data: { type: 'array', items: ref('Transaction') },
          meta: {
            type: 'object',
            properties: {
              page: { type: 'integer' },
              pageSize: { type: 'integer' },
              total: { type: 'integer' },
              totalPages: { type: 'integer' },
            },
          },
          summary: {
            type: 'object',
            description: 'Totais de todo o conjunto filtrado (não só da página)',
            properties: {
              incomeCents: { type: 'integer' },
              expenseCents: { type: 'integer' },
              balanceCents: { type: 'integer' },
            },
          },
        },
      },
      Budget: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          category: ref('Category'),
          limitCents: { type: 'integer' },
          spentCents: { type: 'integer' },
          remainingCents: { type: 'integer' },
          percentUsed: { type: 'number', example: 86.5 },
          status: { type: 'string', enum: ['ok', 'warning', 'exceeded'] },
        },
      },
      Goal: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          name: { type: 'string', example: 'Reserva de emergência' },
          targetCents: { type: 'integer' },
          savedCents: { type: 'integer' },
          deadline: { type: ['string', 'null'], format: 'date' },
          color: { type: 'string' },
          progress: { type: 'number', example: 43.3 },
          remainingCents: { type: 'integer' },
          completed: { type: 'boolean' },
          monthsLeft: { type: ['integer', 'null'] },
          monthlyNeededCents: { type: ['integer', 'null'], description: 'Quanto guardar por mês para chegar no prazo' },
        },
      },
    },
  },
  paths: {
    '/api/health': {
      get: { tags: ['Status'], summary: 'Verifica se a API está no ar', responses: { 200: json({ type: 'object' }) } },
    },
    '/api/auth/register': {
      post: {
        tags: ['Autenticação'],
        summary: 'Cria uma conta (já vem com categorias padrão e uma carteira)',
        requestBody: body(
          {
            type: 'object',
            required: ['name', 'email', 'password'],
            properties: { name: { type: 'string' }, email: { type: 'string' }, password: { type: 'string', minLength: 6 } },
          },
          { name: 'Maria Silva', email: 'maria@email.com', password: 'segredo123' },
        ),
        responses: { 201: json(ref('Session'), 'Conta criada'), ...errors(409, 422, 429) },
      },
    },
    '/api/auth/login': {
      post: {
        tags: ['Autenticação'],
        summary: 'Entra e recebe os tokens de acesso',
        requestBody: body(
          { type: 'object', required: ['email', 'password'], properties: { email: { type: 'string' }, password: { type: 'string' } } },
          { email: 'demo@saldo.dev', password: 'demo123' },
        ),
        responses: { 200: json(ref('Session')), ...errors(401, 422, 429) },
      },
    },
    '/api/auth/refresh': {
      post: {
        tags: ['Autenticação'],
        summary: 'Troca o refresh token por um novo par de tokens (o antigo deixa de valer)',
        requestBody: body({ type: 'object', required: ['refreshToken'], properties: { refreshToken: { type: 'string' } } }),
        responses: { 200: json(ref('Session')), ...errors(401) },
      },
    },
    '/api/auth/logout': {
      post: {
        tags: ['Autenticação'],
        summary: 'Encerra a sessão (invalida o refresh token)',
        requestBody: body({ type: 'object', required: ['refreshToken'], properties: { refreshToken: { type: 'string' } } }),
        responses: { 204: noContent },
      },
    },
    '/api/auth/me': {
      get: { tags: ['Autenticação'], summary: 'Dados do usuário logado', security: secured, responses: { 200: json(ref('User')), ...errors(401) } },
    },
    '/api/accounts': {
      get: {
        tags: ['Contas'],
        summary: 'Lista as contas com saldo atual e previsto',
        security: secured,
        parameters: [q('includeArchived', { type: 'boolean' }, 'Incluir contas arquivadas')],
        responses: { 200: json({ type: 'array', items: ref('Account') }), ...errors(401) },
      },
      post: {
        tags: ['Contas'],
        summary: 'Cria uma conta',
        security: secured,
        requestBody: body(ref('AccountInput'), { name: 'Poupança', type: 'savings', initialBalanceCents: 50000 }),
        responses: { 201: json(ref('Account'), 'Criada'), ...errors(401, 422) },
      },
    },
    '/api/accounts/{id}': {
      get: { tags: ['Contas'], summary: 'Detalhe de uma conta', security: secured, parameters: [idPath], responses: { 200: json(ref('Account')), ...errors(401, 404) } },
      patch: {
        tags: ['Contas'],
        summary: 'Edita ou arquiva uma conta',
        security: secured,
        parameters: [idPath],
        requestBody: body(ref('AccountInput'), { archived: true }),
        responses: { 200: json(ref('Account')), ...errors(401, 404, 422) },
      },
      delete: {
        tags: ['Contas'],
        summary: 'Exclui uma conta sem lançamentos',
        security: secured,
        parameters: [idPath],
        responses: { 204: noContent, ...errors(401, 404, 409) },
      },
    },
    '/api/categories': {
      get: {
        tags: ['Categorias'],
        summary: 'Lista as categorias',
        security: secured,
        parameters: [q('type', { type: 'string', enum: ['income', 'expense'] }, 'Filtrar por tipo')],
        responses: { 200: json({ type: 'array', items: ref('Category') }), ...errors(401) },
      },
      post: {
        tags: ['Categorias'],
        summary: 'Cria uma categoria',
        security: secured,
        requestBody: body(ref('CategoryInput'), { name: 'Pets', type: 'expense', color: '#F59E0B', icon: 'paw-print' }),
        responses: { 201: json(ref('Category'), 'Criada'), ...errors(401, 409, 422) },
      },
    },
    '/api/categories/{id}': {
      patch: {
        tags: ['Categorias'],
        summary: 'Edita uma categoria',
        security: secured,
        parameters: [idPath],
        requestBody: body(ref('CategoryInput')),
        responses: { 200: json(ref('Category')), ...errors(401, 404, 409, 422) },
      },
      delete: {
        tags: ['Categorias'],
        summary: 'Exclui uma categoria sem lançamentos',
        security: secured,
        parameters: [idPath],
        responses: { 204: noContent, ...errors(401, 404, 409) },
      },
    },
    '/api/transactions': {
      get: {
        tags: ['Lançamentos'],
        summary: 'Lista lançamentos com filtros, paginação e totais',
        security: secured,
        parameters: [
          q('from', date, 'Data inicial'),
          q('to', date, 'Data final'),
          q('accountId', { type: 'integer' }, 'Conta'),
          q('categoryId', { type: 'integer' }, 'Categoria'),
          q('uncategorized', { type: 'boolean' }, 'Somente sem categoria'),
          q('type', { type: 'string', enum: ['income', 'expense'] }, 'Receita ou despesa'),
          q('paid', { type: 'boolean' }, 'false = somente pendentes'),
          q('search', { type: 'string' }, 'Busca na descrição'),
          q('includeTransfers', { type: 'boolean' }, 'false = esconder transferências'),
          q('page', { type: 'integer', default: 1 }, 'Página'),
          q('pageSize', { type: 'integer', default: 20, maximum: 100 }, 'Itens por página'),
          q('sort', { type: 'string', enum: ['date', '-date', 'amount', '-amount'], default: '-date' }, 'Ordenação (- = decrescente)'),
        ],
        responses: { 200: json(ref('TransactionPage')), ...errors(401, 422) },
      },
      post: {
        tags: ['Lançamentos'],
        summary: 'Cria uma receita ou despesa (opcionalmente parcelada)',
        security: secured,
        requestBody: body(ref('TransactionInput'), {
          type: 'expense',
          amountCents: 120000,
          description: 'Celular novo',
          date: '2026-11-14',
          accountId: 3,
          categoryId: 14,
          installments: 6,
        }),
        responses: {
          201: json(
            {
              oneOf: [
                ref('Transaction'),
                {
                  type: 'object',
                  properties: {
                    installmentGroup: { type: 'string', format: 'uuid' },
                    totalCents: { type: 'integer' },
                    transactions: { type: 'array', items: ref('Transaction') },
                  },
                },
              ],
            },
            'Criado (com parcelas, retorna a lista de parcelas)',
          ),
          ...errors(401, 404, 422),
        },
      },
    },
    '/api/transactions/export': {
      get: {
        tags: ['Lançamentos'],
        summary: 'Exporta os lançamentos filtrados em CSV (abre no Excel)',
        security: secured,
        parameters: [q('from', date, 'Data inicial'), q('to', date, 'Data final'), q('accountId', { type: 'integer' }, 'Conta')],
        responses: { 200: { description: 'Arquivo CSV', content: { 'text/csv': { schema: { type: 'string' } } } }, ...errors(401) },
      },
    },
    '/api/transactions/{id}': {
      get: { tags: ['Lançamentos'], summary: 'Detalhe de um lançamento', security: secured, parameters: [idPath], responses: { 200: json(ref('Transaction')), ...errors(401, 404) } },
      patch: {
        tags: ['Lançamentos'],
        summary: 'Edita um lançamento (ex.: marcar como pago)',
        security: secured,
        parameters: [idPath],
        requestBody: body(ref('TransactionInput'), { paid: true }),
        responses: { 200: json(ref('Transaction')), ...errors(401, 404, 409, 422) },
      },
      delete: {
        tags: ['Lançamentos'],
        summary: 'Exclui um lançamento',
        security: secured,
        parameters: [
          idPath,
          q('scope', { type: 'string', enum: ['one', 'future', 'all'], default: 'one' }, 'Para parcelas: só esta, esta e as próximas, ou todas'),
        ],
        responses: { 204: noContent, ...errors(401, 404) },
      },
    },
    '/api/transfers': {
      post: {
        tags: ['Transferências'],
        summary: 'Transfere entre duas contas suas',
        security: secured,
        requestBody: body(
          {
            type: 'object',
            required: ['fromAccountId', 'toAccountId', 'amountCents', 'date'],
            properties: {
              fromAccountId: { type: 'integer' },
              toAccountId: { type: 'integer' },
              amountCents: { type: 'integer' },
              date,
              description: { type: 'string' },
            },
          },
          { fromAccountId: 1, toAccountId: 4, amountCents: 50000, date: '2026-11-14' },
        ),
        responses: { 201: json({ type: 'object' }, 'Transferência criada'), ...errors(401, 404, 422) },
      },
    },
    '/api/budgets': {
      get: {
        tags: ['Orçamentos'],
        summary: 'Orçamentos do mês com gasto, saldo e status',
        security: secured,
        parameters: [q('month', { type: 'string', example: '2026-11' }, 'Mês (padrão: atual)')],
        responses: {
          200: json({
            type: 'object',
            properties: {
              month: { type: 'string' },
              totalLimitCents: { type: 'integer' },
              totalSpentCents: { type: 'integer' },
              percentUsed: { type: 'number' },
              alerts: { type: 'integer' },
              budgets: { type: 'array', items: ref('Budget') },
            },
          }),
          ...errors(401),
        },
      },
      post: {
        tags: ['Orçamentos'],
        summary: 'Define um limite mensal para uma categoria de despesa',
        security: secured,
        requestBody: body(
          { type: 'object', required: ['categoryId', 'amountCents'], properties: { categoryId: { type: 'integer' }, amountCents: { type: 'integer' } } },
          { categoryId: 6, amountCents: 80000 },
        ),
        responses: { 201: json({ type: 'object' }, 'Criado'), ...errors(401, 404, 409, 422) },
      },
    },
    '/api/budgets/{id}': {
      patch: {
        tags: ['Orçamentos'],
        summary: 'Altera o limite',
        security: secured,
        parameters: [idPath],
        requestBody: body({ type: 'object', required: ['amountCents'], properties: { amountCents: { type: 'integer' } } }),
        responses: { 200: json({ type: 'object' }), ...errors(401, 404, 422) },
      },
      delete: { tags: ['Orçamentos'], summary: 'Remove o orçamento', security: secured, parameters: [idPath], responses: { 204: noContent, ...errors(401, 404) } },
    },
    '/api/goals': {
      get: { tags: ['Metas'], summary: 'Lista as metas com progresso', security: secured, responses: { 200: json({ type: 'array', items: ref('Goal') }), ...errors(401) } },
      post: {
        tags: ['Metas'],
        summary: 'Cria uma meta',
        security: secured,
        requestBody: body(
          {
            type: 'object',
            required: ['name', 'targetCents'],
            properties: { name: { type: 'string' }, targetCents: { type: 'integer' }, savedCents: { type: 'integer' }, deadline: date, color: { type: 'string' } },
          },
          { name: 'Viagem', targetCents: 500000, deadline: '2027-07-01' },
        ),
        responses: { 201: json(ref('Goal'), 'Criada'), ...errors(401, 422) },
      },
    },
    '/api/goals/{id}': {
      patch: {
        tags: ['Metas'],
        summary: 'Edita uma meta',
        security: secured,
        parameters: [idPath],
        requestBody: body({ type: 'object' }),
        responses: { 200: json(ref('Goal')), ...errors(401, 404, 422) },
      },
      delete: { tags: ['Metas'], summary: 'Exclui uma meta', security: secured, parameters: [idPath], responses: { 204: noContent, ...errors(401, 404) } },
    },
    '/api/goals/{id}/deposits': {
      post: {
        tags: ['Metas'],
        summary: 'Guarda (valor positivo) ou retira (negativo) dinheiro da meta',
        security: secured,
        parameters: [idPath],
        requestBody: body({ type: 'object', required: ['amountCents'], properties: { amountCents: { type: 'integer' } } }, { amountCents: 25000 }),
        responses: { 200: json(ref('Goal')), ...errors(401, 404, 422) },
      },
    },
    '/api/reports/summary': {
      get: {
        tags: ['Relatórios'],
        summary: 'Resumo do mês: entradas, saídas, sobra, taxa de economia e comparação com o mês anterior',
        security: secured,
        parameters: [q('month', { type: 'string', example: '2026-11' }, 'Mês (padrão: atual)')],
        responses: { 200: json({ type: 'object' }), ...errors(401, 422) },
      },
    },
    '/api/reports/by-category': {
      get: {
        tags: ['Relatórios'],
        summary: 'Total e percentual por categoria (ideal para gráfico de pizza)',
        security: secured,
        parameters: [
          q('from', date, 'Data inicial (padrão: início do mês)'),
          q('to', date, 'Data final (padrão: fim do mês)'),
          q('type', { type: 'string', enum: ['income', 'expense'], default: 'expense' }, 'Tipo'),
        ],
        responses: { 200: json({ type: 'array', items: { type: 'object' } }), ...errors(401, 422) },
      },
    },
    '/api/reports/cash-flow': {
      get: {
        tags: ['Relatórios'],
        summary: 'Entradas e saídas mês a mês, com saldo acumulado',
        security: secured,
        parameters: [
          q('months', { type: 'integer', default: 12, maximum: 36 }, 'Quantos meses'),
          q('until', { type: 'string', example: '2026-11' }, 'Último mês (padrão: atual)'),
        ],
        responses: { 200: json({ type: 'array', items: { type: 'object' } }), ...errors(401, 422) },
      },
    },
  },
};
