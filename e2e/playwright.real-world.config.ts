import { defineConfig } from '@playwright/test';
import { baseConfig } from './playwright.base.js';

// Separate from playwright.config.ts so that the TR1a real-world checks stay non-gating and
// opt-in, run via `npm run test:real-world`, and never get swept into the hard-requirement
// `npm test` / `npm run build` chain.
export default defineConfig({
  ...baseConfig,
  testMatch: ['real-world.spec.ts'],
});
