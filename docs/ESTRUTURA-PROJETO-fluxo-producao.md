# Como Estruturar o Projeto (sem um único HTML)

> Guia histórico da saída do HTML único. O repositório já é o monorepo `apps/web` + `apps/api` + `packages/shared`.
> A regra de negócio vigente está no código (`domain`, `@fluxo/shared`) e em `docs/PLANO-ATUAL.md`, não neste passo a passo.

> Guia original para sair do `fluxo-producao-diagrama.html` (HTML + CSS + JS num arquivo só).
> Complementa `STACK-fluxo-producao.md`. O plano antigo do protótipo está em `PLANO-MELHORIA-fluxo-producao.md` (histórico).

---

## 1. Por que separar

O arquivo atual mistura tudo: tokens de design, CSS de 15 componentes, dados fake, regras de negócio, renderização e eventos. Consequências:

- Não dá para **testar** a regra de negócio sem abrir o navegador.
- Qualquer mudança no CSS ou no JS exige mexer num arquivo de 1.100 linhas.
- Não há como **reaproveitar** partes (ex.: só o diagrama) em outro projeto.
- Impossível trabalhar em duas pessoas sem conflito.
- Não existe fronteira entre o que é **UI** e o que é **regra de negócio**, o que gerou bugs como o motor ignorar as dependências do grafo.

**Princípio guia:** separar em 4 camadas, com dependência em uma só direção.

```
   UI (componentes)  ──►  Estado (store)  ──►  Serviços (API/WS)
          │                     │
          └─────────►  Domínio (regras puras, sem UI, sem fetch)  ◄─────────┘
```

O **domínio** não importa nada de React, DOM ou rede. É a camada mais importante e a mais fácil de testar.

---

## 2. Decisão de stack (escolha uma)

| Opção | Quando escolher | Trade-off |
|---|---|---|
| **A. React + TypeScript + Vite** *(recomendada)* | Produto real, equipe, diagrama com React Flow | Curva maior, mas melhor ecossistema |
| **B. Vue 3 + TypeScript + Vite** | Time já usa Vue (Vue Flow existe) | Ecossistema um pouco menor |
| **C. Vanilla + módulos ES + Vite** | Quer manter o código atual com mudança mínima | Continua com `innerHTML` e re-render manual |

O restante deste guia usa **A** e mostra a variação para **C** na seção 12.

---

## 3. Estrutura de pastas (monorepo)

```
fluxo-producao/
├─ apps/
│  ├─ web/                          # Frontend (React + Vite)
│  │  ├─ public/
│  │  │  ├─ fonts/                  # Bricolage Grotesque, Figtree (self-host)
│  │  │  ├─ icons/                  # ícones PWA
│  │  │  └─ manifest.webmanifest
│  │  ├─ src/
│  │  │  ├─ main.tsx                # ponto de entrada
│  │  │  ├─ App.tsx                 # rotas e layout raiz
│  │  │  ├─ styles/
│  │  │  │  ├─ tokens.css           # variáveis (cores, fontes, sombras)
│  │  │  │  ├─ themes.css           # claro / escuro / [data-theme]
│  │  │  │  ├─ animations.css       # todos os @keyframes
│  │  │  │  ├─ base.css             # reset, body, foco, tipografia
│  │  │  │  └─ index.css            # importa os anteriores
│  │  │  ├─ domain/                 # ★ regras puras (sem React)
│  │  │  │  ├─ types.ts
│  │  │  │  ├─ constants.ts
│  │  │  │  ├─ graph.ts
│  │  │  │  ├─ orders.ts
│  │  │  │  ├─ metrics.ts
│  │  │  │  └─ __tests__/
│  │  │  ├─ services/
│  │  │  │  ├─ api.ts
│  │  │  │  ├─ realtime.ts
│  │  │  │  └─ simulator.ts         # o antigo tick(), só para demo/dev
│  │  │  ├─ store/
│  │  │  │  ├─ useOrdersStore.ts
│  │  │  │  ├─ useGraphStore.ts
│  │  │  │  ├─ useUiStore.ts
│  │  │  │  └─ selectors.ts
│  │  │  ├─ components/             # UI genérica e reutilizável
│  │  │  │  ├─ Button/
│  │  │  │  ├─ Modal/
│  │  │  │  ├─ Drawer/
│  │  │  │  ├─ Toast/
│  │  │  │  ├─ Pill/
│  │  │  │  ├─ ProgressBar/
│  │  │  │  └─ SegmentedControl/
│  │  │  ├─ features/               # telas e blocos de negócio
│  │  │  │  ├─ header/
│  │  │  │  ├─ kpis/
│  │  │  │  ├─ track/
│  │  │  │  ├─ board/
│  │  │  │  ├─ orders-table/
│  │  │  │  ├─ diagram/
│  │  │  │  ├─ order-drawer/
│  │  │  │  ├─ pauses/
│  │  │  │  ├─ operator/
│  │  │  │  ├─ import/
│  │  │  │  └─ activity-feed/
│  │  │  ├─ hooks/
│  │  │  ├─ utils/
│  │  │  ├─ i18n/
│  │  │  └─ mocks/                  # dados fake (antigo PRODS, LOTES…)
│  │  ├─ index.html
│  │  ├─ vite.config.ts
│  │  ├─ tsconfig.json
│  │  └─ package.json
│  │
│  └─ api/                          # Backend (Node + Fastify, ou NestJS)
│     ├─ src/
│     │  ├─ server.ts
│     │  ├─ modules/
│     │  │  ├─ sectors/
│     │  │  ├─ orders/
│     │  │  ├─ pauses/
│     │  │  ├─ batches/
│     │  │  ├─ auth/
│     │  │  └─ realtime/
│     │  ├─ db/
│     │  │  ├─ schema.ts            # Drizzle/Prisma
│     │  │  └─ migrations/
│     │  └─ plugins/
│     ├─ test/
│     └─ package.json
│
├─ packages/
│  └─ shared/                       # tipos e regras usados por web E api
│     ├─ src/
│     │  ├─ types.ts
│     │  ├─ graph.ts                # detecção de ciclo, ordenação topológica
│     │  └─ schemas.ts              # Zod (validação compartilhada)
│     └─ package.json
│
├─ e2e/                             # Playwright
├─ docs/
│  ├─ adr/                          # decisões de arquitetura
│  └─ *.md
├─ .github/workflows/ci.yml
├─ .editorconfig
├─ .eslintrc.cjs
├─ .prettierrc
├─ package.json                     # workspaces (pnpm)
├─ pnpm-workspace.yaml
└─ README.md
```

> **Começando pequeno?** Se for só o frontend por agora, crie apenas `apps/web` e deixe `packages/shared` e `apps/api` para depois. A organização interna de `src/` é a mesma.

---

## 4. De onde vem cada pedaço (mapa do HTML atual → arquivos)

| Trecho do HTML original | Vai para |
|---|---|
| `:root{ --bg… --brand… }` | `styles/tokens.css` |
| `@media (prefers-color-scheme:dark)` e `[data-theme="dark"]` | `styles/themes.css` |
| Todos os `@keyframes` (`ping`, `travel`, `alertpulse`, `wireflow`, `portpulse`, `ring`, `drop`…) | `styles/animations.css` |
| `*{box-sizing}`, `body`, `:focus-visible` | `styles/base.css` |
| `.btn`, `.pill`, `.bar`, `.toast`, `.modal`, `.drawer`, `.seg` | `components/*` (cada um com seu CSS Module) |
| `.kpi`, `.kpis` + `renderKPIs()` | `features/kpis/` |
| `.track`, `.node`, `.orb`, `.conn`, `.dot` + `renderTrack()` | `features/track/` |
| `.board`, `.col`, `.card` + `renderBoard()` | `features/board/` |
| `.tbl` + `renderTable()` | `features/orders-table/` |
| `.diagram-*`, `.d-node`, `.d-port`, `.d-path` + `renderDiagram()`, `drawWires()`, `bindDiagramDragging()`, `openSectorConfig()` | `features/diagram/` |
| `.drawer` + `renderDrawer()`, `action()` | `features/order-drawer/` |
| `registerPause()`, `renderBell()`, `showAlert()`, `pcard()`, `renderNotif()`, `openPauseModal()` | `features/pauses/` |
| `opCard()`, `renderOperator()` | `features/operator/` |
| `openImport()`, `doImport()` | `features/import/` |
| `renderFeed()`, `log()` | `features/activity-feed/` |
| `openDbSchemaModal()` | `docs/` (SQL) e, se quiser manter na UI, `features/diagram/DbSchemaModal.tsx` |
| `STAGES` | dados do backend (`sectors`), com `mocks/sectors.ts` para dev |
| `PRODS`, `LOTES`, `REASONS`, `OPERATORS`, `CLIENTES` | `mocks/` (dev) e tabelas no backend (`REASONS` vira tabela de motivos de parada) |
| `mk()`, PRNG `rnd()` | `mocks/orderFactory.ts` |
| `tick()`, `advance()`, `simFor()` | `services/simulator.ts` (demo) + regra pura em `domain/orders.ts` |
| `state` global | `store/useUiStore.ts`, `useOrdersStore.ts`, `useGraphStore.ts` |
| `localStorage` de posições/deps | API (`PATCH /sectors/:id`) + fallback local em `store/persist` |
| `vis()` (filtros) | `domain/orders.ts` (`filterOrders`) + `store/selectors.ts` |
| `esc()` | não é mais necessário no React (escape automático); manter só para HTML bruto |

---

## 5. Camada de domínio (o coração)

Funções **puras**: recebem dados, devolvem dados, sem efeito colateral. É aqui que se corrige o bug de o grafo não governar o fluxo.

### 5.1 `domain/types.ts`
```ts
export type Status = 'run' | 'wait' | 'pause' | 'stop' | 'done';
export type Role = 'manager' | 'operator';

export interface Sector {
  id: string;            // 'cnc', 'tapecaria'…
  name: string;
  icon: string;
  color: string;
  deps: string[];        // ids dos pré-requisitos (arestas do DAG)
  pos: { x: number; y: number };
}

export interface SectorProgress {
  sectorId: string;
  status: Status;
  progress: number;      // 0–100
  startedAt?: string;
  finishedAt?: string;
}

export interface Order {
  id: string;            // 'OP-4820'
  product: string;
  quantity: number;
  batch: string;
  client: string;
  orderCode: string;
  urgent: boolean;
  dueDate: string;       // ISO
  progressBySector: Record<string, SectorProgress>;
}

export interface Pause {
  id: string;
  orderId: string;
  sectorId: string;
  reason: string;
  note?: string;
  by: string;
  at: string;
  state: 'new' | 'seen' | 'handled';
}
```
> Note a mudança conceitual: em vez de um único `stage: number`, o progresso é **por setor**. Isso permite paralelismo real (CNC, Corte, Laminação e Marcenaria ao mesmo tempo) e junção (Tapeçaria).

### 5.2 `domain/graph.ts`
```ts
import type { Sector } from './types';

export function wouldCreateCycle(sectors: Sector[], from: string, to: string): boolean {
  const children = (id: string) => sectors.filter(s => s.deps.includes(id)).map(s => s.id);
  const seen = new Set<string>();
  const stack = [to];
  while (stack.length) {
    const cur = stack.pop()!;
    if (cur === from) return true;
    if (seen.has(cur)) continue;
    seen.add(cur);
    stack.push(...children(cur));
  }
  return false;
}

/** Ordenação topológica (Kahn) — define a ordem visual do track. */
export function topoSort(sectors: Sector[]): string[] {
  const indeg = new Map(sectors.map(s => [s.id, s.deps.length]));
  const queue = sectors.filter(s => s.deps.length === 0).map(s => s.id);
  const out: string[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    out.push(id);
    sectors.filter(s => s.deps.includes(id)).forEach(s => {
      indeg.set(s.id, indeg.get(s.id)! - 1);
      if (indeg.get(s.id) === 0) queue.push(s.id);
    });
  }
  if (out.length !== sectors.length) throw new Error('Grafo com ciclo');
  return out;
}

export const isIndependent = (s: Sector) => s.deps.length === 0;
```

### 5.3 `domain/orders.ts`
```ts
import type { Order, Sector } from './types';

/** Uma OP só pode iniciar num setor se TODOS os pré-requisitos estiverem concluídos. */
export function canStart(order: Order, sector: Sector): boolean {
  return sector.deps.every(d => order.progressBySector[d]?.status === 'done');
}

export function availableSectors(order: Order, sectors: Sector[]): Sector[] {
  return sectors.filter(s => {
    const p = order.progressBySector[s.id];
    return (!p || p.status !== 'done') && canStart(order, s);
  });
}

export function isOrderDone(order: Order, finalSectorId: string) {
  return order.progressBySector[finalSectorId]?.status === 'done';
}
```

### 5.4 Testes do domínio (Vitest) — o que impede regressão
```ts
it('bloqueia ciclo A→B→A', () => { /* wouldCreateCycle === true */ });
it('Tapeçaria só inicia com Preparação, Espumação e Costura concluídas', () => { /* canStart */ });
it('setores independentes iniciam sem pré-requisitos', () => { /* canStart === true */ });
```

---

## 6. Design system em CSS (extraído sem alterar valores)

### 6.1 `styles/tokens.css`
```css
:root {
  --bg:#EBEFF5; --surface:#FFFFFF; --surface2:#F4F6FA;
  --ink:#172037; --muted:#63708A; --line:#DCE2EC;
  --brand:#2A4DE0; --brand-ink:#FFFFFF;

  --run:#0E9F73; --wait:#6F7FA0; --pause:#D9950B; --stop:#DC3F4A; --done:#7357E6;

  --track:#132043; --track-line:#2B3B6B; --track-ink:#E8EDFF;
  --shadow:0 1px 2px rgba(23,32,55,.06),0 6px 18px rgba(23,32,55,.05);

  --font-h:"Bricolage Grotesque","Segoe UI",system-ui,sans-serif;
  --font-b:"Figtree","Segoe UI",system-ui,sans-serif;
}
```

### 6.2 `styles/themes.css`
```css
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) { --bg:#0C1224; --surface:#151E38; /* … */ }
}
:root[data-theme="dark"] { --bg:#0C1224; --surface:#151E38; /* … */ }
```

### 6.3 Fontes em `public/fonts` (self-host)
```css
@font-face {
  font-family: "Figtree";
  src: url("/fonts/Figtree-Variable.woff2") format("woff2");
  font-weight: 400 600; font-display: swap;
}
```

### 6.4 Convenção de estilos por componente
- **CSS Modules** (`Button.module.css`) ou **Tailwind** usando os tokens como tema.
- Cores de status **sempre** via variável (`var(--run)`), nunca hex solto.
- Variação por instância via custom property (`style={{'--nc': sector.color}}`), como o original já faz.

---

## 7. Estado (store)

Exemplo com **Zustand** (leve, sem boilerplate):

```ts
// store/useUiStore.ts
export const useUiStore = create<UiState>()(persist((set) => ({
  role: 'manager',
  view: 'board',
  filters: { status: new Set<Status>(), batch: '', query: '', urgentOnly: false, sector: null },
  setView: (view) => set({ view }),
  toggleStatus: (s) => set(st => { /* … */ }),
}), { name: 'fluxo-ui', version: 1 }));   // ← versão evita quebrar dados antigos
```

Regras:
- **Estado do servidor** (ordens, setores) → **TanStack Query** + eventos WebSocket que atualizam o cache.
- **Estado de UI** (filtros, aba, drawer aberto) → Zustand.
- **Estado derivado** (contagens de KPI, ordens filtradas) → `selectors.ts`, nunca guardado.
- O que o antigo `renderAll()` fazia (recriar tudo) passa a ser **reatividade automática por componente**; o `patch()` deixa de existir.

---

## 8. Componentes: como organizar

Cada pasta de componente/feature segue o mesmo molde:

```
features/track/
├─ Track.tsx              # componente principal
├─ TrackNode.tsx          # nó (orb + nome + contador)
├─ TrackConnector.tsx     # linha com pontos animados
├─ Track.module.css
├─ useTrackData.ts        # hook que monta os dados a partir do store
├─ Track.test.tsx
└─ index.ts               # export público
```

**Regras de fronteira:**
1. `components/` **não** conhece o domínio (Button não sabe o que é uma OP).
2. `features/` pode usar `components/`, `store/` e `domain/`.
3. `domain/` **não** importa de ninguém.
4. Uma feature **não** importa de outra feature — se precisar compartilhar, promova para `components/` ou `domain/`.
5. Exporte só o necessário via `index.ts`.

**Exemplo — conector animado como componente:**
```tsx
export function TrackConnector({ runCount, onlyPaused }: Props) {
  const mode = runCount ? 'flow' : onlyPaused ? 'hold' : 'idle';
  const dots = Math.min(3, runCount);
  return (
    <div className={`${s.conn} ${s[mode]}`}>
      {Array.from({ length: dots }, (_, k) => (
        <i key={k} className={s.dot} style={{ '--d': `-${(k * 0.75).toFixed(2)}s` } as CSSProperties} />
      ))}
    </div>
  );
}
```

---

## 9. O diagrama como módulo isolado

```
features/diagram/
├─ DiagramView.tsx          # container + toolbar
├─ SectorNode.tsx           # nó customizado (React Flow) com portas
├─ FlowEdge.tsx             # aresta com animação stroke-dashoffset
├─ SectorConfigModal.tsx    # antigo openSectorConfig()
├─ DbSchemaModal.tsx        # opcional
├─ useDiagramGraph.ts       # converte Sector[] ⇄ nodes/edges
├─ diagram.module.css       # .flow-active + @keyframes wireflow
└─ __tests__/
```

Pontos-chave:
- Converter `Sector[]` em `nodes/edges` num hook; **o domínio continua sendo a fonte da verdade**.
- Ao criar aresta, chamar `wouldCreateCycle` **antes** de gravar.
- Persistir posição com **debounce** (não a cada pixel).
- A regra "aresta ativa" (`hasFlow`) sai de um selector: "existe OP em andamento no setor de origem".
- Se optar por **não** usar React Flow, mantenha o desenho atual (nós `div` + SVG Bézier) dentro deste módulo — a fronteira é a mesma.

---

## 10. Serviços e tempo real

```ts
// services/realtime.ts
export function connectRealtime(queryClient: QueryClient) {
  const ws = new WebSocket(import.meta.env.VITE_WS_URL);
  ws.onmessage = (e) => {
    const evt = JSON.parse(e.data);
    switch (evt.type) {
      case 'order.updated': queryClient.setQueryData(['orders', evt.id], evt.payload); break;
      case 'order.paused':  useToastStore.getState().push(/* … */); break;
      case 'graph.updated': queryClient.invalidateQueries({ queryKey: ['sectors'] }); break;
    }
  };
  return () => ws.close();
}
```

`services/simulator.ts` mantém o antigo `tick()` **apenas** para modo demo (`VITE_DEMO=true`), publicando eventos no mesmo formato que o WebSocket real. Assim a UI não sabe a diferença entre demo e produção.

---

## 11. Backend: organização por módulo

```
apps/api/src/modules/orders/
├─ orders.routes.ts       # define endpoints
├─ orders.controller.ts   # entrada/saída HTTP
├─ orders.service.ts      # regra de negócio (usa packages/shared)
├─ orders.repository.ts   # acesso ao banco
└─ orders.schema.ts       # validação (Zod)
```

- Regras de grafo (ciclo, `canStart`) vêm de `packages/shared` → **mesma lógica** no front e no back; o servidor sempre revalida.
- Autorização por papel no servidor (o antigo `setRole()` era só visual).
- Migrations versionadas em `db/migrations/`.

---

## 12. Alternativa C: manter Vanilla, mas modular

Se quiser evoluir com o mínimo de mudança, use **Vite + módulos ES** (sem framework):

```
src/
├─ main.js
├─ styles/  tokens.css themes.css animations.css components.css
├─ domain/  graph.js orders.js
├─ store/   state.js            # objeto + pub/sub simples
├─ services/ simulator.js api.js
└─ features/
   ├─ track/     track.js  track.css
   ├─ board/     board.js  board.css
   ├─ diagram/   diagram.js  drag.js  wires.js  diagram.css
   └─ ...
```

Cada `render*()` vira uma função exportada que recebe `(container, state)`. Um pub/sub mínimo substitui a chamada manual de `renderAll()`:
```js
const listeners = new Set();
export const subscribe = fn => (listeners.add(fn), () => listeners.delete(fn));
export const setState = patch => { Object.assign(state, patch); listeners.forEach(fn => fn(state)); };
```
Limitação: continua com `innerHTML` (atenção ao escape) e sem reatividade granular.

---

## 13. Qualidade e ferramentas

| Ferramenta | Uso |
|---|---|
| **TypeScript** (`strict: true`) | Tipagem de domínio |
| **ESLint + Prettier** | Padrão de código |
| **Vitest** | Testes de `domain/`, store e hooks |
| **Testing Library** | Componentes |
| **Playwright** | E2E: pausar, finalizar, conectar setores, importar |
| **Storybook** (opcional) | Catálogo de `components/` e estados de status |
| **Husky + lint-staged** | Lint/testes antes do commit |
| **MSW** | Mock de API no dev e nos testes |
| **Sentry** | Erros em produção |

**`package.json` (scripts do web):**
```json
{
  "scripts": {
    "dev": "vite",
    "dev:demo": "VITE_DEMO=true vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest",
    "lint": "eslint src --max-warnings 0",
    "typecheck": "tsc --noEmit",
    "e2e": "playwright test"
  }
}
```

**CI (`.github/workflows/ci.yml`):** instalar → `lint` → `typecheck` → `test` → `build` (→ `e2e` em PR para `main`).

---

## 14. Convenções

- **Nomes:** componentes `PascalCase`, hooks `useCamelCase`, funções de domínio `camelCase`, arquivos CSS `Nome.module.css`.
- **Imports absolutos** (`@/domain/graph`) via alias no `tsconfig` e `vite.config`.
- **Commits:** Conventional Commits (`feat:`, `fix:`, `refactor:`).
- **Branches:** `main` protegida + PRs curtos.
- **Variáveis de ambiente:** `.env.example` versionado, `.env` no `.gitignore`.
  ```
  VITE_API_URL=http://localhost:3000
  VITE_WS_URL=ws://localhost:3000/ws
  VITE_DEMO=false
  ```
- **Sem lógica de negócio em componente:** se tem `if` sobre regra da fábrica, vai para `domain/`.
- **Sem cor/hex solto:** sempre token.
- **Todo dado dinâmico via JSX** (escape automático); nunca `dangerouslySetInnerHTML` sem sanitizar.

---

## 15. Passo a passo da migração (sem parar o que já funciona)

| Passo | Ação | Resultado verificável |
|---|---|---|
| 1 | Criar `apps/web` com Vite + React + TS | Página em branco roda |
| 2 | Copiar CSS para `tokens.css`, `themes.css`, `animations.css`, `base.css` | Tema claro/escuro funciona |
| 3 | Criar `domain/types.ts`, `graph.ts`, `orders.ts` + testes | `pnpm test` verde |
| 4 | Portar `mocks/` (dados fake) e `services/simulator.ts` | Dados aparecem no console/store |
| 5 | Criar `components/` genéricos (Button, Pill, ProgressBar, Modal, Drawer, Toast) | Storybook ou página de teste |
| 6 | Portar `features/kpis` e `features/track` (com animações) | Track idêntico ao original |
| 7 | Portar `features/board` e `orders-table` | Filtros funcionando |
| 8 | Portar `features/order-drawer` e `pauses` | Pausar/retomar/interromper |
| 9 | Portar `features/diagram` (aplicando Fase 0 do plano de melhoria) | Sem perder drag; ciclo bloqueado |
| 10 | Portar `features/operator` | Fluxo do operador completo |
| 11 | Comparar lado a lado com o HTML original (screenshots) | Paridade visual |
| 12 | Trocar simulador por API + WebSocket (`apps/api`) | Dados reais |
| 13 | Ativar regra `canStart` no fluxo | Grafo governa a produção |
| 14 | Remover o HTML antigo (guardar em `docs/prototype/`) | Projeto único e organizado |

> **Dica:** mantenha o HTML original aberto durante a migração como "referência viva". Só apague depois do passo 11.

---

## 16. Checklist final de estrutura

- [ ] Nenhum arquivo passa de ~200–300 linhas
- [ ] `domain/` não importa React, DOM nem `fetch`
- [ ] Tokens e animações em arquivos próprios
- [ ] Cada feature isolada em sua pasta, com teste
- [ ] Componentes genéricos sem conhecimento de negócio
- [ ] Regras de grafo compartilhadas entre front e back
- [ ] Estado de servidor (Query) separado do estado de UI (Zustand)
- [ ] Modo demo separado por variável de ambiente
- [ ] Fontes hospedadas localmente
- [ ] CI com lint, typecheck, testes e build
- [ ] README explicando como rodar, testar e contribuir
- [ ] Protótipo original arquivado em `docs/prototype/`

---

*Gerado a partir da análise de `fluxo-producao-diagrama.html`.*
