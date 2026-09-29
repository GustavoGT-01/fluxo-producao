# Stack & Guia de Replicação — Fluxo de Produção (Frontend)

> Análise do arquivo `fluxo-producao-diagrama.html` (~1.100 linhas, ~73 KB).
> Objetivo: documentar o stack, explicar como cada animação/diagrama funciona e como replicar em outro projeto.

---

## 1. Resumo executivo

| Item | Valor |
|---|---|
| Tipo | SPA de arquivo único (HTML + CSS + JS inline) |
| Framework | **Nenhum** (Vanilla JS) |
| Bibliotecas JS | **Nenhuma** (zero dependências) |
| Build / bundler | Nenhum |
| Fontes | Google Fonts: *Bricolage Grotesque* (títulos) + *Figtree* (corpo) |
| Diagrama | HTML/CSS (nós) + **SVG** (fios com curvas Bézier) |
| Animações | **CSS puro** (`@keyframes`, `transition`) |
| Estado | Objeto JS global `state` + arrays em memória |
| Persistência | `localStorage` (posições e dependências do diagrama) |
| Tempo real | **Simulado** com `setInterval(tick, 1000)` (não há backend) |
| Temas | Claro/escuro via CSS variables + `prefers-color-scheme` + `data-theme` |
| Responsivo | Media queries + `overflow-x:auto` + `env(safe-area-inset-*)` |

**Em uma frase:** é um dashboard Kanban/Lista/Grafo feito só com HTML, CSS e JavaScript nativo, com renderização por template strings e re-render completo a cada mudança.

---

## 2. Linguagens e tecnologias usadas

### 2.1 HTML5
- Semântica: `<header>`, `<section>`, `<aside>` (drawers), `<dialog-like>` via `div.modal`.
- Acessibilidade: `aria-pressed`, `aria-label`, `aria-live="assertive"`, `role="alert"`, `role="status"`, `role="group"`.
- `<meta viewport ... viewport-fit=cover>` para iPhone com notch.

### 2.2 CSS3 (a parte mais forte do projeto)
Recursos modernos usados:

- **CSS Custom Properties** (design tokens): `--bg`, `--surface`, `--ink`, `--brand`, `--run`, `--pause`, `--stop`…
- **Tema escuro em 3 camadas**:
  1. `:root` (claro, padrão)
  2. `@media (prefers-color-scheme: dark)` com `:root:not([data-theme="light"])`
  3. `:root[data-theme="dark"]` (forçado pelo botão)
- `color-mix(in srgb, var(--c) 12%, var(--surface))` para tints dinâmicos por status.
- **CSS Grid** (KPIs, formulários) e **Flexbox** (track, board, header).
- `env(safe-area-inset-top/bottom)` para mobile.
- `radial-gradient` como grid de pontos do canvas.
- `repeating-linear-gradient` para linha tracejada ("hold").
- Variável por elemento (`style="--c:..."`, `--nc`, `--d`) para cor/atraso por instância.

### 2.3 JavaScript (ES2015+ vanilla)
- Template literals para gerar HTML (`innerHTML`).
- **Event delegation** (um `onclick` no container + `e.target.closest('[data-x]')`).
- **Pointer Events** (`pointerdown/move/up`, `setPointerCapture`) para drag do diagrama (funciona em mouse e touch).
- `localStorage` + `JSON.parse/stringify`.
- `setInterval` como "motor" de simulação.
- PRNG determinístico próprio (`seed*16807 % 2147483647`, Park-Miller) → dados de demo reproduzíveis.
- `navigator.clipboard.writeText` (copiar SQL/JSON).

### 2.4 SVG
- `<svg>` sobreposto ao canvas com `<path>` de Bézier cúbica e `<marker>` para pontas de seta.
- Duas setas: cinza (`#arrow`) e verde (`#arrow-active`).

### 2.5 SQL (só como documentação embutida)
Modal "Schema DB / API" gera DDL PostgreSQL/SQLite/MySQL e um payload JSON de exemplo (ver seção 8).

---

## 3. Estrutura do arquivo

```
<head>
  ├─ meta viewport, Google Fonts
  └─ <style>  (~330 linhas)
       ├─ tokens (:root) + tema escuro
       ├─ header, botões, KPIs
       ├─ .track  (linha de produção animada)
       ├─ .board / .card / tabela
       ├─ .drawer, .modal, .toast, .alert
       ├─ .diagram-* (canvas, nós, portas, fios)
       └─ @media responsivos
<body>
  ├─ header (perfil Gerência/Operador, tema, ao vivo, velocidade)
  ├─ KPIs (5 status clicáveis)
  ├─ Track (linha horizontal de 12 setores)
  ├─ Filtros (busca, lote, urgentes, Fluxo/Lista/Diagrama)
  ├─ #view (Board ou Tabela)   ← renderBoard()/renderTable()
  ├─ #diagView (Diagrama)      ← renderDiagram()
  ├─ #opview (visão do operador)
  ├─ #feed (atividade recente)
  └─ overlays: scrim, drawer(s), alerts, modal, toast
<script>  (~600 linhas)
  ├─ Dados: STAGES, PRODS, REASONS, OPERATORS…
  ├─ Estado: state, items[], pauses[], feed[]
  ├─ render*(): KPIs, Track, Board, Table, Diagram, Drawer, Notif, Operator
  ├─ Motor: tick() → advance() → patch()/renderAll()
  ├─ Diagrama: drawWires, drag, conectar portas, config de dependências
  └─ Event handlers (delegation)
```

---

## 4. Modelo de dados (JS)

### 4.1 Setor (nó do grafo)
```js
{
  id: 'tapecaria',
  n: 'Tapeçaria',          // nome
  i: '🧵',                 // ícone (emoji)
  color: '#6366F1',
  indep: false,            // entrada livre?
  deps: ['preparacao','espumacao','costura'],  // pré-requisitos (arestas)
  x: 790, y: 215           // posição no canvas
}
```
O fluxo é um **DAG (grafo acíclico dirigido)**: `deps` são as arestas de entrada.

### 4.2 Ordem de produção (OP)
```js
{
  id:'OP-4820', prod:'Sofá Milano', qty:6, lote:'L-0928-A',
  stage:3,                  // índice do setor atual
  prog:42,                  // % da etapa
  status:'run',             // run | wait | pause | stop | done
  urg:false, due:'05/10', mins:12,
  hist:{0:35,1:50},         // minutos gastos por etapa concluída
  reason:'', by:'',         // motivo/autor de pausa
  pedido:'PED-10431', cliente:'Móveis Aurora',
  ready:false               // 100% mas aguardando o operador finalizar
}
```

### 4.3 Estado global
```js
const state = {
  role:'ger'|'op', view:'board'|'list'|'diag', live:true, speed:1, sim:true,
  stat:Set, lote:'', q:'', urg:false, sector:null,
  open:null /* OP aberta no drawer */, connectSource:null /* porta origem */,
  clock:Date /* relógio simulado */
}
```

---

## 5. Catálogo de animações (como replicar cada uma)

| # | Nome | Onde | Técnica | Trecho-chave |
|---|---|---|---|---|
| 1 | **Ping "Ao vivo"** | botão `.live i` | `box-shadow` expansivo | `@keyframes ping{70%{box-shadow:0 0 0 8px transparent}}` |
| 2 | **Pacotes viajando** | `.conn .dot` entre setores | gradiente + `left` animado, `animation-delay` negativo por dot | `@keyframes travel{to{left:100%}}` |
| 3 | **Linha "hold"** | `.conn.hold` | `repeating-linear-gradient` âmbar | tracejado quando só há pausadas |
| 4 | **Alerta de setor** | `.node.alert .orb` | pulso vermelho | `@keyframes alertpulse` |
| 5 | **Fio ativo do diagrama** | `.d-path.flow-active` | `stroke-dasharray` + `stroke-dashoffset` animado | `@keyframes wireflow{to{stroke-dashoffset:-20}}` |
| 6 | **Porta conectando** | `.d-port.connecting` | pulso verde | `@keyframes portpulse` |
| 7 | **Sino balançando** | `.bell.ring` | rotação keyframes | `@keyframes ring` (re-trigger via `void el.offsetWidth`) |
| 8 | **Alerta caindo** | `.alert` | `translateY` + cubic-bezier com overshoot | `@keyframes drop` (`cubic-bezier(.2,.9,.3,1.2)`) |
| 9 | **Drawer lateral** | `.drawer` | `transform:translateX(102%)` → `none` | `transition:.28s cubic-bezier(.2,.8,.2,1)` |
| 10 | **Toast** | `.toast` | opacity + translate | classe `.on` |
| 11 | **Hover elevado** | KPIs, orbs | `transform: translateY/scale` | `transition:.15s` |
| 12 | **Barra de progresso** | `.bar span` | `width:%` atualizado por `patch()` | sem re-render |

Outros keyframes existentes: `pop`, `slidein`, `stopflash`, `stripes`.

### 5.1 Truque importante: reiniciar animação CSS
```js
el.classList.remove('ring');
void el.offsetWidth;      // força reflow
el.classList.add('ring'); // animação recomeça
```

### 5.2 Truque: atraso por instância via variável CSS
```html
<i class="dot" style="--d:-0.75s"></i>
```
```css
.conn .dot{animation:travel 2.2s linear infinite;animation-delay:var(--d)}
```
Delay **negativo** faz cada "pacote" começar em pontos diferentes do caminho (efeito de fluxo contínuo).

---

## 6. Como o diagrama (grafo) funciona

### 6.1 Arquitetura híbrida: HTML + SVG
```
.diagram-canvas   (scroll horizontal, fundo de pontos)
 └─ .canvas-inner (1760px, position:relative)
     ├─ <svg>  ← fios (path Bézier) — camada de baixo
     └─ .diagram-nodes ← divs absolutos (left/top) — camada de cima
```
- **Nós = `<div>`** (fácil de estilizar, texto, botões, hover).
- **Fios = `<path>`** dentro de SVG (curvas suaves + marker de seta).
- Posição do nó: `style="left:${x}px;top:${y}px"`.

### 6.2 Desenho do fio (Bézier cúbica)
```js
function getPortCoords(id, type){
  const el = document.getElementById('dnode-'+id);
  const x = type==='out' ? el.offsetLeft + el.offsetWidth : el.offsetLeft;
  const y = el.offsetTop + el.offsetHeight/2;
  return {x,y};
}

const dx = Math.max(45, Math.abs(p2.x - p1.x) * 0.45);
const d  = `M ${p1.x} ${p1.y} C ${p1.x+dx} ${p1.y}, ${p2.x-dx} ${p2.y}, ${p2.x} ${p2.y}`;
```
Pontos de controle horizontais (`+dx` / `-dx`) dão a curva em "S" típica de editores de nós (Node-RED, n8n, Blender).

### 6.3 Arrastar nós (Pointer Events)
1. `pointerdown` → guarda posição inicial e chama `setPointerCapture`.
2. `pointermove` → atualiza `left/top` do nó e chama `drawWires()`.
3. `pointerup` → remove listeners e salva `{id:{x,y}}` em `localStorage`.

Vantagem: um único código para mouse, touch e caneta.

### 6.4 Conectar setores
- Clique na **porta de saída** (direita) → `state.connectSource = id`.
- Clique na **porta de entrada** (esquerda) de outro nó → `target.deps.push(source)`.
- Clique num **fio** → `confirm()` para remover a dependência.
- Modal ⚙️ permite marcar "independente" ou escolher pré-requisitos por checkbox.

### 6.5 Fio "vivo"
```js
const hasFlow = items.some(i => i.stage === srcIdx && i.status === 'run');
// hasFlow → classe .flow-active + marker verde
```

---

## 7. Motor de simulação (tempo real fake)

```js
setInterval(tick, 1000);      // 1 tick = 1 minuto simulado × speed

function tick(){
  state.clock += 60000 * state.speed;
  items.forEach(it => {
    // avança progresso, muda status, pausa aleatória, retoma, etc.
    if (it.prog >= 100) advance(it);   // vai para o próximo setor
  });
  moved ? renderAll() : patch();       // ← otimização importante
}
```

- `renderAll()`: re-renderiza tudo (quando algo estrutural mudou).
- `patch()`: só atualiza larguras de barras e textos via `data-bar`, `data-since`, `data-pcs` (sem recriar DOM → sem flicker, mantém hover/scroll).
- 15% de chance de reprovação no CQ → ordem volta à Costura (simula retrabalho).
- Perfis: **Gerência** (visão total) e **Operador** (só seu setor, botões grandes Iniciar/Pausar/Finalizar).

---

## 8. Backend sugerido (o HTML já traz o schema)

### 8.1 SQL (PostgreSQL)
```sql
CREATE TABLE sectors (
  id VARCHAR(30) PRIMARY KEY, name VARCHAR(100) NOT NULL,
  icon VARCHAR(10), color VARCHAR(20),
  is_independent BOOLEAN DEFAULT FALSE,
  coord_x INT DEFAULT 0, coord_y INT DEFAULT 0
);

CREATE TABLE sector_dependencies (
  id SERIAL PRIMARY KEY,
  parent_sector_id    VARCHAR(30) REFERENCES sectors(id) ON DELETE CASCADE,
  dependent_sector_id VARCHAR(30) REFERENCES sectors(id) ON DELETE CASCADE,
  UNIQUE(parent_sector_id, dependent_sector_id)
);

CREATE TABLE production_orders (
  id VARCHAR(40) PRIMARY KEY, product_name VARCHAR(150) NOT NULL,
  quantity INT NOT NULL, batch_code VARCHAR(50), client_name VARCHAR(150),
  order_code VARCHAR(50), is_urgent BOOLEAN DEFAULT FALSE, deadline_date DATE,
  current_sector_id VARCHAR(30) REFERENCES sectors(id),
  status VARCHAR(20) DEFAULT 'run',
  progress_percentage NUMERIC(5,2) DEFAULT 0, elapsed_minutes INT DEFAULT 0
);

CREATE TABLE sector_completions (
  id SERIAL PRIMARY KEY,
  order_id  VARCHAR(40) REFERENCES production_orders(id),
  sector_id VARCHAR(30) REFERENCES sectors(id),
  operator_name VARCHAR(100), completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Tabelas que faltam** (o front usa, mas o schema embutido não cobre):
`pauses` (motivo, autor, status novo/visto/tratada), `activity_feed`, `users/roles` (Gerência × Operador), `batches`.

### 8.2 Endpoints REST sugeridos
```
GET    /sectors                    POST   /sectors
PATCH  /sectors/:id                (posição, independente)
PUT    /sectors/:id/dependencies   (lista de deps)
GET    /orders?status=&lote=&q=&urgent=
PATCH  /orders/:id                 (status, urgência, progresso)
POST   /orders/:id/pause           (motivo, obs)
POST   /orders/:id/advance         (finalizar etapa)
POST   /batches/import             (upload xlsx do PCP)
GET    /pauses?status=novo
WS     /ws/production              (eventos em tempo real)
```
**Tempo real de verdade:** trocar `setInterval(tick)` por **WebSocket / SSE / Supabase Realtime** — o front só precisa aplicar eventos no `items[]` e chamar `renderAll()`/`patch()`.

---

## 9. Como replicar em outro projeto

### Caminho A — Copiar em Vanilla (mais rápido, zero setup)
Ideal para: protótipo, intranet, painel simples.

1. Copie o bloco `:root` (tokens) + CSS de `.track`, `.conn`, `.diagram-*`, `.d-*`, keyframes.
2. Copie `STAGES` e troque pelos **seus** nós (id, nome, ícone, cor, deps, x, y).
3. Copie `renderDiagram`, `getPortCoords`, `drawWires`, `bindDiagramDragging`.
4. Troque `items` (dados fake) por `fetch('/api/orders')`.
5. Troque `setInterval(tick)` por WebSocket.

### Caminho B — React/Vue/Svelte (recomendado para produto real)
Ideal para: app grande, equipe, testes.

| Parte do original | Equivalente moderno |
|---|---|
| `state` global | Zustand / Pinia / Svelte stores |
| `renderX()` com `innerHTML` | Componentes (`<Kpi/>`, `<Track/>`, `<Board/>`, `<Drawer/>`) |
| `patch()` | Reatividade automática (React re-render granular / signals) |
| `localStorage` manual | `persist` middleware (Zustand) ou TanStack Query + backend |
| CSS inline no `<style>` | CSS Modules / Tailwind + variáveis CSS para tokens |
| Diagrama manual | **React Flow (@xyflow/react)** — já traz drag, zoom, ports, edges |
| `setInterval` | TanStack Query + WebSocket / SSE |

### Caminho C — Só o diagrama, com biblioteca pronta
Se o foco é o grafo de dependências, use:
- **React Flow** (React) — o mais completo
- **Vue Flow** (Vue)
- **Svelte Flow**
- **JointJS / GoJS** (mais pesados/comerciais)
- **D3-force / dagre / elkjs** para auto-layout

Mantenha as animações originais como CSS customizado nas edges (`stroke-dasharray` + `@keyframes`).

### Stack recomendado (versão "profissional")

```
Frontend:  React 18 + TypeScript + Vite
UI:        Tailwind CSS (ou CSS Modules) + variáveis CSS (tokens)
Grafo:     @xyflow/react (React Flow)
Estado:    Zustand + TanStack Query
Tempo real: WebSocket (Socket.IO) ou SSE ou Supabase Realtime
Backend:   Node (NestJS/Fastify) ou Python (FastAPI)
Banco:     PostgreSQL (+ Prisma ou Drizzle)
Import:    SheetJS (xlsx) no front ou no backend
Testes:    Vitest + Playwright
Deploy:    Vercel/Netlify (front) + Railway/Fly/Render (API)
```

---

## 10. Skills necessárias (o que estudar/pedir)

### Essenciais (para reproduzir este visual)
- **HTML semântico + acessibilidade (ARIA)**
- **CSS moderno**: variables, Grid, Flexbox, `@keyframes`, `transition`, `color-mix`, `clip/overflow`, media queries
- **JavaScript ES6+**: DOM, event delegation, template literals, Pointer Events, `localStorage`
- **SVG**: `path`, comandos `M/C`, `marker`, `stroke-dasharray`
- **Design de UI**: hierarquia visual, sistema de cores por status, dark mode

### Para evoluir para produto
- **React/Vue + TypeScript**
- **Teoria de grafos básica** (DAG, ordenação topológica, detecção de ciclos)
- **REST + WebSocket**
- **SQL / modelagem relacional**
- **UX industrial** (botões grandes p/ operador, contraste, mobile-first)
- **Performance de UI** (evitar re-render total, virtualização em listas grandes)

### Termos para pesquisar / pedir a uma IA
> "node-based editor", "DAG visualization", "kanban swimlane", "production line tracker", "MES dashboard" (Manufacturing Execution System), "Andon board", "SVG bezier edges", "animated dashed stroke", "CSS design tokens dark mode".

---

## 11. Prompt-modelo para recriar em outro projeto

```
Crie um dashboard de acompanhamento de produção em [React + TS + Tailwind].

Requisitos:
1. Header com troca de perfil (Gerência/Operador), tema claro/escuro,
   botão "Ao vivo" com ping animado e seletor de velocidade.
2. KPIs clicáveis por status (Em produção, Aguardando, Pausada,
   Interrompida, Finalizada) que funcionam como filtro.
3. "Track" horizontal com N setores como círculos ligados por linhas,
   com pontos luminosos animados quando há fluxo, tracejado âmbar quando só
   há pausadas e pulso vermelho quando há interrupção.
4. 3 visões: Kanban por setor, Lista/Tabela e Diagrama de dependências.
5. Diagrama: nós arrastáveis (pointer events), portas de entrada/saída,
   fios Bézier em SVG com seta, fio verde tracejado animado quando há fluxo,
   clique no fio remove dependência, modal para configurar dependências,
   persistência de posições. Validar que o grafo seja acíclico.
6. Drawer lateral com detalhes da ordem + timeline por etapa.
7. Modal de pausa com motivo obrigatório, sino com contador e toast de alerta.
8. Visão do Operador com botões grandes Iniciar/Pausar/Finalizar e
   contador de peças.
9. Dados via API REST + WebSocket (mock com MSW no início).
10. Acessibilidade (ARIA, foco visível) e responsivo mobile.

Tokens de cor: run #0E9F73, wait #6F7FA0, pause #D9950B, stop #DC3F4A,
done #7357E6, brand #2A4DE0.
Fontes: Bricolage Grotesque (títulos) + Figtree (corpo).
```

---

## 12. Pontos de atenção (dívidas técnicas encontradas)

Ao analisar o código, estes itens merecem correção ao migrar:

1. **Sem detecção de ciclos** no grafo: é possível ligar A→B→A. Validar com DFS/ordenação topológica antes de salvar.
2. **IDs "mágicos" no código**: `['cnc','corte','laminacao','marcenaria']` na remoção de fio e `it.stage===10` no CQ estão hard-coded. Derive de `STAGES` (ex.: `stage.id==='cq'`).
3. **Fluxo linear × DAG**: os itens usam `stage++` (sequência por índice), mas o diagrama permite dependências arbitrárias. Na prática o motor **ignora `deps`** — o diagrama é visual/configuração, a simulação continua linear. Em produção, o avanço deve respeitar as dependências (uma OP só entra em Tapeçaria quando Preparação, Espumação e Costura concluírem).
4. **Operadores por índice** (`OPERATORS[stage]`): frágil se a ordem dos setores mudar.
5. **Re-render por `innerHTML`**: perde foco, seleção de texto e scroll interno em re-renders frequentes; em React isso é resolvido naturalmente.
6. **XSS**: `esc()` é usado em vários lugares, mas nem todos (ex.: `it.prod`, `it.cliente`, `p.cliente` entram no HTML sem escape). Com dados reais de API, **escape sempre** ou use framework.
7. **`confirm()` nativo** para remover fio: trocar por modal próprio (consistência e mobile).
8. **`localStorage` sem versionamento**: se mudar o formato de `STAGES`, dados antigos podem quebrar. Adicione `version` na chave.
9. **Canvas com largura fixa 1760px**: sem zoom/pan; para muitos setores use React Flow ou implemente `transform: scale()` + pan.
10. **Sem testes nem tipagem**: ao migrar, tipar `Order`, `Sector`, `Status` em TypeScript.
11. **Fontes externas** (Google Fonts): para uso offline/fábrica, hospede localmente (`@font-face`).
12. **Acessibilidade do drag**: o diagrama só funciona com ponteiro; ofereça alternativa por teclado (modal de dependências já ajuda).

---

## 13. Checklist de migração

- [ ] Extrair tokens CSS para arquivo próprio (`tokens.css`)
- [ ] Portar keyframes para arquivo `animations.css`
- [ ] Tipar entidades (`Sector`, `Order`, `Pause`, `Status`)
- [ ] Criar API + tabelas faltantes (`pauses`, `feed`, `users`, `batches`)
- [ ] Trocar simulação por WebSocket/SSE
- [ ] Implementar validação de DAG e regra "OP só avança se todas as `deps` concluíram"
- [ ] Substituir diagrama manual por React Flow (ou manter o vanilla e modularizar)
- [ ] Auth + perfis (Gerência × Operador) no backend, não só na UI
- [ ] Importação de planilha (xlsx) real com SheetJS
- [ ] Testes E2E dos fluxos críticos (pausar, finalizar, conectar setores)
- [ ] Self-host das fontes e revisão de contraste (WCAG AA)

---

*Gerado a partir da análise de `fluxo-producao-diagrama.html`.*
