import os from 'node:os';
import path from 'node:path';
import { defineConfig } from '@playwright/test';

const dbFile = path.join(os.tmpdir(), `fluxo-e2e-${process.pid}.sqlite`);

export default defineConfig({
  testDir: './tests',
  workers: 1,
  timeout: 60_000,
  use: { baseURL: 'http://127.0.0.1:5173' },
  webServer: [
    {
      command: 'pnpm dev:api',
      url: 'http://127.0.0.1:3001/api/health',
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        ...process.env,
        FLUXO_DB: dbFile,
        AUTH_SECRET: 'e2e-secret',
      },
    },
    {
      command: 'pnpm --filter web exec vite --host 127.0.0.1 --port 5173',
      url: 'http://127.0.0.1:5173',
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
