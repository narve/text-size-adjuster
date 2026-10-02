import { defineConfig } from '@playwright/test';
import { baseConfig } from './playwright.base.js';

// Layer 2 (best-effort, TR3) — separate from the other configs since this uses
// playwright-webextext's own browser/context fixtures (a real packaged extension loaded into
// real Firefox) rather than the standard @playwright/test projects.
export default defineConfig({
  ...baseConfig,
  testMatch: ['extension.spec.ts'],
  fullyParallel: false,
  projects: undefined,
  use: {
    ...baseConfig.use,
    // playwright-webextext's Chromium path requires headed mode + launchPersistentContext and
    // is otherwise unrelated to our actual target; Firefox is both our primary target and the
    // one this library's fixtures support via a plain (optionally headless) launch().
    browserName: 'firefox',
  },
});
