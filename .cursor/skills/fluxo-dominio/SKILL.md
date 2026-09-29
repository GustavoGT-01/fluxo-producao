---
name: fluxo-dominio
description: Regras de domínio do fluxo de produção — DAG, canStart, progressBySector, ciclo e testes. Use ao modelar ordem, setor, dependência, avanço, filtro ou métrica, ou ao corrigir bugs B1–B7 do plano.
---

# Domínio — fluxo de produção

Fonte: `ESTRUTURA-PROJETO-fluxo-producao.md` §5 e `PLANO-MELHORIA-fluxo-producao.md` Fase 0.

## Modelo

- `Sector.deps`: ids dos pré-requisitos. Independente = `deps.length === 0`. Não persistir flag `indep` como fonte da verdade.
- `Order.progressBySector`: status e progresso por setor. Proibido um único `stage: number` como motor.
- Status: `run | wait | pause | stop | done`.

## Funções puras (sem React, DOM, fetch)

- `wouldCreateCycle(sectors, from, to)` — true se a aresta `from → to` fecha ciclo. Chamar antes de gravar.
- `topoSort(sectors)` — ordem visual do track. Ciclo lança erro.
- `canStart(order, sector)` — todos os `deps` com status `done`.
- `availableSectors`, `isOrderDone`, `filterOrders`.
- `isIndependent(sector)`.

## Aceite

- Recarregar restaura `deps` e `pos` (persist `version: 1`).
- A→B→A bloqueado.
- Tapeçaria só inicia com Preparação, Espumação e Costura em `done`.
- Setor independente inicia sem pré-requisito.
- Testes Vitest em `domain/__tests__/` cobrem ciclo, `canStart` e independentes.

## Fora do domínio

Simulação (`tick`) fica em `services/simulator.ts` e só com `VITE_DEMO`. UI não decide se a OP pode entrar no setor.
