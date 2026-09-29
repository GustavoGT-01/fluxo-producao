# Fluxo de Produção

Sistema de acompanhamento de ordens de produção por setor (DAG): quadro Kanban, trilho, diagrama, posto do operador, paradas, importação e **cronoanálise** (tempo ativo produto × setor).

Monorepo **pnpm**:

| Pacote | Stack |
|--------|--------|
| `apps/web` | React 18 + TypeScript strict + Vite + CSS Modules + Zustand |
| `apps/api` | Fastify + SQLite (`node:sqlite`) + cookie de sessão |
| `packages/shared` | stub (ainda não usado) |

---

## Pré-requisitos

1. **Node.js** 22 ou superior (recomendado 22 LTS ou 24). Confira: `node -v`
2. **pnpm** 9.x. Se não tiver:

```bash
npm install -g pnpm@9
```

3. Git (para clonar).

Windows: use **PowerShell** ou Git Bash. Neste README, comandos longos usam `;` no PowerShell (não use `&&` se a shell reclamar).

---

## Clonar e instalar

```bash
git clone https://github.com/GustavoGT-01/fluxo-producao.git
cd fluxo-producao
pnpm install
```

Sempre rode os scripts **na raiz** `fluxo-producao/` (onde está o `package.json` do monorepo).

---

## Como rodar

Há dois modos. Em ambos a **API** sobe na porta **3001** e o **web** na **5173**.

### 1) Uso real (dados no servidor)

Sobe web + API juntos. Progresso, paradas e cronoanálise **gravam no SQLite**.

```bash
pnpm dev
```

Abra: [http://localhost:5173/](http://localhost:5173/)

- API: [http://127.0.0.1:3001/api/health](http://127.0.0.1:3001/api/health) deve responder `{"ok":true}`
- O Vite faz proxy de `/api` para a API

Só a API:

```bash
pnpm dev:api
```

Só o front (precisa da API já ligada):

```bash
pnpm dev:web
```

### 2) Apresentação / demo (`VITE_DEMO=true`)

Quadro rico (~18 OPs), alertas de parada e **simulação de operadores** (avançar / pausar / retomar).  
Login ainda usa a API, mas o quadro demo **não grava** progresso/pausas no servidor e **não escuta SSE** de ordens.

```bash
pnpm dev:demo
```

Abra: [http://localhost:5173/](http://localhost:5173/)

Na tela Fluxo você pode alternar **Foco** (coluna do setor em tela cheia) e **Trilho** (todas as colunas; filtro puxa a visão).

---

## Login (contas de demonstração)

Na **primeira** subida da API, se o banco estiver vazio, o seed cria usuários e 3 ordens de exemplo.

### Gerência

| Campo | Valor |
|-------|--------|
| E-mail | `gerencia@fabrica.local` |
| Senha | `Gestao#2401` |

Pela gerência você: vê o quadro, KPIs, paradas, usuários, importação, **Cronoanálise**, e pode **Abrir posto…** de um operador sem deslogar.

### Operador (PIN por setor)

Na tela de login escolha **Operador**, o setor e o PIN de 4 dígitos:

| Setor | PIN |
|-------|-----|
| CNC | `1101` |
| Metalúrgica | `1102` |
| Laminação | `1103` |
| Marcenaria | `1104` |
| Espumação | `1105` |
| Preparação | `1106` |
| Tapeçaria | `1107` |
| Corte de tecido | `1108` |
| Costura | `1109` |
| Embalagem | `1110` |
| Controle de qualidade | `1111` |
| Finalizado | `1112` |

Operador só altera o **próprio** setor. Interromper OP, editar grafo, métricas, usuários, importação e cronoanálise exigem gerência (API responde 403).

### Recriar o banco / contas

Arquivo local (não vai para o Git):

`apps/api/data/fluxo.sqlite`

Apague esse arquivo e suba a API de novo para rodar o seed outra vez.

---

## Variáveis de ambiente (opcional)

| Variável | Onde | Padrão | Função |
|----------|------|--------|--------|
| `AUTH_SECRET` | API | segredo de desenvolvimento | Assinatura do cookie de sessão — **troque em produção** |
| `FLUXO_DB` | API | `apps/api/data/fluxo.sqlite` | Caminho do SQLite |
| `PORT` | API | `3001` | Porta HTTP da API |
| `VITE_DEMO` | Web | off | `true` só no script `dev:demo` |

Exemplo API (PowerShell):

```powershell
$env:AUTH_SECRET="um-segredo-forte"
$env:PORT="3001"
pnpm dev:api
```

---

## Cronoanálise

Em operação **real** (`pnpm dev`, sem demo):

1. OP em um setor: `run` → (opcional `pause` / retomar) → `done`
2. O servidor grava segmentos de tempo ativo e uma **amostra** por OP × setor (`active_ms`, `pause_ms`, `wall_ms`)
3. Na gerência, botão **Cronoanálise**: tabela (n, mediana, min/unidade) e **Estimar** lead time no DAG

Modo apresentação **não** alimenta a cronoanálise.

Endpoints (cookie de gerência):

- `GET /api/chrono/summary`
- `GET /api/chrono/samples?product=&sectorId=`
- `POST /api/chrono/estimate` com `{ "product": "...", "quantity": 4 }`

---

## Testes e qualidade

Na raiz:

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

- Web: Vitest (domínio, inclusive crono)
- API: testes de auth + crono (`tsx --test`)

---

## Estrutura rápida

```
fluxo-producao/
├── apps/web/          # UI (features/, store/, domain/, components/)
├── apps/api/          # Fastify + SQLite
├── docs/              # plano, stack, protótipo HTML
├── .cursor/           # regras e skills do projeto
└── package.json       # scripts do monorepo
```

Camadas do front (dependência só para baixo):

- `domain/` — funções puras (sem React/fetch)
- `store/` — Zustand
- `features/` — telas (uma feature não importa outra)
- `components/` — UI genérica

Progresso da OP é `progressBySector` (não um índice `stage`). Setor só inicia se `canStart` (deps em `done`).

---

## Problemas comuns

| Sintoma | O que fazer |
|---------|-------------|
| Login “Servidor indisponível” | Confirme API em 3001 (`/api/health`). Suba `pnpm dev` ou `pnpm dev:api`. |
| Porta 3001 ocupada | Encerre o processo antigo ou mude `PORT`. |
| Contas demo não entram | Apague `apps/api/data/fluxo.sqlite` e reinicie a API. |
| Demo sem alertas / simulação | Use `pnpm dev:demo` (não só `pnpm dev`). Botão **Ao vivo** ligado. |
| `127.0.0.1:5173` não abre | Vite pode escutar em `localhost` / IPv6 — use `http://localhost:5173/`. |
| PowerShell e `&&` | Use `;` entre comandos. |

---

## Documentação extra

- `docs/PLANO-MELHORIA-fluxo-producao.md` — roadmap
- `docs/STACK-fluxo-producao.md` — stack e endpoints
- `docs/ESTRUTURA-PROJETO-fluxo-producao.md` — arquitetura
- `apps/api/README.md` — detalhes da API e PINs
- `docs/prototype/fluxo-producao-diagrama.html` — protótipo original

---

## Licença

Projeto privado / uso interno conforme o repositório no GitHub. Ajuste a licença se for publicar abertamente.
