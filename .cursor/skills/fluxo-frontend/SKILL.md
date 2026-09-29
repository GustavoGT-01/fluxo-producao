---
name: fluxo-frontend
description: Aplica o sistema visual do fluxo de produção (tokens, data-s, catálogo de animação, trilho escuro, CSS Modules). Use ao criar ou alterar UI, CSS, layout, tema, movimento, componentes ou features deste projeto.
---

# Frontend — fluxo de produção

Identidade visual já existe. Não inventar paleta, fonte nem animação.

## Antes de editar UI

1. Ler `files/styles/LEIA-ME.md` (ou `apps/web/src/styles` depois da migração).
2. Ler `GUIA-VISUAL-ANIMACAO-fluxo-producao.md` seções 2, 3 e 4.
3. Seguir `.cursor/rules/frontend-visual.mdc` e `frontend-arquitetura.mdc`.

## Obrigatório

- Pack CSS: `tokens`, `themes`, `fonts`, `base`, `status`, `animations`, `motion`, `index` — nessa ordem, via `index.css`.
- Status: atributo `data-s`. Componente usa `var(--c)`.
- Fontes: Bricolage Grotesque (título), Figtree (corpo), self-host em `public/fonts`. Fallback de sistema se o arquivo ainda não existir.
- Hierarquia: Track e KPIs respondem "está andando?" e "onde travou?" em 3 segundos. KPI filtra. Card abre drawer.
- Trilho (`.track`) e diagrama sempre escuros.
- Movimento = atividade. Sem loop decorativo.
- Reduced motion preserva significado (linha sólida, borda grossa, tint fixo).
- Claro, escuro, 390px e 1440px em tela nova.
- CSS de layout do componente fica no CSS Module. Tokens e keyframes não.

## Proibido

- Tailwind, hex de status fora de `tokens.css`, `@keyframes` fora de `animations.css`.
- `innerHTML` / `dangerouslySetInnerHTML` com dado de OP, cliente ou pedido.
- Feature importando outra feature.
- Re-render completo do diagrama dentro do `tick`.

## Checagem rápida

- [ ] `data-s` no elemento colorido por status
- [ ] texto ou ícone além da cor
- [ ] keyframe do catálogo, ou justificativa no LEIA-ME
- [ ] `data-motion="off"` ainda legível
- [ ] toque do operador ≥ 56px
