/** Páginas HTML simples servidas pela própria API: apresentação (/) e documentação (/docs). */

const GITHUB_URL = 'https://github.com/Matheus0811/saldo-api';

const fonts =
  '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
  '<link href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">';

export function homePage(): string {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Saldo API: controle financeiro pessoal</title>
<meta name="description" content="API REST de controle financeiro em Node.js e TypeScript: contas, parcelas, orçamentos, metas e relatórios.">
${fonts}
<style>
  :root { --ink:#13212B; --ink-2:#4B5B66; --paper:#F7F5EF; --card:#FFFFFF; --line:#E3DED2; --green:#0F7B5F; --green-soft:#E1F1EA; --coral:#D9573B; }
  * { box-sizing: border-box; }
  body { margin:0; font-family:'Instrument Sans',system-ui,sans-serif; color:var(--ink); background:var(--paper); line-height:1.55; }
  main { max-width: 980px; margin: 0 auto; padding: 56px 24px 72px; }
  .brand { display:flex; align-items:center; gap:12px; font-weight:700; font-size:18px; }
  .mark { width:36px; height:36px; border-radius:10px; background:var(--ink); color:#fff; display:grid; place-items:center; font-family:'JetBrains Mono',monospace; font-size:16px; }
  h1 { font-size: clamp(36px, 6vw, 60px); line-height:1.02; letter-spacing:-0.03em; margin: 40px 0 16px; max-width: 14ch; }
  .lead { font-size:19px; color:var(--ink-2); max-width: 58ch; margin:0; }
  .actions { display:flex; flex-wrap:wrap; gap:12px; margin:32px 0 48px; }
  .btn { display:inline-flex; align-items:center; gap:8px; height:46px; padding:0 20px; border-radius:999px; font-weight:600; text-decoration:none; border:1px solid var(--ink); color:var(--ink); }
  .btn-primary { background:var(--ink); color:#fff; }
  .btn:hover { transform: translateY(-1px); }
  .grid { display:grid; grid-template-columns: 1.1fr 1fr; gap:20px; }
  .card { background:var(--card); border:1px solid var(--line); border-radius:18px; padding:24px; }
  .card h2 { font-size:15px; margin:0 0 14px; }
  pre { margin:0; background:var(--ink); color:#E8F1EC; border-radius:12px; padding:18px; overflow:auto; font: 13px/1.6 'JetBrains Mono',monospace; }
  pre .c { color:#7F9AA6; } pre .g { color:#7FD1B1; }
  .demo { display:flex; justify-content:space-between; gap:12px; padding:12px 14px; border-radius:12px; background:var(--green-soft); font-family:'JetBrains Mono',monospace; font-size:14px; margin-bottom:10px; }
  ul.endpoints { list-style:none; padding:0; margin:0; font-size:14px; }
  ul.endpoints li { display:flex; gap:10px; padding:8px 0; border-top:1px solid var(--line); }
  ul.endpoints li:first-child { border-top:0; }
  .verb { font: 600 11px/20px 'JetBrains Mono',monospace; padding:0 8px; border-radius:6px; background:var(--green-soft); color:var(--green); min-width:52px; text-align:center; }
  .verb.post { background:#FCE9E3; color:var(--coral); }
  .stack { display:flex; flex-wrap:wrap; gap:8px; margin-top:40px; }
  .stack span { border:1px solid var(--line); border-radius:999px; padding:6px 14px; font-size:14px; background:var(--card); }
  footer { margin-top:48px; color:var(--ink-2); font-size:14px; }
  footer a { color:inherit; }
  @media (max-width: 760px) { .grid { grid-template-columns: 1fr; } main { padding-top: 32px; } }
</style>
</head>
<body>
<main>
  <div class="brand"><span class="mark">R$</span> Saldo API</div>
  <h1>Controle financeiro pessoal, via API.</h1>
  <p class="lead">Contas, lançamentos parcelados, transferências, orçamentos com alerta, metas e relatórios. Feita em Node.js com TypeScript, PostgreSQL e testes automatizados.</p>
  <div class="actions">
    <a class="btn btn-primary" href="/docs">Abrir a documentação interativa</a>
    <a class="btn" href="${GITHUB_URL}">Ver o código no GitHub</a>
    <a class="btn" href="/api/health">Status da API</a>
  </div>
  <div class="grid">
    <section class="card">
      <h2>Teste em 30 segundos</h2>
      <pre><span class="c"># 1. Entre na conta de demonstração</span>
curl -X POST {URL}/api/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{"email":"demo@saldo.dev","password":"demo123"}'

<span class="c"># 2. Use o accessToken recebido</span>
curl {URL}/api/reports/summary \\
  -H "Authorization: Bearer <span class="g">SEU_TOKEN</span>"</pre>
    </section>
    <section class="card">
      <h2>Conta de demonstração</h2>
      <div class="demo"><span>e-mail</span><strong>demo@saldo.dev</strong></div>
      <div class="demo"><span>senha</span><strong>demo123</strong></div>
      <ul class="endpoints">
        <li><span class="verb">GET</span> /api/reports/summary <span style="color:var(--ink-2)">resumo do mês</span></li>
        <li><span class="verb">GET</span> /api/transactions <span style="color:var(--ink-2)">filtros e paginação</span></li>
        <li><span class="verb post">POST</span> /api/transactions <span style="color:var(--ink-2)">com parcelas</span></li>
        <li><span class="verb">GET</span> /api/budgets <span style="color:var(--ink-2)">alertas de gasto</span></li>
        <li><span class="verb">GET</span> /api/transactions/export <span style="color:var(--ink-2)">CSV para Excel</span></li>
      </ul>
    </section>
  </div>
  <div class="stack">
    <span>Node.js</span><span>TypeScript</span><span>Express 5</span><span>Drizzle ORM</span><span>PostgreSQL</span><span>Zod</span><span>JWT + refresh token</span><span>Vitest</span><span>OpenAPI</span><span>Docker</span><span>GitHub Actions</span>
  </div>
  <footer>Projeto de portfólio de <a href="https://github.com/Matheus0811">Matheus Galvão</a>.</footer>
</main>
<script>document.querySelectorAll('pre').forEach(function (el) { el.innerHTML = el.innerHTML.split('{URL}').join(location.origin); });</script>
</body>
</html>`;
}

export function docsPage(): string {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Documentação: Saldo API</title>
${fonts}
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css">
<style>
  body { margin:0; background:#F7F5EF; font-family:'Instrument Sans',system-ui,sans-serif; }
  .bar { display:flex; align-items:center; justify-content:space-between; padding:14px 24px; background:#13212B; color:#fff; }
  .bar a { color:#fff; text-decoration:none; font-weight:600; }
  .bar span { color:#9FB3BD; font-size:14px; }
  .swagger-ui .topbar { display:none; }
  .swagger-ui .info { margin: 32px 0; }
  .swagger-ui, .swagger-ui .info .title, .swagger-ui .opblock-tag { font-family:'Instrument Sans',system-ui,sans-serif; }
</style>
</head>
<body>
<div class="bar"><a href="/">R$ Saldo API</a><span>Login de teste: demo@saldo.dev / demo123</span></div>
<div id="swagger-ui"></div>
<script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
<script>
  window.ui = SwaggerUIBundle({
    url: '/openapi.json',
    dom_id: '#swagger-ui',
    persistAuthorization: true,
    tryItOutEnabled: true,
    docExpansion: 'list',
    defaultModelsExpandDepth: 0,
    displayRequestDuration: true,
  });
</script>
</body>
</html>`;
}
