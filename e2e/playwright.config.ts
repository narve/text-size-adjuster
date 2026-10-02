import { defineConfig } from '@playwright/test';
import { baseConfig } from './playwright.base.js';

export default defineConfig({
  ...baseConfig,
  testMatch: ['engine.spec.ts', 'userscript.spec.ts', 'script-tag.spec.ts'],
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
});
