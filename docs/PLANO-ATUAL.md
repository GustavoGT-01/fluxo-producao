# Plano atual — Fluxo de Produção

O app que sobe com `pnpm dev` é o monorepo React + Fastify + SQLite. O arquivo `PLANO-MELHORIA-fluxo-producao.md` descreve o HTML único e fica só como histórico.

## Já vale

- Progresso por setor (`progressBySector`) e `canStart`
- Ciclo bloqueado antes de gravar a aresta
- Sessão em cookie, operador recebe 403 fora do próprio setor
- Importação de planilha, cronoanálise e SSE (`live.ts`)

## Ordem

1. CI cobre a API. Docs apontam para este arquivo.
2. Grafo, crono e gargalo moram em `packages/shared`.
3. Pausa respeita `canStart`. Migração versionada (`schema_migrations`, coluna `users.updated_at`). Fora de desenvolvimento, `AUTH_SECRET` é obrigatório. CSP na API. Limite de taxa nas rotas, mais apertado no login.
4. Demo avisa que não grava. Diagrama mostra o operador cadastrado no setor. Gargalo multiplica fila pelo tempo medido quando há amostra.
5. Playwright: login da gerência, login por PIN, pausar, concluir, importar planilha com erro. Pan no diagrama. PWA com ícone. Fila local quando a rede cai (`fluxo-outbox`). Webhook `ALERT_WEBHOOK_URL` na parada nova. CSV em `GET /api/export/orders.csv`.

Fora: redesenho visual de KPI, tabela e trilho. A regra de início do setor não muda.
