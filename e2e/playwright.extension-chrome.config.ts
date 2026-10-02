import { defineConfig } from '@playwright/test';
import { baseConfig } from './playwright.base.js';

// Layer 2 for the Chrome build (FR8, best-effort): unlike Firefox, Playwright loads extensions
// into Chromium itself, via a persistent context (see extension-chrome.spec.ts).
export default defineConfig({
  ...baseConfig,
  testMatch: ['extension-chrome.spec.ts'],
  fullyParallel: false,
  projects: undefined,
});
