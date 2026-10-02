import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import { CORE_BUNDLE, PHONE_SCALE, PHONE_VIEWPORT, SCREENSHOT_DIR, fixtureScreenshot, requireBuilt } from '../tools/paths.mjs';
import { STANDARD_FIXTURES, FACTORS } from './fixtures.js';
import { gotoAndAttach, setFactor, type TsaWindow } from './helpers.js';

test.beforeAll(() => {
  requireBuilt(CORE_BUNDLE, 'packages/core');
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
});

async function readRefSizes(page: Page): Promise<{ small: number; large: number }> {
  return page.evaluate(() => {
    // document.querySelector doesn't pierce open shadow roots; this does, depth-first.
    function deepQuerySelector(selector: string, root: ParentNode = document): Element | null {
      const direct = root.querySelector(selector);
      if (direct) return direct;
      for (const el of Array.from(root.querySelectorAll('*'))) {
        const shadow = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
        if (shadow) {
          const found = deepQuerySelector(selector, shadow);
          if (found) return found;
        }
      }
      return null;
    }
    const read = (sel: string) => {
      const el = deepQuerySelector(sel);
      if (!el) throw new Error(`missing ${sel}`);
      return parseFloat(getComputedStyle(el).fontSize);
    };
    return { small: read('[data-tsa-ref="small"]'), large: read('[data-tsa-ref="large"]') };
  });
}

async function readImageSize(page: Page): Promise<{ width: number; height: number } | null> {
  return page.evaluate(() => {
    const img = document.querySelector<HTMLImageElement>('[data-tsa-ref="image"]');
    // A broken image renders its alt text instead, which *does* scale — so only a loaded image
    // counts.
    if (!img || !img.complete || img.naturalWidth === 0) return null;
    const rect = img.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  });
}

async function hasHorizontalOverflow(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
}

for (const fixture of STANDARD_FIXTURES) {
  test.describe(fixture.id, () => {
    for (const factor of FACTORS) {
      test(`preserves the small/large size ratio and avoids horizontal overflow at factor ${factor}`, async ({
        page,
      }) => {
        await gotoAndAttach(page, fixture.path);

        // large-dom-performance is tall enough at high factors to exceed browsers' ~32767px
        // screenshot height limit when captured full-page; a viewport screenshot is also more
        // representative there anyway (the interesting thing about that fixture is timing, not
        // its full scrolled content).
        const fullPage = fixture.id !== 'large-dom-performance';

        const before = await readRefSizes(page);
        const imageBefore = await readImageSize(page);
        expect(imageBefore).not.toBeNull();
        expect(await hasHorizontalOverflow(page)).toBe(false);
        await page.screenshot({
          path: path.join(SCREENSHOT_DIR, fixture.id, `${factor}-before.png`),
          fullPage,
        });

        await setFactor(page, factor);

        const after = await readRefSizes(page);
        await page.screenshot({
          path: path.join(SCREENSHOT_DIR, fixture.id, `${factor}-after.png`),
          fullPage,
        });

        // FR1.2: ratio between the two reference elements is preserved.
        expect(after.large / after.small).toBeCloseTo(before.large / before.small, 1);
        // Each element individually scaled by ~factor (also exercises FR2.5 on the
        // important-high-specificity fixture: if the override didn't win, this would stay ~1x).
        expect(after.small / before.small).toBeCloseTo(factor, 1);
        expect(after.large / before.large).toBeCloseTo(factor, 1);
        // FR1.3: no sideways scrolling introduced.
        expect(await hasHorizontalOverflow(page)).toBe(false);
        // Only text scales — an image keeps exactly its size (unlike page zoom).
        expect(await readImageSize(page)).toEqual(imageBefore);
      });
    }
  });
}

test.describe('iframe-same-origin', () => {
  for (const factor of FACTORS) {
    test(`content inside the same-origin iframe scales at factor ${factor}`, async ({ page }) => {
      await gotoAndAttach(page, '/iframe-same-origin/parent.html');
      const frame = page.frameLocator('iframe');
      const read = () =>
        Promise.all([
          frame.locator('[data-tsa-ref="small"]').evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
          frame.locator('[data-tsa-ref="large"]').evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
        ]).then(([small, large]) => ({ small, large }));

      const before = await read();
      await setFactor(page, factor);
      const after = await read();

      expect(after.small / before.small).toBeCloseTo(factor, 1);
      expect(after.large / before.large).toBeCloseTo(factor, 1);
      expect(after.large / after.small).toBeCloseTo(before.large / before.small, 1);
    });
  }
});

test.describe('iframe-cross-origin', () => {
  for (const factor of FACTORS) {
    test(`outer page scales while the cross-origin iframe is left untouched at factor ${factor}`, async ({
      page,
    }) => {
      await gotoAndAttach(page, '/iframe-cross-origin/parent.html');
      const crossFrame = page.frameLocator('iframe');

      const beforeOuter = await readRefSizes(page);
      const beforeInner = await crossFrame
        .locator('[data-tsa-ref="cross-origin-check"]')
        .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));

      await setFactor(page, factor);

      const afterOuter = await readRefSizes(page);
      const afterInner = await crossFrame
        .locator('[data-tsa-ref="cross-origin-check"]')
        .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));

      // FR6.1: cross-origin content is untouched, byte-for-byte unchanged.
      expect(afterInner).toBe(beforeInner);
      // The outer page must still scale normally regardless.
      expect(afterOuter.small / beforeOuter.small).toBeCloseTo(factor, 1);
      expect(afterOuter.large / beforeOuter.large).toBeCloseTo(factor, 1);
    });
  }
});

test.describe('spa-mutation', () => {
  test('content injected after load is captured automatically, without a manual rescan', async ({
    page,
  }) => {
    await gotoAndAttach(page, '/spa-mutation/');
    await page.click('#load-more');
    await page.waitForFunction(() => {
      const el = document.querySelector('[data-tsa-ref="large"]');
      return el !== null && el.hasAttribute('data-tsa-scaled');
    });

    const before = await readRefSizes(page);
    await setFactor(page, 2);
    const after = await readRefSizes(page);

    expect(after.large / before.large).toBeCloseTo(2, 1);
    expect(after.small / before.small).toBeCloseTo(2, 1);
  });
});

test.describe('line-height-mixed', () => {
  test('normal stays untouched; unitless and explicit px both scale with the factor (FR2.3)', async ({
    page,
  }) => {
    await gotoAndAttach(page, '/line-height-mixed/');

    const readLineHeights = () =>
      page.evaluate(() => {
        const raw = (sel: string) => getComputedStyle(document.querySelector(sel)!).lineHeight;
        return {
          normal: raw('[data-tsa-lh-check="normal"]'), // resolves to the literal string "normal"
          unitless: parseFloat(raw('[data-tsa-lh-check="unitless"]')), // resolves to a used px value, surprisingly
          px: parseFloat(raw('[data-tsa-lh-check="px"]')),
        };
      });

    const before = await readLineHeights();
    await setFactor(page, 2);
    const after = await readLineHeights();

    // `normal` is the one case left alone — its resolved value stays the literal keyword, and
    // its rendering already tracks font-size with no help needed from us.
    expect(after.normal).toBe(before.normal);
    // Both the unitless and the explicit px line-height resolve to a used px value via
    // getComputedStyle, so both get captured and rescaled the same way (FR2.3).
    expect(after.unitless / before.unitless).toBeCloseTo(2, 1);
    expect(after.px / before.px).toBeCloseTo(2, 1);
  });
});

test.describe('large-dom-performance', () => {
  test('initial capture completes promptly; a later factor change is much faster (FR7)', async ({
    page,
  }) => {
    await page.addInitScript({ path: CORE_BUNDLE });
    await page.goto('/large-dom-performance/');

    const timings = await page.evaluate(() => {
      const w = window as unknown as TsaWindow;
      const engine = w.TSA_CORE.createEngine();
      const t0 = performance.now();
      engine.attach();
      const t1 = performance.now();
      engine.setFactor(1.5);
      const t2 = performance.now();
      return { initialCaptureMs: t1 - t0, factorChangeMs: t2 - t1 };
    });

    // Generous absolute ceiling (CI machines vary) — this is "no noticeable freeze", not a tight budget.
    expect(timings.initialCaptureMs).toBeLessThan(3000);
    // The whole point of the CSS-variable design (FR7.2): a later change only touches one
    // property, no DOM walk, so it should be dramatically cheaper than the initial capture.
    expect(timings.factorChangeMs).toBeLessThan(Math.max(5, timings.initialCaptureMs / 3));
  });
});

test.describe('ignoreAttr exclusion', () => {
  test('an element marked data-tsa-ignore, and its subtree, are left untouched', async ({ page }) => {
    await gotoAndAttach(page, '/ignore-attr/');

    const before = await page.evaluate(() => ({
      normal: getComputedStyle(document.querySelector('#normal')!).fontSize,
      ignored: getComputedStyle(document.querySelector('#ignored')!).fontSize,
    }));

    await setFactor(page, 2);

    const after = await page.evaluate(() => ({
      normal: getComputedStyle(document.querySelector('#normal')!).fontSize,
      ignored: getComputedStyle(document.querySelector('#ignored')!).fontSize,
      ignoredScanned: document.querySelector('#ignored')!.hasAttribute('data-tsa-scaled'),
    }));

    expect(after.normal).not.toBe(before.normal); // the rest of the page still scales normally
    expect(after.ignored).toBe(before.ignored); // the ignored subtree is completely untouched
    expect(after.ignoredScanned).toBe(false);
  });
});

/**
 * Gallery screenshots on a phone-sized viewport (the tool's motivating use case), separate from
 * the desktop-viewport assertions above: a 1280px-wide desktop shot squeezed into half a docs
 * column is unreadable. Screenshot-only apart from the image-size check — the ratio and overflow
 * guarantees are asserted above.
 */
test.describe('phone gallery screenshots', () => {
  test.use({ viewport: PHONE_VIEWPORT, deviceScaleFactor: PHONE_SCALE });

  for (const fixture of STANDARD_FIXTURES) {
    test(`${fixture.id} at 1x and 2x`, async ({ page, browserName }) => {
      test.skip(browserName !== 'chromium', 'one set of gallery screenshots is enough');
      await gotoAndAttach(page, fixture.path);
      const imageBefore = await readImageSize(page);
      await page.screenshot({ path: fixtureScreenshot(fixture.id, 1) });
      await setFactor(page, 2);
      await page.screenshot({ path: fixtureScreenshot(fixture.id, 2) });
      expect(await readImageSize(page)).toEqual(imageBefore);
    });
  }
});
