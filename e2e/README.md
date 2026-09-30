# e2e

Playwright cobre, numa sessão:

1. Login da gerência
2. Login do operador por PIN
3. Pausar e concluir a OP do CNC
4. Importar planilha com linha inválida (botão de confirmar fica desligado)

```bash
pnpm e2e
```

Sobe API e Vite próprios, com banco temporário. Não reutiliza um `pnpm dev` que já esteja na porta 3001 ou 5173.
