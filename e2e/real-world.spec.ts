import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import {
  CORE_BUNDLE,
  PHONE_SCALE,
  PHONE_VIEWPORT,
  readSites,
  realWorldScreenshot,
  realWorldSnapshot,
} from '../tools/paths.js';
import { gotoAndAttach, setFactor } from './helpers.js';

const sites = readSites();

// A phone-sized viewport: the tool's motivating use case, and the layout the snapshots were
// captured in (see fixtures/real-world/download.js). deviceScaleFactor 2 keeps screenshots crisp.
// isMobile makes Chromium lay pages out like a phone browser, so a page without a viewport meta
// tag is laid out 980px wide and shrunk to fit, as on a real phone. Playwright's Firefox can't
// emulate that, so the gallery screenshots come from Chromium only.
test.use({
  viewport: PHONE_VIEWPORT,
  deviceScaleFactor: PHONE_SCALE,
  isMobile: async ({ browserName }, use) => use(browserName === 'chromium'),
});

/**
 * Scrolls so the element matching the Playwright `selector` (e.g. an article's first paragraph, past its big headline) sits
 * at the top of the screen, just below any fixed or sticky header. Re-run after scaling, since
 * everything above it grows.
 */
async function scrollToElement(page: Page, selector: string | undefined): Promise<void> {
  if (!selector) return;
  await page
    .locator(selector)
    .first()
    .evaluate((el) => {
      el.scrollIntoView({ block: 'start' });
      const header = document
        .elementsFromPoint(window.innerWidth / 2, 1)
        .filter((e) => ['fixed', 'sticky'].includes(getComputedStyle(e).position))
        .reduce((bottom, e) => Math.max(bottom, e.getBoundingClientRect().bottom), 0);
      window.scrollBy(0, el.getBoundingClientRect().top - header - 16);
    });
}

/**
 * TR1a: informative, non-gating checks against real-world site snapshots (run them first via
 * `npm run download -w fixtures`). These aren't held to the same strict pixel-ratio bar as the
 * synthetic TR1 fixtures — real pages vary too much for that — the bar here is "the engine runs
 * on a real, messy page without crashing and visibly scales a meaningful chunk of it."
 */
for (const site of sites) {
  test(`${site.id} (${site.description})`, async ({ page, browserName }) => {
    const screenshot = async (factor: number) => {
      if (browserName === 'chromium') await page.screenshot({ path: realWorldScreenshot(site.id, factor) });
    };
    test.skip(
      !fs.existsSync(realWorldSnapshot(site.id)),
      `No snapshot for "${site.id}" — run "npm run download -w fixtures" first.`,
    );
    test.skip(!fs.existsSync(CORE_BUNDLE), 'Run "npm run build -w packages/core" first.');

    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await gotoAndAttach(page, `/real-world/snapshots/${site.id}/`, { waitUntil: 'load', timeout: 30_000 });

    await scrollToElement(page, site.screenshotFrom);
    await screenshot(1);

    await setFactor(page, 2);
    const scaledCount = await page.evaluate(() => document.querySelectorAll('[data-tsa-scaled]').length);
    // A real page has at least a handful of text elements; this just confirms capture actually
    // ran, not a precise count.
    expect(scaledCount).toBeGreaterThan(10);
    await scrollToElement(page, site.screenshotFrom);

    await screenshot(2);

    // Not asserted on: snapshots have their own scripts stripped, so errors here would come from
    // live third-party iframes (ads, embeds) — out of our control. Logged for visibility only.
    if (pageErrors.length > 0) {
      console.warn(`[${site.id}] ${pageErrors.length} uncaught page error(s), likely unrelated third-party scripts:`, pageErrors);
    }
  });
}
