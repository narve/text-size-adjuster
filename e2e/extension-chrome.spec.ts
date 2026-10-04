import { test as base, expect, chromium, type BrowserContext, type Page } from '@playwright/test';
import path from 'node:path';
import { EXTENSION_CHROME_DIST, requireBuilt } from '../tools/paths.js';

/**
 * Layer 2 for the Chrome build (FR8, best-effort): the packaged extension from dist-chrome/
 * (`npm run build:chrome -w packages/extension`), loaded into Chromium. Covers what the Firefox
 * spec covers, plus the popup, which Chromium lets us open by its stable extension URL.
 */
const test = base.extend<{ context: BrowserContext; extensionId: string }>({
  // eslint-disable-next-line no-empty-pattern
  context: async ({}, use) => {
    requireBuilt(path.join(EXTENSION_CHROME_DIST, 'manifest.json'), 'packages/extension (then build:chrome)');
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium', // the full Chromium build, which supports extensions headless
      args: [`--disable-extensions-except=${EXTENSION_CHROME_DIST}`, `--load-extension=${EXTENSION_CHROME_DIST}`],
    });
    await use(context);
    await context.close();
  },
  extensionId: async ({ context }, use) => {
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
    await use(new URL(worker.url()).host);
  },
});

function largeRefSize(page: Page): Promise<number> {
  return page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('[data-tsa-ref="large"]')!).fontSize));
}

test('content script scales the page, and the size persists per origin on reload', async ({ context }) => {
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await page.goto('/plain-px/');

  const widget = page.locator('[data-tsa-ignore]');
  await expect(widget).toBeAttached();
  const before = await largeRefSize(page);
  // The control is hidden until the user zooms (FR10.4); its buttons still work.
  for (let i = 0; i < 5; i += 1) {
    await widget.locator('[data-action="increase"]').evaluate((button) => (button as HTMLButtonElement).click());
  }
  const after = await largeRefSize(page);
  expect(after).toBeGreaterThan(before);

  await page.reload();
  await expect(page.locator('[data-tsa-ignore]')).toBeAttached();
  await expect.poll(() => largeRefSize(page)).toBeCloseTo(after, 0);
  expect(errors).toEqual([]);
});

test('the popup drives the page in the active tab', async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto('/plain-px/');
  await expect(page.locator('[data-tsa-ignore]')).toBeAttached();
  const before = await largeRefSize(page);

  // The popup acts on the active tab, which it looks up as it opens: make that the page, not
  // the popup's own tab, before loading it.
  const popup = await context.newPage();
  await page.bringToFront();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await popup.locator('#increase').click();

  await expect(popup.locator('#display')).toHaveText('110%');
  await expect.poll(() => largeRefSize(page)).toBeCloseTo(before * 1.1, 0);
});

/** FR9.6. The control is hidden until the user zooms (FR10.4); its buttons still work. */
test("the control's gear opens the options page", async ({ context }) => {
  const page = await context.newPage();
  await page.goto('/plain-px/');
  const gear = page.locator('[data-tsa-ignore]').locator('[data-action="settings"]');
  await expect(gear).toBeAttached();
  const [options] = await Promise.all([
    context.waitForEvent('page'),
    gear.evaluate((button) => (button as HTMLButtonElement).click()),
  ]);
  await expect(options).toHaveURL(/\/options\.html$/);
});

test('the options page shows the version and the saved settings', async ({ context, extensionId }) => {
  const options = await context.newPage();
  await options.goto(`chrome-extension://${extensionId}/options.html`);
  await expect(options.locator('#version')).toHaveText(/^Version \d+\.\d+\.\d+$/);
  await expect(options.locator('input[name="position"]:checked')).toHaveValue('bottom-right');
  await expect(options.locator('#autoRemember')).toBeChecked();
});
