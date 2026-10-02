import { test, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CORE_BUNDLE = path.resolve(__dirname, '../packages/core/dist/index.global.js');
const SITES_FILE = path.resolve(__dirname, '../fixtures/real-world/sites.json');
const SNAPSHOT_DIR = path.resolve(__dirname, '../fixtures/real-world/snapshots');
const SCREENSHOT_DIR = path.resolve(__dirname, 'screenshots', 'real-world');

interface SiteDef {
  id: string;
  url: string;
  description: string;
}

const sites: SiteDef[] = JSON.parse(fs.readFileSync(SITES_FILE, 'utf8'));

// A phone-sized viewport: the tool's motivating use case, and the layout the snapshots were
// captured in (see fixtures/real-world/download.mjs). deviceScaleFactor 2 keeps screenshots crisp.
test.use({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2 });

test.beforeAll(() => {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
});

/**
 * TR1a: informative, non-gating checks against real-world site snapshots (run them first via
 * `npm run download -w fixtures`). These aren't held to the same strict pixel-ratio bar as the
 * synthetic TR1 fixtures — real pages vary too much for that — the bar here is "the engine runs
 * on a real, messy page without crashing and visibly scales a meaningful chunk of it."
 */
for (const site of sites) {
  test(`${site.id} (${site.description})`, async ({ page }) => {
    const snapshotPath = path.join(SNAPSHOT_DIR, site.id, 'index.html');
    test.skip(
      !fs.existsSync(snapshotPath),
      `No snapshot for "${site.id}" — run "npm run download -w fixtures" first.`,
    );
    test.skip(!fs.existsSync(CORE_BUNDLE), 'Run "npm run build -w packages/core" first.');

    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.addInitScript({ path: CORE_BUNDLE });
    await page.goto(`/real-world/snapshots/${site.id}/`, { waitUntil: 'load', timeout: 30_000 });

    await page.evaluate(() => {
      interface MinimalEngine {
        attach(): void;
        setFactor(k: number): number;
      }
      const w = window as unknown as {
        TSA_CORE: { createEngine: () => MinimalEngine };
        __tsa?: MinimalEngine;
      };
      w.__tsa = w.TSA_CORE.createEngine();
      w.__tsa.attach();
    });

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${site.id}-1x.png`) });

    const scaledCount = await page.evaluate(() => document.querySelectorAll('[data-tsa-scaled]').length);
    // A real page has at least a handful of text elements; this just confirms capture actually
    // ran, not a precise count.
    expect(scaledCount).toBeGreaterThan(10);

    await page.evaluate(() => {
      (window as unknown as { __tsa: { setFactor: (k: number) => number } }).__tsa.setFactor(2);
    });

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${site.id}-2x.png`) });

    // Not asserted on: snapshots have their own scripts stripped, so errors here would come from
    // live third-party iframes (ads, embeds) — out of our control. Logged for visibility only.
    if (pageErrors.length > 0) {
      console.warn(`[${site.id}] ${pageErrors.length} uncaught page error(s), likely unrelated third-party scripts:`, pageErrors);
    }
  });
}
