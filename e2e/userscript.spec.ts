import fs from 'node:fs';
import { test, expect } from '@playwright/test';
import { USERSCRIPT_BUNDLE, requireBuilt } from '../tools/paths.js';

test.beforeAll(() => requireBuilt(USERSCRIPT_BUNDLE, 'packages/userscript'));

/**
 * Sanity-checks the actual distributed artifact, not hand-copied source: injects the real built
 * `.user.js` (metadata header and all) the way a userscript manager would run it, and drives it
 * entirely through its own UI (the floating widget), not by reaching into engine internals.
 *
 * addInitScript executes the script immediately at document creation rather than waiting for the
 * `@run-at document-idle` a real userscript manager would honor — a harder case than normal,
 * since it means the engine attaches before the fixture's own content exists yet, relying
 * entirely on the MutationObserver path to pick it up as it's parsed in.
 */
test('the built .user.js mounts its widget and scales the page via the widget alone', async ({ page }) => {
  await page.addInitScript({ path: USERSCRIPT_BUNDLE });
  await page.goto('/plain-px/');

  const widgetHost = page.locator('[data-tsa-ignore]');
  await expect(widgetHost).toBeAttached();

  const readLargeRefSize = () =>
    page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('[data-tsa-ref="large"]')!).fontSize));

  const before = await readLargeRefSize();

  const increaseButton = widgetHost.locator('[data-action="increase"]');
  for (let i = 0; i < 5; i += 1) {
    await increaseButton.click();
  }

  const after = await readLargeRefSize();
  expect(after).toBeGreaterThan(before);
});

/**
 * Userscript managers run a script in every frame unless its header says otherwise; without
 * `@noframes`, every ad, video and comments frame got its own control, scaling on its own (code
 * review H3).
 */
test('the built .user.js only runs in the top frame', ({ browserName }) => {
  test.skip(browserName !== 'chromium', 'reads the file, no browser involved');
  const header = fs.readFileSync(USERSCRIPT_BUNDLE, 'utf8').split('// ==/UserScript==')[0];
  expect(header).toMatch(/^\/\/ @noframes\s*$/m);
});
