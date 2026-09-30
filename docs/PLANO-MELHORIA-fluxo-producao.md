# Plano de Melhoria — Fluxo de Produção

> Histórico do protótipo HTML. Não descreve o sistema atual.
> O monorepo (React + API + SQLite) já entregou grafo, sessão, importação, cronoanálise e SSE.
> Plano vigente: `docs/PLANO-ATUAL.md`.

> Base original: análise de `fluxo-producao-diagrama.html` (1 arquivo, ~1.100 linhas, Vanilla JS, sem backend).
> Complementa o documento `STACK-fluxo-producao.md`.

---

## 1. Diagnóstico

### 1.1 O que já está bom (manter)
- Linguagem visual forte: tokens de cor por status, tema claro/escuro, animações de fluxo (pacotes luminosos, fio tracejado, pulso de alerta).
- Dois perfis com necessidades distintas (Gerência × Operador) e botões grandes para o chão de fábrica.
- Três visões (Fluxo, Lista, Diagrama) e drawer com timeline por etapa.
- Boa prática de performance: `patch()` atualiza barras sem recriar o DOM.
- Acessibilidade básica presente (`aria-pressed`, `aria-live`, `role="alert"`, foco visível).
- Schema SQL e payload JSON já embutidos como ponto de partida para o backend.

### 1.2 Problemas encontrados (verificados no código)

| # | Severidade | Problema | Onde / evidência |
|---|---|---|---|
| B1 | 🔴 Crítico | **Motor ignora as dependências.** A ordem avança por índice (`it.stage++`), não pelo grafo. O diagrama é só decorativo/configuração. | `advance()` |
| B2 | 🔴 Crítico | **Ordem linear contradiz o DAG.** Pelo índice a sequência é `…Tapeçaria(6) → Corte(7) → Costura(8) → Embalagem(9)`, mas Tapeçaria *depende* de Costura. | `STAGES` vs. `deps` |
| B3 | 🔴 Crítico | **Persistência perde `indep`.** Só `deps` é salvo. Ao recarregar, um setor original `indep:true` (CNC, Corte, Laminação, Marcenaria) que ganhou dependências volta como independente: fios somem e a porta de entrada não aparece. | `localStorage` + `drawWires` (`target.indep` return) |
| B4 | 🟠 Alto | **Re-render interrompe o drag.** O `tick` chama `renderAll()` quase todo segundo, que recria os nós do diagrama enquanto o usuário arrasta (perde o pointer capture). Também apaga o destaque visual da porta "conectando" (o `connectSource` permanece no estado, mas a UI não indica). | `tick()` → `renderDiagram()` |
| B5 | 🟠 Alto | **Sem detecção de ciclos.** Dá para criar A→B→A. | handler de conexão |
| B6 | 🟠 Alto | **XSS potencial.** `esc()` é usado só em parte dos campos; `prod`, `cliente`, `pedido` entram sem escape em várias templates. Com dados reais de API isso vira vulnerabilidade. | `card()`, `pcard()`, `renderDrawer()`… |
| B7 | 🟡 Médio | **IDs e índices "mágicos".** `stage===10` (CQ), `stage=8` (retorno à Costura), lista `['cnc','corte','laminacao','marcenaria']`, `OPERATORS[stage]`, legenda "4 Setores Independentes" fixa. | vários |
| B8 | 🟡 Médio | **Sem zoom/pan** no diagrama; canvas fixo em 1760 px. Não escala para muitos setores. | `.canvas-inner` |
| B9 | 🟡 Médio | **`confirm()` nativo** para remover fio e ausência de desfazer. | handler de `.wire-group` |
| B10 | 🟡 Médio | **Perfil de acesso só na UI.** Qualquer usuário troca para "Gerência" com um clique. | `setRole()` |
| B11 | 🟢 Baixo | Drag só funciona com ponteiro (sem alternativa por teclado no canvas). | `bindDiagramDragging` |
| B12 | 🟢 Baixo | Fontes externas (Google Fonts) — falha em fábrica sem internet. | `<link>` no head |
| B13 | 🟢 Baixo | Nenhum teste, nenhuma tipagem, arquivo monolítico. | — |

### 1.3 Lacunas de produto
- Sem backend, sem autenticação, sem tempo real de verdade (dados são simulados).
- Importação de planilha é mockada (tela fixa; não lê arquivo).
- Sem histórico/auditoria persistente, sem relatórios (OEE, lead time, gargalos), sem exportação.
- Sem notificações fora da tela (push, e-mail, WhatsApp) para paradas.
- Sem modo offline para o operador (tablet no chão de fábrica com Wi-Fi instável).

---

## 2. Objetivos do plano

1. **Corrigir a lógica**: o grafo passa a governar o fluxo de verdade.
2. **Estabilizar a UX**: nada de perder drag/estado por causa de re-render.
3. **Tornar o produto real**: backend, autenticação, tempo real e importação.
4. **Gerar valor gerencial**: métricas, gargalos e alertas.
5. **Sustentar**: código modular, tipado e testado.

### Metas mensuráveis (KPIs de sucesso)

| Indicador | Hoje | Meta |
|---|---|---|
| Ordens que respeitam dependências | 0% | 100% |
| Falhas de drag/conexão por re-render | frequentes | 0 |
| Latência de atualização (evento → tela) | até 1 s (polling simulado) | < 500 ms via WebSocket |
| Cobertura de testes | 0% | ≥ 70% na lógica de domínio |
| Campos com escape/sanitização | parcial | 100% |
| Tempo do operador para pausar/finalizar | — | ≤ 3 toques |
| Lighthouse (Acessibilidade / Performance) | não medido | ≥ 95 / ≥ 90 |

---

## 3. Roadmap por fases

```
Fase 0  Correções críticas no protótipo       ~2-3 dias
Fase 1  Fundação técnica (modularizar)         ~1-2 semanas
Fase 2  Backend + tempo real + auth            ~2-3 semanas
Fase 3  Diagrama profissional + regras         ~1-2 semanas
Fase 4  Valor gerencial (métricas/alertas)     ~2 semanas
Fase 5  Operação no chão de fábrica (PWA)      ~1-2 semanas
Fase 6  Qualidade, segurança e lançamento      contínuo
```
> Estimativas para 1 dev pleno; ajuste conforme equipe. Fases 3 e 4 podem rodar em paralelo à 2.

---

### Fase 0 — Correções críticas (quick wins)
**Objetivo:** eliminar bugs que quebram a experiência hoje, sem mudar arquitetura.

| Tarefa | Resolve | Esforço |
|---|---|---|
| Salvar/restaurar `indep` junto com `deps` e `x/y` num único objeto versionado | B3 | 1 h |
| Derivar `isIndep` sempre de `deps.length===0` (remover o flag `indep` como fonte de verdade) | B3, B7 | 1 h |
| Não chamar `renderDiagram()` no `tick`; atualizar só contadores e classe `flow-active` dos fios (`patchDiagram()`) | B4 | 3 h |
| Pausar re-render do diagrama enquanto `pointerdown` ativo (flag `state.dragging`) | B4 | 1 h |
| Reaplicar classe `.connecting` após qualquer render se `state.connectSource` existir | B4 | 30 min |
| Validar ciclo antes de `deps.push` (DFS) e mostrar toast de erro | B5 | 2 h |
| Aplicar `esc()` em **todos** os campos dinâmicos (ou helper de template `html\`\``) | B6 | 3 h |
| Trocar `stage===10` / `stage=8` por lookup por `id` (`'cq'`, `'costura'`) | B7 | 1 h |
| Trocar `confirm()` por modal próprio + botão "Desfazer" no toast | B9 | 3 h |
| Corrigir legenda dinâmica ("N setores independentes" calculado) | B7 | 30 min |

**Código de referência — detecção de ciclo:**
```js
function wouldCreateCycle(sourceId, targetId, stages){
  // Adicionar aresta source -> target cria ciclo se target já alcança source
  const deps = id => stages.find(s => s.id === id)?.deps ?? [];
  // "dependentes" de X = setores cujo deps inclui X
  const children = id => stages.filter(s => s.deps.includes(id)).map(s => s.id);
  const seen = new Set();
  const stack = [targetId];
  while (stack.length){
    const cur = stack.pop();
    if (cur === sourceId) return true;
    if (seen.has(cur)) continue;
    seen.add(cur);
    stack.push(...children(cur));
  }
  return false;
}
```

**Critério de aceite da Fase 0:** recarregar a página mantém exatamente o grafo editado; arrastar um nó por 10 s com simulação ligada nunca é interrompido; tentar A→B→A é bloqueado.

---

### Fase 1 — Fundação técnica
**Objetivo:** sair do arquivo único para um projeto sustentável, sem perder o visual.

**Decisão recomendada:** React 18 + TypeScript + Vite. (Alternativa mais leve: Svelte/SvelteKit ou manter Vanilla com módulos ES + Vite.)

Tarefas:
1. Estrutura de pastas:
   ```
   src/
     domain/     (tipos, regras puras: grafo, status, avanço)   ← sem UI
     features/   (track, board, diagram, drawer, operator, pauses)
     components/ (Button, Modal, Toast, Pill, Kpi)
     styles/     (tokens.css, animations.css, base.css)
     services/   (api, websocket)
     store/      (Zustand)
   ```
2. Extrair `tokens.css` e `animations.css` **sem alterar** os valores (preserva a identidade visual).
3. Tipar entidades: `Sector`, `Order`, `Pause`, `Status`, `Role`.
4. Isolar a lógica em funções puras testáveis: `canStart(order, graph)`, `nextSectors(order, graph)`, `detectCycle(graph)`, `computeBottlenecks(orders)`.
5. Lint + format (ESLint, Prettier), CI com type-check e testes.
6. Self-host das fontes (`@font-face`) — resolve B12.

**Critério de aceite:** paridade visual com o protótipo (comparação lado a lado) e testes unitários rodando no CI.

---

### Fase 2 — Backend, tempo real e segurança
**Objetivo:** dados reais e persistentes.

**Stack sugerido:** Node (Fastify/NestJS) ou Python (FastAPI) + PostgreSQL + Prisma/Drizzle. Alternativa rápida: Supabase (Postgres + Auth + Realtime).

1. **Modelagem** — partir do schema embutido e **adicionar**:
   - `pauses` (ordem, setor, motivo, observação, autor, estado: novo/visto/tratada, timestamps)
   - `activity_log` (auditoria imutável: quem, o quê, quando)
   - `users` + `roles` + vínculo operador↔setor
   - `batches` (lotes) e `import_jobs`
   - `sector_dependencies` com restrição contra auto-referência e checagem de ciclo na API
2. **API** — endpoints da seção 8.2 do documento de stack + paginação e filtros server-side.
3. **Tempo real** — WebSocket/SSE com eventos: `order.updated`, `order.paused`, `sector.updated`, `graph.updated`. O cliente aplica o evento no store (sem re-render global).
4. **Autenticação e autorização (resolve B10)** — login, JWT/sessão, papéis. Operador só enxerga/escreve no próprio setor; interrupção e edição do grafo só para Gerência (validado **no servidor**).
5. **Importação real (xlsx)** — upload, validação de colunas, pré-visualização com erros por linha, confirmação e criação transacional das OPs.
6. **Segurança**: escape/sanitização, validação com Zod/Pydantic, rate limit, CORS restrito, CSP, logs de auditoria.

**Critério de aceite:** dois navegadores abertos veem a mesma OP mudar em < 500 ms; operador não consegue chamar endpoint de gerência.

---

### Fase 3 — Diagrama profissional e regras de fluxo
**Objetivo:** o grafo governa a produção (resolve B1, B2, B8, B11).

1. **Regra central de negócio:** uma OP só pode **iniciar** num setor quando **todos** os pré-requisitos (`deps`) estiverem concluídos *para aquela OP*. Modelar progresso por **(OP × setor)**, não por um único `stage`:
   ```
   order_sector_progress(order_id, sector_id, status, progress, started_at, finished_at)
   ```
   Isso permite paralelismo real (CNC, Corte, Laminação e Marcenaria em simultâneo) e junção em setores com múltiplas dependências (Tapeçaria).
2. **Reconciliar B2:** definir a ordem visual/track a partir da **ordenação topológica** do grafo, não do índice do array.
3. **Migrar o canvas para React Flow** (ou equivalente): zoom, pan, minimap, seleção múltipla, snap-to-grid, auto-layout (dagre/elk) e "redefinir posições".
4. **Manter as animações** originais como CSS nas edges e nós (fio tracejado animado, pulso de alerta).
5. **Alternativa por teclado** para criar/remover dependências (B11) e labels ARIA nos nós.
6. **Modo edição × modo leitura** no diagrama, com "Desfazer/Refazer" e confirmação de publicação do grafo (versionar o grafo: `graph_versions`).
7. **Retrabalho configurável:** o retorno do CQ para outro setor passa a ser uma regra editável (aresta de "retrabalho"), não código fixo.

**Critério de aceite:** simular 20 OPs e verificar que nenhuma entra em setor com pré-requisito pendente; arrastar/zoom fluido com 50+ nós.

---

### Fase 4 — Valor gerencial
**Objetivo:** transformar acompanhamento em decisão.

| Entrega | Detalhe |
|---|---|
| **Gargalos** | Setor com maior fila × tempo médio; destaque no track |
| **Lead time e tempo por etapa** | Já existe `hist` no protótipo — persistir e agregar |
| **Análise de paradas** | Pareto de motivos e setores (hoje só top 4 no painel) |
| **Previsão de atraso** | Comparar prazo × ritmo atual; sinalizar OPs em risco |
| **OEE simplificado** | Disponibilidade, desempenho e qualidade por setor |
| **Retrabalho** | Taxa de reprovação do CQ por produto/lote |
| **Exportação** | CSV/XLSX/PDF de relatórios |
| **Alertas externos** | Parada > X minutos → push / e-mail / WhatsApp / Telegram, com escalonamento |
| **Metas** | Peças/hora planejadas × realizadas |

**Critério de aceite:** gerente identifica o gargalo do dia em até 10 s e recebe alerta fora do sistema em < 1 min após uma parada.

---

### Fase 5 — Operação no chão de fábrica
**Objetivo:** uso confiável em tablet/celular na linha.

1. **PWA** (instalável, ícone, tela cheia).
2. **Modo offline com fila de sincronização** (IndexedDB + background sync): operador aponta peças sem internet; ao reconectar, envia em ordem, com resolução de conflito (último evento por timestamp do servidor).
3. **Ergonomia industrial:** alvos de toque ≥ 56 px, alto contraste, modo "luvas", feedback sonoro/vibração.
4. **Login rápido por crachá/PIN/QR** (evita digitar senha).
5. **Leitura de código de barras/QR da OP** pela câmera para abrir a ordem.
6. **Modo TV** (Andon board): tela fullscreen só com track + alertas, auto-rotativa, para monitor na fábrica.
7. **Internacionalização** (pt-BR padrão; estrutura pronta para es/en).

**Critério de aceite:** operador conclui um turno simulado sem internet e os dados sincronizam sem duplicar.

---

### Fase 6 — Qualidade, segurança e lançamento (contínuo)

| Área | Ações |
|---|---|
| **Testes** | Unitários da lógica de domínio (Vitest), componentes (Testing Library), E2E (Playwright): pausar, finalizar, conectar setores, importar, perfil operador |
| **Acessibilidade** | Auditoria WCAG 2.2 AA, navegação por teclado completa, teste com leitor de tela, contraste dos status (não depender só de cor: já há texto, manter ícones/formas) |
| **Performance** | Virtualização de listas grandes, `React.memo`/selectors granulares, budget de bundle, medir com Lighthouse/Web Vitals |
| **Observabilidade** | Sentry (erros), logs estruturados, métricas de API, healthchecks |
| **Segurança** | Revisão OWASP Top 10, dependências (Dependabot), backups do banco, política de retenção/LGPD para dados de operadores |
| **DevOps** | Ambientes dev/staging/prod, migrations versionadas, deploy automatizado, rollback |
| **Documentação** | README, ADRs (decisões de arquitetura), guia de operação para usuários |

---

## 4. Priorização (matriz impacto × esforço)

| Prioridade | Itens | Motivo |
|---|---|---|
| **P0 — fazer já** | B3 (persistência), B4 (drag/re-render), B5 (ciclos), B6 (XSS), B7 (IDs mágicos) | Corrigem bugs reais com esforço baixo |
| **P1 — próximo** | Fase 1 (modularização) + regra de dependências (B1/B2) | Base para tudo e corrige a inconsistência central |
| **P2 — valor de produto** | Fase 2 (backend, auth, tempo real) + importação real | Torna o sistema utilizável de verdade |
| **P3 — diferencial** | Fase 4 (métricas/alertas) + Fase 5 (PWA/offline) | Retorno gerencial e adoção no chão de fábrica |
| **P4 — refinamento** | Zoom/minimap, i18n, modo TV, OEE avançado | Polimento |

---

## 5. Riscos e mitigação

| Risco | Impacto | Mitigação |
|---|---|---|
| Regra de dependência muda a lógica que a fábrica já entende (fluxo linear → paralelo) | Alto | Validar o grafo real com a gerência e operadores antes da Fase 3; rodar em paralelo com o fluxo linear por 1–2 semanas (feature flag) |
| Migração de framework alterar o visual | Médio | Extrair tokens/animações intactos; teste visual (screenshots) lado a lado |
| Conectividade ruim no chão de fábrica | Alto | Offline-first na Fase 5; testar com throttling de rede |
| Adoção baixa pelos operadores | Alto | Testes de usabilidade com 2–3 operadores por fase; interface mínima (3 botões) |
| Escopo crescer (MES completo) | Médio | Manter fases entregáveis; definir "fora de escopo" (ex.: estoque, custos) |
| Dados sensíveis de operadores (LGPD) | Médio | Minimizar dados, controle de acesso, retenção definida |

---

## 6. Perguntas a validar com o negócio (antes da Fase 3)

1. O fluxo real é de fato **paralelo com junção** (como o grafo sugere) ou sequencial por lote?
2. Uma OP pode ser **dividida** (parte das peças segue, parte fica)? Como tratar quantidades parciais entre setores?
3. Quais são as **regras de retrabalho** (para onde volta cada reprovação)?
4. Quem pode **editar o grafo** e com que aprovação?
5. Existe **ERP/PCP** para integrar (em vez de importar planilha)?
6. Quais **alertas** são obrigatórios e para quem (por setor, por turno)?
7. Há **turnos e calendário** (paradas programadas, feriados) que afetam os prazos?

---

## 7. Sugestão de sprints (2 semanas cada)

| Sprint | Entrega principal |
|---|---|
| 1 | Fase 0 completa + início da Fase 1 (tokens, tipos, testes de domínio) |
| 2 | Fase 1 concluída (app modular com paridade visual) |
| 3 | Backend base: banco, API de setores/ordens, auth |
| 4 | Tempo real + pausas/auditoria + importação xlsx |
| 5 | Regra de dependências (OP × setor) + React Flow |
| 6 | Gargalos, análise de paradas, alertas externos |
| 7 | PWA + offline + modo TV |
| 8 | Hardening: testes E2E, acessibilidade, segurança, deploy |

---

## 8. Definição de pronto (DoD) geral

- Regras de negócio cobertas por testes automatizados.
- Sem `innerHTML` com dados não escapados.
- Acessível por teclado e com contraste AA nas telas alteradas.
- Sem regressão visual nos componentes migrados.
- Migrations versionadas e reversíveis.
- Documentação atualizada (README + ADR quando houver decisão relevante).

---

## 9. Próximo passo imediato

Executar a **Fase 0** (≈ 2–3 dias) no próprio arquivo HTML: é barata, elimina os bugs B3/B4/B5/B6/B7 e não depende de nenhuma decisão de arquitetura. Em paralelo, levar a seção 6 (perguntas) para a gerência, pois as respostas definem o desenho da Fase 3.

*Gerado a partir da análise de `fluxo-producao-diagrama.html`.*
