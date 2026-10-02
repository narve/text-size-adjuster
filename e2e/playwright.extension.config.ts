import { defineConfig } from '@playwright/test';

// Layer 2 (best-effort, TR3) — separate from the other configs since this uses
// playwright-webextext's own browser/context fixtures (a real packaged extension loaded into
// real Firefox) rather than the standard @playwright/test projects.
export default defineConfig({
  testDir: '.',
  testMatch: ['extension.spec.ts'],
  fullyParallel: false,
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
    // playwright-webextext's Chromium path requires headed mode + launchPersistentContext and
    // is otherwise unrelated to our actual target; Firefox is both our primary target and the
    // one this library's fixtures support via a plain (optionally headless) launch().
    browserName: 'firefox',
  },
});
