import path from 'node:path';
import { EXTENSION_DIST, requireBuilt } from '../tools/paths.mjs';
import { test, expect } from './webextext-fixture.js';

/**
 * Layer 2 (TR3) — best-effort, non-gating. Drives the *real packaged extension* in real Firefox
 * via the community `playwright-webextext` package (Playwright itself has no official Firefox
 * extension-loading support). Runs headless fine for Firefox (unlike this library's Chromium
 * path, which requires headed mode + launchPersistentContext — irrelevant here since Firefox is
 * the target). Needs the extension already built via `npm run build -w packages/extension`.
 *
 * Deliberately not attempted here: driving the popup by navigating straight to its
 * `moz-extension://<id>/popup.html` URL. Firefox assigns that id as a random UUID per temporary
 * install (not the stable `browser_specific_settings.gecko.id` from the manifest), and Playwright
 * has no Firefox equivalent of Chromium's background-page/service-worker introspection to
 * discover it reliably. A flaky guess isn't worth it for a best-effort layer — the popup's actual
 * message-relay code path (content-script.ts's `browser.runtime.onMessage` handling) is simple
 * enough to be low-risk left uncovered here.
 */
test.beforeAll(() => requireBuilt(path.join(EXTENSION_DIST, 'manifest.json'), 'packages/extension'));

function readLargeRefSize(page: import('@playwright/test').Page) {
  return page.evaluate(
    () => parseFloat(getComputedStyle(document.querySelector('[data-tsa-ref="large"]')!).fontSize),
  );
}

test('content script auto-attaches, the widget scales the page, and the factor persists per origin on reload', async ({
  page,
}) => {
  await page.goto('/plain-px/');

  const widgetHost = page.locator('[data-tsa-ignore]');
  await expect(widgetHost).toBeAttached();

  // FR10.4: in the extension the on-page control stays hidden until the user zooms (the toolbar
  // button is always there). Pinch-zoom can't be simulated in Firefox here, so drive the hidden
  // control's buttons directly — they still dispatch to the content script's listeners.
  expect(await widgetHost.locator('.tsa-widget').evaluate((el) => (el as HTMLElement).hidden)).toBe(true);

  const before = await readLargeRefSize(page);
  for (let i = 0; i < 5; i += 1) {
    await widgetHost
      .locator('[data-action="increase"]')
      .evaluate((button) => (button as HTMLButtonElement).click());
  }
  const afterClicks = await readLargeRefSize(page);
  expect(afterClicks).toBeGreaterThan(before);

  // FR5.1: per-origin persistence — reloading the same origin should reapply the factor
  // automatically, without the user doing anything.
  await page.reload();
  await expect(page.locator('[data-tsa-ignore]')).toBeAttached();
  const afterReload = await readLargeRefSize(page);
  expect(afterReload).toBeCloseTo(afterClicks, 0);
});
