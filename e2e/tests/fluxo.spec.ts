import { expect, test } from '@playwright/test';

test('gerência entra, operador pausa e conclui, planilha com erro não importa', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('E-mail').fill('gerencia@fabrica.local');
  await page.getByRole('textbox', { name: 'Senha' }).fill('Gestao#2401');
  await page.getByRole('button', { name: /Entrar como gerência/ }).click();
  await expect(page.getByRole('heading', { name: 'Fluxo de Produção' })).toBeVisible();

  await page.getByRole('button', { name: 'Sair' }).click();
  await page.getByRole('button', { name: 'Operador' }).click();
  await page.getByRole('button', { name: 'Setor CNC' }).click();
  await page.getByLabel('PIN de 4 dígitos').fill('1101');
  await expect(page.getByRole('heading', { name: /Sofá Milano/ })).toBeVisible();

  await page.getByRole('button', { name: 'Pausar' }).click();
  await page.getByRole('radio', { name: 'Falta de material' }).check();
  await page.getByRole('button', { name: 'Registrar pausa' }).click();
  await expect(page.getByText('Pausada: Falta de material')).toBeVisible();

  await page.getByRole('button', { name: 'Retomar' }).click();
  await page.getByRole('button', { name: 'Finalizar' }).click();
  await expect(page.getByText('Nenhuma ordem neste setor agora')).toBeVisible();

  await page.locator('[aria-label="Sair"]').evaluate((el: HTMLButtonElement) => el.click());
  await expect(page.getByLabel('E-mail')).toBeVisible();
  await page.getByLabel('E-mail').fill('gerencia@fabrica.local');
  await page.getByRole('textbox', { name: 'Senha' }).fill('Gestao#2401');
  await page.getByRole('button', { name: /Entrar como gerência/ }).click();
  await page.getByRole('button', { name: 'Importar planejamento' }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: 'lote.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      'produto,quantidade,lote,cliente,pedido,urgente,prazo\nSofá Teste,2,L1,Cliente,PED-1,nao,2026-10-01\n,0,L1,Cliente,PED-2,nao,2026-10-01\n',
    ),
  });
  await expect(page.getByText('Linha 3: Produto vazio')).toBeVisible();
  await expect(page.getByRole('button', { name: /Importar \d+ ordens/ })).toBeDisabled();
});
