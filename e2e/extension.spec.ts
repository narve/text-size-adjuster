import path from 'node:path';
import { EXTENSION_DIST, requireBuilt } from '../tools/paths.js';
import { BACKGROUND_IDLE_TIMEOUT_MS, test, expect } from './webextext-fixture.js';

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
 * discover it reliably. A flaky guess isn't worth it for a best-effort layer. The popup only sends
 * `tsa:*` messages to the top frame's content script, which applies them to the same engine the
 * on-page control drives here.
 */
test.beforeAll(() => requireBuilt(path.join(EXTENSION_DIST, 'manifest.json'), 'packages/extension'));

type Page = import('@playwright/test').Page;

function readLargeRefSize(page: Page) {
  return page.evaluate(
    () => parseFloat(getComputedStyle(document.querySelector('[data-tsa-ref="large"]')!).fontSize),
  );
}

function readCrossOriginSize(page: Page) {
  return page
    .frameLocator('iframe')
    .locator('[data-tsa-ref="cross-origin-check"]')
    .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
}

/**
 * Collects uncaught page errors and console errors. A content script's uncaught exception (e.g.
 * Firefox's "can't access dead object", code review C1) is reported on the page's console, so
 * this catches the extension failing silently even when the visible result looks plausible.
 */
function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  return errors;
}

/** Clicks the (possibly hidden, FR10.4) on-page control's button `times` times. */
async function clickWidget(page: Page, action: string, times = 1): Promise<void> {
  const button = page.locator('[data-tsa-ignore]').locator(`[data-action="${action}"]`);
  for (let i = 0; i < times; i += 1) {
    await button.evaluate((el) => (el as HTMLButtonElement).click());
  }
}

function widgetDisplay(page: Page) {
  return page.locator('[data-tsa-ignore]').locator('[data-tsa-display]');
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

/**
 * FR9.6: the on-page control has a gear that asks the background to open the options page. Only
 * that it's there and can be pressed without errors is checked here: Firefox opens the options
 * tab outside the test's isolated browser context, where Playwright can't see it. The Chrome
 * suite (extension-chrome.spec.ts) follows it all the way to the options page.
 */
test('the control has a gear for the options page', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/plain-px/');
  await expect(page.locator('[data-tsa-ignore]').locator('[data-action="settings"]')).toBeAttached();
  await clickWidget(page, 'settings');
  await page.waitForTimeout(500);
  expect(errors).toEqual([]);
});

/**
 * FR6.1/FR3.3: a cross-origin frame runs its own engine and follows the top frame, and a size
 * change still updates the control and is remembered. `delayed.html` holds the frame's document
 * back until well after the top frame's content script ran, which used to leave a dead child
 * engine behind that broke every later change (code review C1).
 */
for (const fixture of ['parent.html', 'delayed.html']) {
  test(`iframe-cross-origin/${fixture}: the frame follows, the control updates, the size is remembered`, async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await page.goto(`/iframe-cross-origin/${fixture}`);
    await expect(page.locator('[data-tsa-ignore]')).toBeAttached();
    // All Layer 2 tests share one browser profile and this fixture origin: start from normal size.
    await clickWidget(page, 'reset');
    await expect(widgetDisplay(page)).toHaveText('100%');
    // The frame's own content script has to be running before it can follow.
    await expect.poll(() => readCrossOriginSize(page)).toBe(18);
    const outerBefore = await readLargeRefSize(page);

    await clickWidget(page, 'increase', 5);

    await expect(widgetDisplay(page)).toHaveText('150%');
    expect(await readLargeRefSize(page)).toBeCloseTo(outerBefore * 1.5, 0);
    await expect.poll(() => readCrossOriginSize(page)).toBeCloseTo(27, 0);

    // FR5.1: remembered for the site, frame included, after a reload.
    await page.reload();
    await expect(widgetDisplay(page)).toHaveText('150%');
    await expect.poll(() => readLargeRefSize(page)).toBeCloseTo(outerBefore * 1.5, 0);
    await expect.poll(() => readCrossOriginSize(page)).toBeCloseTo(27, 0);

    // Only the site in the address bar is remembered, never the embed's own origin: opened on
    // its own, the embedded page is at normal size (code review H1).
    const embed = await page.context().newPage();
    const embedErrors = collectErrors(embed);
    await embed.goto('http://127.0.0.1:4311/iframe-cross-origin/child.html');
    await expect(widgetDisplay(embed)).toHaveText('100%');
    expect(
      await embed.evaluate(() =>
        parseFloat(getComputedStyle(document.querySelector('[data-tsa-ref="cross-origin-check"]')!).fontSize),
      ),
    ).toBe(18);
    await embed.close();
    expect(embedErrors).toEqual([]);

    await clickWidget(page, 'reset');
    await expect(widgetDisplay(page)).toHaveText('100%');
    await expect.poll(() => readCrossOriginSize(page)).toBe(18);

    expect(errors).toEqual([]);
  });
}

/**
 * Firefox unloads an idle background and restarts it with fresh globals (see
 * webextext-fixture.ts); frame sync must not depend on anything the background kept in memory
 * (code review H2).
 */
test('the frame still follows after the background has been unloaded while idle', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/iframe-cross-origin/parent.html');
  await expect(page.locator('[data-tsa-ignore]')).toBeAttached();
  await clickWidget(page, 'reset');
  await expect.poll(() => readCrossOriginSize(page)).toBe(18);

  await page.waitForTimeout(BACKGROUND_IDLE_TIMEOUT_MS * 4);
  await clickWidget(page, 'increase', 5);
  await expect(widgetDisplay(page)).toHaveText('150%');
  await expect.poll(() => readCrossOriginSize(page)).toBeCloseTo(27, 0);

  await clickWidget(page, 'reset');
  await expect.poll(() => readCrossOriginSize(page)).toBe(18);
  expect(errors).toEqual([]);
});

/** The engine's wait for late custom-element definitions also works from a content script (M3). */
test('a custom element defined after the content script ran has its shadow content scaled', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/shadow-dom-open/');
  await expect(page.locator('[data-tsa-ignore]')).toBeAttached();
  await clickWidget(page, 'reset');
  await page.evaluate(() => document.body.insertAdjacentHTML('beforeend', '<late-card></late-card>'));
  await page.evaluate(() => {
    customElements.define(
      'late-card',
      class extends HTMLElement {
        constructor() {
          super();
          this.attachShadow({ mode: 'open' }).innerHTML = '<p id="late" style="font-size: 20px">Late</p>';
        }
      },
    );
  });
  await clickWidget(page, 'increase', 5);
  await expect(widgetDisplay(page)).toHaveText('150%');
  await expect
    .poll(() =>
      page.evaluate(() => getComputedStyle(document.querySelector('late-card')!.shadowRoot!.querySelector('#late')!).fontSize),
    )
    .toBe('30px');
  await clickWidget(page, 'reset');
  expect(errors).toEqual([]);
});
