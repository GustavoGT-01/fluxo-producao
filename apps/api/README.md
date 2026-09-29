# API

Fastify + SQLite (`node:sqlite`). Sessão em cookie httpOnly.

## Subir

Na raiz do monorepo: `pnpm dev` (web + api).

API sozinha: `pnpm --filter api dev` na porta 3001.

## Contas de demonstração

Gerência: `gerencia@fabrica.local` / `Gestao#2401`

Operador: escolhe o setor e informa o PIN.

| Setor | PIN |
|---|---|
| CNC | 1101 |
| Metalúrgica | 1102 |
| Laminação | 1103 |
| Marcenaria | 1104 |
| Espumação | 1105 |
| Preparação | 1106 |
| Tapeçaria | 1107 |
| Corte de tecido | 1108 |
| Costura | 1109 |
| Embalagem | 1110 |
| Controle de qualidade | 1111 |
| Finalizado | 1112 |

Operador só lê e grava o próprio setor. Interromper ordem, editar o grafo, métricas e importar planilha exigem gerência. O servidor recusa o resto com 403.

Banco local: `apps/api/data/fluxo.sqlite`. Para recriar as contas, apague o arquivo.
