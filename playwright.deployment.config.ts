import { defineConfig } from '@playwright/test';
const baseURL = process.env.DEPLOYMENT_URL;
if (!baseURL)
  throw new Error('DEPLOYMENT_URL에 검증할 사이트 주소를 지정하세요.');
const channel =
  process.env.PLAYWRIGHT_CHANNEL ??
  (process.platform === 'win32' ? 'msedge' : 'chromium');
export default defineConfig({
  testDir: './e2e',
  testMatch: 'release.spec.ts',
  workers: 1,
  timeout: 60_000,
  use: {
    baseURL,
    headless: true,
    ...(channel === 'chromium' ? {} : { channel }),
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
});
