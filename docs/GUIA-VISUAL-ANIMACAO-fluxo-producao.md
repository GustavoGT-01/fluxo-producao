# Guia Visual e de Animação — Como Manter o Aspecto do Projeto

> Objetivo: garantir que o projeto **sempre** mantenha o visual animado e a leitura fácil do protótipo `fluxo-producao-diagrama.html`, mesmo depois de migrar para módulos, trocar de framework ou receber novos desenvolvedores.
> Complementa `STACK-…`, `PLANO-MELHORIA-…` e `ESTRUTURA-PROJETO-…`.

---

## 1. A ideia central: "entender de relance"

O protótipo funciona porque **cada informação tem uma forma visual própria**. Quem olha a tela por 3 segundos já responde:

| Pergunta | Onde a resposta aparece | Como |
|---|---|---|
| Está tudo andando? | Track (linha de setores) | Pontos luminosos viajando entre os setores |
| Onde está travado? | Track + KPIs | Pulso vermelho no setor, linha âmbar tracejada |
| Quantas ordens em cada situação? | KPIs | 5 números grandes com cor e borda por status |
| Em que etapa está a ordem X? | Card / Drawer | Barra de progresso listrada + timeline |
| Quem depende de quem? | Diagrama | Nós e fios; fio verde animado = fluxo ativo |
| Aconteceu algo agora? | Sino, toast, feed | Sino balança, alerta "cai" na tela |

**Regra-mãe:** *movimento significa que algo está acontecendo; ausência de movimento significa que está parado ou aguardando.* Nunca use animação decorativa que quebre esse significado.

---

## 2. Os 6 princípios (a "constituição" visual)

1. **Cor = status, sempre a mesma.** Uma cor por status em todo o sistema (track, card, pílula, KPI, fio, drawer).
2. **Movimento = atividade.** Animação contínua só existe para estados "vivos" (em produção, fluxo ativo, alerta). Estado parado é estático.
3. **Alerta chama atenção sem gritar.** Pulso suave e localizado; no máximo um alerta "cai" por vez (o original limita a 3 visíveis).
4. **Cor nunca é o único sinal.** Sempre acompanhada de texto, ícone ou forma (a pílula "Pausada" tem texto; o track tem contador).
5. **Um clique responde uma pergunta.** KPI filtra, setor filtra, card abre detalhes. Nada de menus escondidos.
6. **Mesma linguagem em todas as telas.** Gerência, Operador, Lista, Fluxo e Diagrama usam os mesmos tokens e as mesmas animações.

---

## 3. Semântica de status (não pode mudar)

| Status | Token | Cor (claro) | Significado | Comportamento visual |
|---|---|---|---|---|
| `run` — Em produção | `--run` | `#0E9F73` | Ordem em andamento | Barra **listrada animada**; setor com borda verde; pontos viajando no conector |
| `wait` — Aguardando | `--wait` | `#6F7FA0` | Na fila, ainda não iniciada | Estático, cinza-azulado |
| `pause` — Pausada | `--pause` | `#D9950B` | Parada com motivo registrado | Conector **tracejado âmbar** (se só houver pausadas) |
| `stop` — Interrompida | `--stop` | `#DC3F4A` | Parada pela gerência | Card **piscando suave** (`stopflash`); setor com pulso vermelho |
| `done` — Finalizada | `--done` | `#7357E6` | Concluída | Estático, roxo |

### 3.1 O mecanismo que faz o visual ser consistente
O protótipo usa **um único atributo** para colorir tudo:

```css
[data-s=run]{--c:var(--run)}
[data-s=wait]{--c:var(--wait)}
[data-s=pause]{--c:var(--pause)}
[data-s=stop]{--c:var(--stop)}
[data-s=done]{--c:var(--done)}
```

Qualquer elemento com `data-s="pause"` passa a ter `--c` âmbar; pílula, borda do KPI, barra e card **herdam** essa variável. **Mantenha esse padrão** (em React: `<Card data-s={status}>`). Assim, ao criar um componente novo, ele já nasce com as cores certas.

> ❌ Errado: `.meu-card-pausado { border-color:#D9950B }`
> ✅ Certo: `.meu-card { border-color:var(--c) }` + `data-s="pause"`

---

## 4. Catálogo oficial de animações

Cada animação tem **um propósito** e **uma regra de uso**. Antes de criar uma nova, verifique se uma existente resolve.

| Animação | Propósito | Quando dispara | Duração / curva | Regra |
|---|---|---|---|---|
| `ping` (ponto "Ao vivo") | Sistema conectado e atualizando | Enquanto `live=true` | 1,6 s infinito | Para (cinza) quando o modo ao vivo é pausado |
| `travel` (pontos no conector) | Material fluindo entre setores | Setor de origem com ordens `run` | 2,2 s linear infinito; até 3 pontos, defasados em 0,75 s | Máx. 3 pontos por conector; nenhum se não houver fluxo |
| `.conn.hold` (tracejado âmbar) | Fila parada por pausa | Só há ordens pausadas | Estático | Nunca animar |
| `alertpulse` (orb do setor) | Setor com interrupção | Ordem `stop` no setor | 1,4 s infinito | Somente vermelho |
| `wireflow` (fio do diagrama) | Dependência com fluxo ativo | Setor de origem com `run` | 0,9 s linear | Seta verde acompanha |
| `portpulse` (porta) | Modo "conectando" | Após clicar na porta de saída | 1 s infinito | Só a porta de origem selecionada |
| `stripes` (barra) | Progresso em andamento | Card/opcard com `run` | 0,8 s linear infinito | Só em `run` |
| `stopflash` (card) | Ordem interrompida | Card com `stop` | 2 s infinito | Variação sutil de fundo (9%) |
| `ring` (sino) | Nova parada registrada | Novo registro de pausa | ~0,6 s, uma vez | Reiniciar via *reflow* (ver 4.2) |
| `drop` (alerta) | Chamar atenção para nova parada | Aparição do alerta | 0,35 s, `cubic-bezier(.2,.9,.3,1.2)` | Máx. 3 visíveis; some em 25 s |
| `slidein` / `pop` | Entrada de itens/modal | Montagem | ~0,2 s, uma vez | Sem repetir |
| Drawer lateral | Detalhes da ordem | Clique no card | 0,28 s, `cubic-bezier(.2,.8,.2,1)` | Sempre com *scrim* |
| Hover (KPI, orb) | Feedback de interação | Hover | 0,12–0,2 s | `translateY(-2px)` / `scale(1.08)` |

### 4.1 Onde ficam
Todos os `@keyframes` em **um único arquivo**: `styles/animations.css`. Componentes só *referenciam* pelo nome. Nada de keyframe duplicado dentro de cada componente.

### 4.2 Reiniciar animação de disparo único (sino)
```js
el.classList.remove('ring');
void el.offsetWidth;        // força reflow
el.classList.add('ring');
```
Em React, prefira mudar a `key` do elemento a cada novo evento.

### 4.3 Defasagem por instância (fluxo contínuo)
```html
<i class="dot" style="--d:-0.75s"></i>
```
```css
.conn .dot{animation:travel 2.2s linear infinite;animation-delay:var(--d)}
```
Delay **negativo** faz cada ponto começar em uma posição diferente, criando a sensação de fila contínua.

---

## 5. Melhorias de animação (mais suave, mais leve, mesma aparência)

Dois pontos do protótipo podem pesar com muitos setores/cards. Ajustes que **não mudam o visual**:

### 5.1 Animar só `transform` e `opacity`
O `travel` anima `left` (força recálculo de layout). Troque por `transform`:

```css
/* antes */
.conn .dot{left:-10px} @keyframes travel{to{left:100%}}

/* depois */
.conn .dot{left:0; transform:translateX(-14px)}
@keyframes travel{to{transform:translateX(var(--w,100%))}}
```
> Como `translateX(100%)` refere-se à largura do próprio ponto, defina `--w` com a largura do conector (via `ResizeObserver`) ou use `offset-path`/`container` units (`translateX(100cqw)` com `container-type:inline-size` no conector).

### 5.2 Pulsos sem `box-shadow` animado
`ping`, `alertpulse` e `portpulse` animam `box-shadow` (repaint a cada quadro). Alternativa: pseudo-elemento com `transform: scale()` + `opacity`:

```css
.live i{position:relative}
.live i::after{
  content:""; position:absolute; inset:0; border-radius:50%;
  background:var(--run); opacity:.5;
  animation:ping 1.6s infinite;
}
@keyframes ping{ to{ transform:scale(2.6); opacity:0 } }
```

### 5.3 Dica de performance
- `will-change: transform` só nos elementos que animam continuamente (pontos, orb em alerta) — não em tudo.
- Limitar o número de animações infinitas simultâneas: **conectores × 3 pontos + cards `run` com barra listrada**. Em listas grandes, virtualizar.
- Pausar animações quando a aba está oculta (`document.visibilityState`) e quando o painel não está visível (ex.: o Diagrama fechado não precisa animar).

---

## 6. Movimento reduzido (acessibilidade sem perder o significado)

O protótipo tem a regra abaixo, que **desliga tudo**:

```css
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
```

Isso é correto, mas deixa o estado "em produção" sem nenhum indicador de atividade. Evolução recomendada — **trocar movimento por sinal estático equivalente**:

```css
@media (prefers-reduced-motion:reduce){
  *{animation:none!important; transition:none!important}

  /* fluxo ativo: linha sólida verde no lugar dos pontos viajando */
  .conn.flow{background:var(--run)}
  .conn .dot{display:none}

  /* alerta de setor: borda espessa vermelha no lugar do pulso */
  .node.alert .orb{border-width:4px}

  /* barra em andamento: mantém as listras estáticas */
  [data-s=run] .bar span{background-size:14px 14px}
}
```

Assim, quem prefere menos movimento entende o mesmo, só sem animar.

---

## 7. Regras para tornar o entendimento fácil (UX)

### 7.1 Hierarquia de leitura (de cima para baixo)
1. **Título + subtítulo** (o que é a tela, e muda conforme o perfil)
2. **KPIs** (o retrato geral em 5 números)
3. **Track** (onde está o fluxo e onde há problema)
4. **Filtros** (refinar)
5. **Conteúdo** (Fluxo / Lista / Diagrama)
6. **Atividade recente** (o que acabou de acontecer)

Não inverter nem inserir blocos novos acima do Track sem revisar essa ordem.

### 7.2 Regras de texto
- Rótulos curtos e em português direto: "Em produção", "Aguardando", "Pausada".
- Estados vazios **explicam o que fazer** ("Nenhuma ordem neste setor com os filtros atuais").
- Toda ação destrutiva pede o **motivo** (interromper/pausar) e confirma.
- Mensagens do feed dizem **o quê + onde + quem** ("OP-4823 avançou para Costura · finalizada por Marina").

### 7.3 Interações previsíveis
- **Clicar em KPI** = filtra por status (destaque com contorno na cor do status).
- **Clicar em setor no Track** = filtra por setor (círculo com anel branco).
- **Clicar em card/linha** = abre o drawer.
- **Esc / clicar fora** = fecha painel ou modal.
- **Arrastar nó** = mover; **porta direita → porta esquerda** = criar dependência; **clicar no fio** = remover (com confirmação).

### 7.4 Perfil Operador (regra de ouro)
- Máximo **3 ações principais** por ordem: ▶ Iniciar · ⏸ Pausar · ✔ Finalizar.
- Botões grandes (alvo de toque ≥ 56 px), só habilitados quando fazem sentido.
- O operador **nunca vê** o que não é do seu setor.

### 7.5 Diagrama: legibilidade
- Cor do nó = cor do setor (`--nc`); selo "Independente" × "Deps: N".
- Fio cinza = sem fluxo; fio verde tracejado animado = fluxo ativo.
- Sempre mostrar a **legenda** e a **dica de interação** abaixo do canvas.
- Para muitos setores: minimap, zoom e auto-layout (sem esconder a legenda).

---

## 8. Ícones e tipografia

- **Tipografia:** *Bricolage Grotesque* (700–800) para títulos e números grandes; *Figtree* (400–600) para o corpo. Números de KPI com `letter-spacing:-.02em`. Self-host em `public/fonts` com `font-display: swap`.
- **Ícones:** o protótipo usa emojis (⚙️ 🔩 🪵 🪚 🧽…), que dão personalidade e leitura rápida, mas **renderizam diferente** em cada sistema operacional (e alguns são novos demais para Android/Windows antigos).
  - Opção 1 (manter): aceitar a variação e testar nos dispositivos reais da fábrica.
  - Opção 2 (recomendada em produto): biblioteca de ícones SVG (Lucide/Phosphor) mapeada por `sector.icon`, mantendo o **círculo colorido (orb)** como moldura, que é o que dá a identidade.
- Cada setor deve ter **cor + ícone + nome** (3 sinais).

---

## 9. Como "blindar" o visual no projeto (guardrails automáticos)

Documentar não basta; o visual precisa ser **protegido por ferramentas**.

### 9.1 Regras de lint de CSS (Stylelint)
```json
{
  "rules": {
    "color-no-hex": true,
    "declaration-property-value-disallowed-list": {
      "/^(color|background|border)/": ["/#[0-9a-f]{3,8}/i"]
    },
    "keyframes-name-pattern": "^(ping|travel|alertpulse|wireflow|portpulse|stripes|stopflash|ring|drop|slidein|pop)$"
  }
}
```
- Proíbe cor "solta" (só `var(--token)`), exceto no arquivo `tokens.css` (via `overrides`).
- Restringe novos `@keyframes` à lista oficial — criar um novo exige atualizar a regra **e** a seção 4 deste guia.

### 9.2 Testes visuais (Playwright)
Screenshots de referência que falham o CI se o visual mudar sem aprovação:

```ts
test('track em fluxo ativo', async ({ page }) => {
  await page.goto('/?demo=1&seed=11&freeze=1');   // dados determinísticos + animações congeladas
  await expect(page.locator('.track')).toHaveScreenshot('track-fluxo.png');
});
```
Cenários mínimos de referência:
- Track: fluxo ativo · só pausadas · com interrupção
- KPIs: normal e com filtro selecionado
- Card em cada um dos 5 status
- Diagrama: com e sem fluxo ativo
- Tema claro e escuro
- Mobile (390 px) e desktop (1440 px)
- Perfil Operador

> O **seed fixo** (o protótipo já usa PRNG determinístico) e um parâmetro `freeze` que desativa animações tornam os screenshots estáveis.

### 9.3 Storybook (catálogo vivo)
Uma *story* por componente e por status: `Pill/run`, `Pill/pause`, `Card/stop`, `TrackConnector/flow`, etc. É a referência oficial para designers e devs verem **todos os estados animados**.

### 9.4 Tokens como fonte única
- Arquivo `tokens.css` é o único lugar com hex.
- Mudança de cor = PR próprio, com screenshots claro/escuro e revisão de contraste.

### 9.5 Checagem de contraste
Rodar `axe`/Lighthouse no CI; meta **WCAG AA** (4.5:1 para texto). Atenção especial:
- Texto sobre o track escuro (`--track-ink` sobre `--track`)
- Pílulas de status (texto sobre `color-mix` de 12–15%)
- Tema escuro, onde `--brand` muda de valor

---

## 10. Checklist de Pull Request (visual)

Antes de aprovar qualquer PR que toque a interface:

- [ ] Cores vêm de `var(--token)`; nenhum hex novo
- [ ] Status usa `data-s` e herda `--c`
- [ ] Nenhuma animação nova; se houver, está na lista oficial e justificada
- [ ] Animação só em estados "vivos"; estados parados são estáticos
- [ ] Animações usam `transform`/`opacity`
- [ ] Existe equivalente estático em `prefers-reduced-motion`
- [ ] Funciona em claro e escuro
- [ ] Funciona em 390 px (mobile) e 1440 px (desktop)
- [ ] Cor não é o único indicador (há texto/ícone/forma)
- [ ] Estados vazio, carregando e erro têm mensagem clara
- [ ] Screenshots de referência atualizados (e aprovados por quem cuida do design)
- [ ] Story do Storybook criada/atualizada

---

## 11. Erros comuns que quebram a identidade (evitar)

| Erro | Por que quebra | Correção |
|---|---|---|
| Animar tudo "para ficar bonito" | Perde o significado "movimento = atividade" | Animar só estados vivos |
| Usar outra cor para "pausado" em uma tela nova | Usuário deixa de reconhecer o status | Sempre `--pause` via `data-s` |
| Trocar a linha do Track por uma tabela | Perde a leitura de fluxo | Manter Track horizontal; tabela é outra visão |
| Spinner genérico no lugar de barra listrada | Some a noção de progresso | `ProgressBar` com listras |
| Modal para tudo | Interrompe o fluxo | Drawer para detalhes, modal só para decisões |
| Muitos alertas simultâneos | Fadiga; ninguém lê | Limite de 3 + sino com contador |
| Diagrama sem legenda | Ninguém entende cor/fio | Legenda sempre visível |
| Esconder o perfil Operador em menu | Erro de uso no chão de fábrica | Alternador visível no header |
| Ícones inconsistentes (mistura de emoji e SVG) | Aspecto amador | Escolher um conjunto e mapear por setor |
| Copiar CSS entre componentes | Deriva visual | Reusar componentes/tokens |

---

## 12. Como garantir isso ao migrar de stack

1. **Extraia primeiro** `tokens.css`, `themes.css` e `animations.css` *sem alterar valores* — eles são a alma do visual e independem de framework.
2. **Portar componente a componente**, comparando com o HTML original lado a lado (ou por screenshot) a cada passo.
3. Se usar **React Flow** para o diagrama, estilize nós e arestas com as **mesmas classes e keyframes** (`d-node`, `d-port`, `d-path`, `wireflow`, `portpulse`) e desative o estilo padrão da biblioteca.
4. Se usar **Tailwind**, mapeie o tema aos tokens (`theme.extend.colors = { run:'var(--run)', … }`) e mantenha os `@keyframes` no CSS global.
5. Só remova o protótipo depois que os **testes visuais** (seção 9.2) estiverem passando com a nova base.

---

## 13. Resumo em uma página (cole no README)

```
IDENTIDADE VISUAL DO FLUXO DE PRODUÇÃO

• Cor = status (run verde · wait cinza · pause âmbar · stop vermelho · done roxo)
• Movimento = atividade. Parado = estático.
• Cor nunca sozinha: sempre texto/ícone/forma.
• Status via data-s → variável --c. Sem hex fora de tokens.css.
• Animações só as do catálogo (animations.css). Só transform/opacity.
• Todo movimento tem equivalente estático em prefers-reduced-motion.
• Track, KPIs, Board/Lista/Diagrama, Drawer, Sino e Toast: mantêm papel e posição.
• Operador: 3 botões grandes. Gerência: visão completa.
• PR de UI só passa com screenshots claro/escuro, mobile/desktop e checklist.
```

---

*Gerado a partir da análise de `fluxo-producao-diagrama.html`.*
