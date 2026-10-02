import { test as base, expect } from '@playwright/test';
import { withExtension } from 'playwright-webextext';
import { EXTENSION_DIST } from '../tools/paths.js';

/** How long Firefox lets the extension's background sit idle before unloading it, in the tests. */
export const BACKGROUND_IDLE_TIMEOUT_MS = 1000;

/**
 * Firefox with the packaged extension installed (playwright-webextext's own `createFixture`, plus
 * one preference it has no option for). Firefox unloads an idle MV3 background after 30 s by
 * default and starts it again, with fresh globals, for the next event; the tests make that happen
 * after one second, so anything that only works while the background stays loaded fails here
 * instead of on a user's long-lived tab.
 */
export const test = base.extend({
  browser: [
    async ({ playwright }, use) => {
      const browser = await withExtension(playwright.firefox, EXTENSION_DIST).launch({
        firefoxUserPrefs: { 'extensions.background.idle.timeout': BACKGROUND_IDLE_TIMEOUT_MS },
      });
      await use(browser);
      await browser.close();
    },
    { scope: 'worker', timeout: 0 },
  ],
});

export { expect };
