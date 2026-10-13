import { defineConfig } from '@playwright/test';
const base = process.env.VITE_BASE_PATH || '/MaskingViewer/';
export default defineConfig({
  testDir: './e2e',
  workers: 1,
  timeout: 30_000,
  use: {
    baseURL: `http://127.0.0.1:4183${base}`,
    headless: true,
    ...(process.platform === 'win32' ? { channel: 'msedge' } : {}),
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1 --port 4183 --strictPort',
    url: `http://127.0.0.1:4183${base}`,
    reuseExistingServer: false,
    env: { VITE_BASE_PATH: base },
  },
});
