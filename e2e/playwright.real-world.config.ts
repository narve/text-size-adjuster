import { defineConfig, devices } from '@playwright/test';

// Separate from playwright.config.ts (whose testMatch only covers engine.spec.ts) so that the
// TR1a real-world checks stay non-gating and opt-in, run via `npm run test:real-world`, and never
// get swept into the hard-requirement `npm test` / `npm run build` chain.
export default defineConfig({
  testDir: '.',
  testMatch: ['real-world.spec.ts'],
  fullyParallel: true,
  retries: 0,
  reporter: [['list']],
  webServer: {
    command: 'node ../fixtures/server.mjs',
    url: 'http://127.0.0.1:4310/plain-px/',
    reuseExistingServer: !process.env.CI,
    timeout: 20_000,
  },
  use: {
    baseURL: 'http://127.0.0.1:4310',
  },
  projects: [
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
