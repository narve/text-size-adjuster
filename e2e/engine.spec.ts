import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import { CORE_BUNDLE, PHONE_SCALE, PHONE_VIEWPORT, SCREENSHOT_DIR, fixtureScreenshot, requireBuilt } from '../tools/paths.js';
import { STANDARD_FIXTURES, FACTORS } from './fixtures.js';
import { attachEngine, gotoAndAttach, setFactor, type MinimalEngine, type TsaWindow } from './helpers.js';

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

/**
 * An iframe's *initial* document is a same-origin, already-complete about:blank placeholder until
 * its real document arrives. The engine must not adopt that placeholder and then consider the
 * frame done: the real document (and every later navigation of the frame) has to be picked up.
 * In Firefox's content scripts, the stale child engine also turned into a "dead object" that made
 * every later factor change throw (code review C1).
 */
test.describe('iframe lifecycle', () => {
  const readChildLarge = (page: Page) =>
    page
      .frameLocator('iframe')
      .locator('[data-tsa-ref="large"]')
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));

  async function waitForChildLoad(page: Page, trigger: () => Promise<void>): Promise<void> {
    const loaded = page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          document.querySelector('iframe')!.addEventListener('load', () => resolve(), { once: true }),
        ),
    );
    await trigger();
    await loaded;
  }

  test('a frame whose document arrives after the engine attached is scaled', async ({ page }) => {
    const errors: Error[] = [];
    page.on('pageerror', (error) => errors.push(error));
    await gotoAndAttach(page, '/iframe-same-origin/parent.html');
    // Replace the fixture's frame with one whose document is held back by the server; the
    // engine sees it (via its MutationObserver) while it is still the about:blank placeholder.
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          const iframe = document.createElement('iframe');
          iframe.addEventListener('load', () => resolve(), { once: true });
          iframe.src = 'child.html?delay=800';
          document.querySelector('iframe')!.replaceWith(iframe);
        }),
    );
    const before = await readChildLarge(page);
    await setFactor(page, 2);
    expect((await readChildLarge(page)) / before).toBeCloseTo(2, 1);
    expect(errors).toEqual([]);
  });

  test('a frame that navigates after it was scaled is scaled again', async ({ page }) => {
    const errors: Error[] = [];
    page.on('pageerror', (error) => errors.push(error));
    await gotoAndAttach(page, '/iframe-same-origin/parent.html');
    const original = await readChildLarge(page);
    await setFactor(page, 2);
    expect((await readChildLarge(page)) / original).toBeCloseTo(2, 1);

    await waitForChildLoad(page, () =>
      page.evaluate(() => {
        document.querySelector('iframe')!.src = 'child.html?navigated';
      }),
    );
    // The new document picks up the current factor as soon as it is attached…
    expect((await readChildLarge(page)) / original).toBeCloseTo(2, 1);
    // …and keeps following later changes.
    await setFactor(page, 3);
    expect((await readChildLarge(page)) / original).toBeCloseTo(3, 1);
    expect(errors).toEqual([]);
  });

  test('a frame without src that is filled in with document.write is scaled', async ({ page }) => {
    await gotoAndAttach(page, '/iframe-same-origin/parent.html');
    await page.evaluate(() => {
      const iframe = document.createElement('iframe');
      document.querySelector('iframe')!.replaceWith(iframe);
    });
    // Give the MutationObserver a turn to adopt the (genuine, src-less) about:blank document.
    await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 0)));
    await page.evaluate(() => {
      const doc = document.querySelector('iframe')!.contentDocument!;
      doc.open();
      doc.write('<!doctype html><p data-tsa-ref="large" style="font-size: 20px">written</p>');
      doc.close();
    });
    await setFactor(page, 2);
    expect(await readChildLarge(page)).toBeCloseTo(40, 0);
  });
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

/**
 * Only text is scaled, never the page's root font size: `rem` lengths are also used for layout
 * (widths, grid tracks, gaps), and scaling <html> made those grow with the text and spill
 * sideways on a phone (code review M1).
 */
test.describe('rem-based layout', () => {
  test.use({ viewport: { width: 360, height: 740 } });

  test('rem widths and grid tracks keep their size while rem text scales', async ({ page }) => {
    await gotoAndAttach(page, '/rem-em/');
    const measure = () =>
      page.evaluate(() => {
        const box = document.querySelector('[data-tsa-ref="rem-box"]')!;
        const grid = document.querySelector('[data-tsa-ref="rem-grid"]')!;
        return {
          boxWidth: box.getBoundingClientRect().width,
          columns: getComputedStyle(grid).gridTemplateColumns.split(' ').length,
          heading: parseFloat(getComputedStyle(document.querySelector('[data-tsa-ref="large"]')!).fontSize),
        };
      });
    const before = await measure();
    await setFactor(page, 2);
    const after = await measure();

    expect(after.heading / before.heading).toBeCloseTo(2, 1);
    expect(after.boxWidth).toBe(before.boxWidth);
    expect(after.columns).toBe(before.columns);
    expect(await hasHorizontalOverflow(page)).toBe(false);
  });

  test('the root element, <head> contents, line breaks and SVG are left alone', async ({ page }) => {
    await page.addInitScript({ path: CORE_BUNDLE });
    await page.goto('/rem-em/');
    await page.evaluate(() => {
      document.body.insertAdjacentHTML(
        'beforeend',
        '<p>a<br>b<wbr>c</p><svg width="200" height="40"><text id="svg-label" x="0" y="30" font-size="20">Logo</text></svg>',
      );
    });
    await attachEngine(page);
    await setFactor(page, 2);
    const result = await page.evaluate(() => ({
      scaled: ['html', 'head', 'title', 'style', 'meta', 'br', 'wbr', 'svg', '#svg-label'].filter((sel) =>
        document.querySelector(sel)!.hasAttribute('data-tsa-scaled'),
      ),
      svgText: getComputedStyle(document.querySelector('#svg-label')!).fontSize,
      body: document.body.hasAttribute('data-tsa-scaled'),
    }));
    expect(result.scaled).toEqual([]);
    expect(result.svgText).toBe('20px');
    expect(result.body).toBe(true);
  });
});

test.describe('late shadow roots', () => {
  test('a custom element defined after the engine attached has its shadow content scaled', async ({ page }) => {
    await page.addInitScript({ path: CORE_BUNDLE });
    await page.goto('/shadow-dom-open/');
    // In the page, but not defined yet: no shadow root when the engine scans it (code review M3).
    await page.evaluate(() => document.body.insertAdjacentHTML('beforeend', '<late-card></late-card>'));
    await attachEngine(page);
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
    // whenDefined resolves asynchronously.
    await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 0)));
    await setFactor(page, 2);
    const size = await page.evaluate(
      () => getComputedStyle(document.querySelector('late-card')!.shadowRoot!.querySelector('#late')!).fontSize,
    );
    expect(size).toBe('40px');
  });
});

/**
 * Sizes are captured as pixels. When the viewport width changes (a phone rotated, a window
 * resized), viewport-relative sizes and media queries must apply again (code review M2).
 */
test.describe('viewport width changes', () => {
  test.use({ viewport: { width: 360, height: 740 } });

  test('viewport-relative sizes and media queries follow a resize, at the current factor', async ({ page }) => {
    await page.addInitScript({ path: CORE_BUNDLE });
    await page.goto('/plain-px/');
    await page.evaluate(() => {
      document.head.insertAdjacentHTML(
        'beforeend',
        '<style>#vw { font-size: 4vw } #mq { font-size: 16px } @media (min-width: 600px) { #mq { font-size: 24px } }</style>',
      );
      document.body.insertAdjacentHTML(
        'beforeend',
        '<p id="vw">vw</p><p id="mq">media query</p><p id="inline" style="font-size: 10px !important">inline</p>',
      );
    });
    await attachEngine(page);
    await setFactor(page, 2);
    const read = () =>
      page.evaluate(() =>
        Object.fromEntries(
          // Rounded: Firefox resolves font sizes to 1/16 px.
          ['vw', 'mq', 'inline'].map((id) => [
            id,
            Math.round(parseFloat(getComputedStyle(document.getElementById(id)!).fontSize) * 10) / 10,
          ]),
        ),
      );
    expect(await read()).toEqual({ vw: 28.8, mq: 32, inline: 20 });

    await page.setViewportSize({ width: 800, height: 740 });
    await expect.poll(read).toEqual({ vw: 64, mq: 48, inline: 20 });

    // The page's own inline size was kept, not lost, when the engine let go of it.
    await setFactor(page, 1);
    expect(await read()).toEqual({ vw: 32, mq: 24, inline: 10 });
  });
});

/**
 * Content that arrives while the text is scaled has to be read at its unscaled size, or it is
 * scaled twice. Two things used to get in the way of that read: a shadow host carrying its own
 * copy of the factor, and a page's own transition on font-size.
 */
test.describe('content added while scaled', () => {
  const fontSize = (page: Page, id: string) =>
    page.evaluate((i) => Math.round(parseFloat(getComputedStyle(document.getElementById(i)!).fontSize) * 10) / 10, id);
  const settle = (page: Page) => page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 400)));

  test("an element added to a shadow host's own children is scaled once", async ({ page }) => {
    await page.addInitScript({ path: CORE_BUNDLE });
    await page.goto('/plain-px/');
    await page.evaluate(() => {
      document.body.insertAdjacentHTML('beforeend', '<div id="host" style="font-size: 16px"><span id="first">first</span></div>');
      document.getElementById('host')!.attachShadow({ mode: 'open' }).innerHTML = '<slot></slot><b>shadow</b>';
    });
    await attachEngine(page);
    await setFactor(page, 1.5);
    await page.evaluate(() => document.getElementById('host')!.insertAdjacentHTML('beforeend', '<span id="late">late</span>'));
    await expect.poll(() => fontSize(page, 'late')).toBe(24);
    expect(await fontSize(page, 'first')).toBe(24);
    const shadowSize = () =>
      page.evaluate(() => getComputedStyle(document.getElementById('host')!.shadowRoot!.querySelector('b')!).fontSize);
    expect(await shadowSize()).toBe('24px');

    await setFactor(page, 1);
    expect(await fontSize(page, 'late')).toBe(16);
    expect(await shadowSize()).toBe('16px');
  });

  test('an element added inside one with a font-size transition is scaled once', async ({ page }) => {
    await page.addInitScript({ path: CORE_BUNDLE });
    await page.goto('/plain-px/');
    await page.evaluate(() => {
      document.body.insertAdjacentHTML(
        'beforeend',
        '<a id="link" href="#" style="font-size: 16px; transition: all 0.2s">link</a>',
      );
    });
    await attachEngine(page);
    await setFactor(page, 1.5);
    await settle(page);
    await page.evaluate(() => {
      const late = document.createElement('span');
      late.id = 'late';
      late.textContent = 'late';
      late.style.transition = 'all 0.2s';
      document.getElementById('link')!.append(late);
      // A page that measures what it has just added: the element has a style, at the scaled
      // size, before the engine gets to see it.
      void late.offsetHeight;
    });
    await settle(page);
    expect(await fontSize(page, 'late')).toBe(24);
    expect(await fontSize(page, 'link')).toBe(24);
    // The page's own inline transition is back as it was.
    expect(await page.evaluate(() => document.getElementById('link')!.style.transitionProperty)).toBe('all');

    await setFactor(page, 1);
    await settle(page);
    expect(await fontSize(page, 'late')).toBe(16);
  });

  test('a resize while scaled keeps the size of text that has a font-size transition', async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 600 });
    await page.addInitScript({ path: CORE_BUNDLE });
    await page.goto('/plain-px/');
    await page.evaluate(() => {
      document.head.insertAdjacentHTML('beforeend', '<style>#link { font-size: 16px; transition: all 0.2s }</style>');
      document.body.insertAdjacentHTML('beforeend', '<a id="link" href="#">link</a>');
    });
    await attachEngine(page);
    for (const factor of [1.5, 0.7]) {
      await setFactor(page, factor);
      await settle(page);
      const scaled = await fontSize(page, 'link');
      const width = page.viewportSize()!.width === 800 ? 500 : 800;
      await page.setViewportSize({ width, height: 600 });
      // Longer than the engine's wait for the width to stay put, plus the transition.
      await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 700)));
      expect(await fontSize(page, 'link')).toBe(scaled);
      await setFactor(page, 1);
      await settle(page);
      expect(await fontSize(page, 'link')).toBe(16);
    }
  });
});

/** FR2.6: at factor 1 the page is as its author wrote it, before any change and after a reset. */
test.describe('the page at normal size', () => {
  const marks = (page: Page) =>
    page.evaluate(() => ({
      marked: document.querySelectorAll('[data-tsa-scaled]').length,
      factor: document.documentElement.style.getPropertyValue('--tsa-k'),
      inline: document.getElementById('inline')!.getAttribute('style'),
      plain: document.getElementById('plain')!.getAttribute('style'),
      shadow: document.getElementById('host')!.shadowRoot!.querySelector('b')!.getAttribute('style'),
    }));
  const untouched = { marked: 0, factor: '', inline: 'font-size: 10px !important;', plain: null, shadow: null };

  test('is not modified until the size changes, and is let go of again on reset', async ({ page }) => {
    await page.addInitScript({ path: CORE_BUNDLE });
    await page.goto('/plain-px/');
    await page.evaluate(() => {
      document.body.insertAdjacentHTML(
        'beforeend',
        '<p id="inline" style="font-size: 10px !important;">inline</p><p id="plain">plain</p><div id="host"></div>',
      );
      document.getElementById('host')!.attachShadow({ mode: 'open' }).innerHTML = '<b>shadow</b>';
    });
    await attachEngine(page);
    expect(await marks(page)).toEqual(untouched);

    await setFactor(page, 1.5);
    expect((await marks(page)).marked).toBeGreaterThan(3);

    await setFactor(page, 1);
    expect(await marks(page)).toEqual(untouched);
    expect(await page.evaluate(() => document.documentElement.hasAttribute('style'))).toBe(false);

    // Content added now is left alone too.
    await page.evaluate(() => document.body.insertAdjacentHTML('beforeend', '<p id="late">late</p>'));
    await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 50)));
    expect((await marks(page)).marked).toBe(0);
  });

  test("a size the page changed while scaled is the page's again after a reset", async ({ page }) => {
    await page.addInitScript({ path: CORE_BUNDLE });
    await page.goto('/plain-px/');
    await page.evaluate(() => {
      document.head.insertAdjacentHTML('beforeend', '<style>#mode { font-size: 16px } .big #mode { font-size: 24px }</style>');
      document.body.insertAdjacentHTML('beforeend', '<p id="mode">mode</p>');
    });
    await attachEngine(page);
    const size = () => page.evaluate(() => getComputedStyle(document.getElementById('mode')!).fontSize);
    await setFactor(page, 2);
    await page.evaluate(() => document.body.classList.add('big'));
    // FR6.5: not followed while scaled.
    expect(await size()).toBe('32px');
    await setFactor(page, 1);
    expect(await size()).toBe('24px');
    await setFactor(page, 2);
    expect(await size()).toBe('48px');
  });
});

/**
 * FR2.7: where the browser enlarges text by itself (Firefox for Android, on a page laid out wider
 * than the screen), the engine takes that over. No desktop browser enlarges text, so these stand
 * in for it: the line heights the engine measures are made 1.5 times as tall for `#main` while
 * the browser's enlarging is "on" (not switched off on the root element).
 */
test.describe("the browser's own enlarging of text", () => {
  const ADJUST = ['-moz-text-size-adjust', '-webkit-text-size-adjust', 'text-size-adjust'];
  const page980 =
    '<div id="main"><p id="text" style="font-size: 16px; line-height: 20px">Main text</p></div>' +
    '<p id="plain" style="font-size: 16px">Not enlarged</p>' +
    '<pre id="code" style="font-size: 12px">a line of code</pre>' +
    '<pre id="own" style="font-size: 12px; overflow-x: hidden">with an overflow of its own</pre>';

  async function open(page: Page, mode: 'take-over' | 'auto'): Promise<void> {
    await page.addInitScript({ path: CORE_BUNDLE });
    await page.goto('/plain-px/');
    await page.evaluate(
      ({ html, props, browserEnlarging }) => {
        document.body.insertAdjacentHTML('beforeend', html);
        const root = document.documentElement;
        const off = () => props.some((prop) => root.style.getPropertyValue(prop) === 'none');
        const real = Range.prototype.getClientRects;
        Range.prototype.getClientRects = function (this: Range) {
          const rects = real.call(this);
          const enlarged = !off() && this.startContainer.parentElement?.closest('#main');
          if (!enlarged || rects.length === 0) return rects;
          return [{ ...rects[0]!.toJSON(), height: rects[0]!.height * 1.5 }] as unknown as DOMRectList;
        };
        const w = window as unknown as { TSA_CORE: { createEngine: (o: object) => MinimalEngine }; __tsa: MinimalEngine };
        w.__tsa = w.TSA_CORE.createEngine({ browserEnlarging });
        w.__tsa.attach();
      },
      { html: page980, props: ADJUST, browserEnlarging: mode },
    );
  }
  const read = (page: Page) =>
    page.evaluate((props) => {
      const style = (id: string) => getComputedStyle(document.getElementById(id)!);
      return {
        text: style('text').fontSize,
        lineHeight: style('text').lineHeight,
        plain: style('plain').fontSize,
        code: style('code').fontSize,
        codeScroll: document.getElementById('code')!.style.getPropertyValue('overflow-x'),
        ownScroll: document.getElementById('own')!.style.getPropertyValue('overflow-x'),
        off: props.some((prop) => document.documentElement.style.getPropertyValue(prop) === 'none'),
      };
    }, ADJUST);
  const untouched = {
    text: '16px', lineHeight: '20px', plain: '16px', code: '12px', codeScroll: '', ownScroll: 'hidden', off: false,
  };

  test('taken over: text starts from the size the browser gave it, and the page is given back at 100%', async ({
    page,
  }) => {
    await open(page, 'take-over');
    expect(await read(page)).toEqual(untouched);

    await setFactor(page, 2);
    expect(await read(page)).toEqual({
      text: '48px', // 16px, enlarged 1.5 times by the browser, times 2
      lineHeight: '60px',
      plain: '32px',
      code: '24px',
      codeScroll: 'auto', // a line of code may not make the page wider
      ownScroll: 'hidden',
      off: true,
    });

    await setFactor(page, 1);
    expect(await read(page)).toEqual(untouched);
    expect(await page.evaluate(() => document.documentElement.hasAttribute('style'))).toBe(false);
  });

  test('content added while scaled is measured the same way', async ({ page }) => {
    await open(page, 'take-over');
    await setFactor(page, 2);
    await page.evaluate(() =>
      document.getElementById('main')!.insertAdjacentHTML('beforeend', '<p id="late" style="font-size: 10px">late</p>'),
    );
    await expect
      .poll(() => page.evaluate(() => getComputedStyle(document.getElementById('late')!).fontSize))
      .toBe('30px');
    expect((await read(page)).off).toBe(true);
  });

  test('left alone where the page is no wider than the screen (every desktop browser)', async ({ page }) => {
    await open(page, 'auto');
    await setFactor(page, 2);
    expect(await read(page)).toMatchObject({ text: '32px', code: '24px', codeScroll: '', off: false });
  });
});

/** Findings of the independent review of 2026-10-08. */
test.describe('edge cases of capture and release', () => {
  const start = async (page: Page, options: object = {}) => {
    await page.addInitScript({ path: CORE_BUNDLE });
    await page.goto('/plain-px/');
    await page.evaluate((o) => {
      const w = window as unknown as { TSA_CORE: { createEngine: (o: object) => MinimalEngine }; __tsa: MinimalEngine };
      w.__tsa = w.TSA_CORE.createEngine(o);
      w.__tsa.attach();
    }, options);
  };
  const tick = (page: Page) => page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 50)));

  test('a parent and its child added in one go are each captured once, and let go of at 100%', async ({ page }) => {
    await start(page);
    await setFactor(page, 2);
    await page.evaluate(() => {
      const parent = document.createElement('div');
      document.body.appendChild(parent);
      const child = document.createElement('span');
      child.id = 'child';
      child.textContent = 'child';
      parent.appendChild(child);
    });
    await tick(page);
    expect(await page.evaluate(() => document.getElementById('child')!.getAttribute('data-tsa-scaled'))).toBe('');
    await setFactor(page, 1);
    expect(await page.evaluate(() => document.getElementById('child')!.hasAttribute('style'))).toBe(false);
  });

  test("a marker attribute of the page's own doesn't stop a reset", async ({ page }) => {
    await start(page);
    await page.evaluate(() => {
      document.body.insertAdjacentHTML('afterbegin', '<p data-tsa-scaled="null">odd</p><p data-tsa-scaled="[1">odder</p>');
    });
    await setFactor(page, 2);
    await setFactor(page, 1);
    expect(
      await page.evaluate(() => ({
        factor: document.documentElement.style.getPropertyValue('--tsa-k'),
        scaled: document.querySelectorAll('[style*="--tsa-k"]').length,
      })),
    ).toEqual({ factor: '', scaled: 0 });
  });

  test('an element added and taken out again at once is captured when it comes back', async ({ page }) => {
    await start(page);
    await setFactor(page, 2);
    await page.evaluate(() => {
      const probe = document.createElement('span');
      probe.id = 'probe';
      probe.style.fontSize = '10px';
      probe.textContent = 'probe';
      document.body.appendChild(probe);
      probe.remove();
      (window as unknown as { probe: HTMLElement }).probe = probe;
    });
    await tick(page);
    await page.evaluate(() => document.body.appendChild((window as unknown as { probe: HTMLElement }).probe));
    await expect
      .poll(() => page.evaluate(() => getComputedStyle(document.getElementById('probe')!).fontSize))
      .toBe('20px');
  });

  test('a reset at 100% leaves the page untouched', async ({ page }) => {
    await start(page);
    await setFactor(page, 1);
    expect(await page.evaluate(() => document.documentElement.hasAttribute('style'))).toBe(false);
  });

  test('a shadow host taken out of the page is let go of, and found again when put back', async ({ page }) => {
    await start(page);
    await page.evaluate(() => {
      document.body.insertAdjacentHTML('beforeend', '<div id="host"></div>');
      document.getElementById('host')!.attachShadow({ mode: 'open' }).innerHTML = '<b>shadow</b>';
    });
    await setFactor(page, 2);
    const addInside = (id: string) =>
      page.evaluate((i) => {
        const host = (window as unknown as { host: HTMLElement }).host;
        host.shadowRoot!.appendChild(Object.assign(document.createElement('i'), { id: i, textContent: i }));
      }, id);
    const marked = (id: string) =>
      page.evaluate(
        (i) => (window as unknown as { host: HTMLElement }).host.shadowRoot!.getElementById(i)!.hasAttribute('data-tsa-scaled'),
        id,
      );
    await page.evaluate(() => {
      const host = document.getElementById('host')!;
      (window as unknown as { host: HTMLElement }).host = host;
      host.remove();
    });
    await tick(page);
    await addInside('while-out');
    await tick(page);
    expect(await marked('while-out')).toBe(false);

    await page.evaluate(() => document.body.appendChild((window as unknown as { host: HTMLElement }).host));
    await tick(page);
    await addInside('back-in');
    await expect.poll(() => marked('back-in')).toBe(true);
    expect(await marked('while-out')).toBe(true);
  });

  test("taking over the browser's enlarging doesn't make a large page's first change slow", async ({ page }) => {
    await page.addInitScript({ path: CORE_BUNDLE });
    await page.goto('/large-dom-performance/');
    const ms = await page.evaluate(() => {
      const w = window as unknown as { TSA_CORE: { createEngine: (o: object) => MinimalEngine } };
      const engine = w.TSA_CORE.createEngine({ browserEnlarging: 'take-over' });
      engine.attach();
      const t0 = performance.now();
      engine.setFactor(1.5);
      return performance.now() - t0;
    });
    // Measured after the fix: about 100 ms in Firefox, where it was 885 ms with a Range per element.
    expect(ms).toBeLessThan(500);
  });
});

test.describe('spa-mutation', () => {
  test('content injected after load is captured automatically, without a manual rescan', async ({
    page,
  }) => {
    await gotoAndAttach(page, '/spa-mutation/');
    // New content is only watched for while the text is scaled.
    await setFactor(page, 2);
    await page.click('#load-more');
    await page.waitForFunction(() => {
      const el = document.querySelector('[data-tsa-ref="large"]');
      return el !== null && el.hasAttribute('data-tsa-scaled');
    });

    const after = await readRefSizes(page);
    await setFactor(page, 1);
    const before = await readRefSizes(page);

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
  test('the first change, which captures, completes promptly; a later one is much faster (FR7)', async ({
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
      engine.setFactor(1.6);
      const t3 = performance.now();
      return { attachMs: t1 - t0, initialCaptureMs: t2 - t1, factorChangeMs: t3 - t2 };
    });

    // Attaching does no work on the page: sizes are captured at the first change (FR2.6).
    expect(timings.attachMs).toBeLessThan(5);

    // Generous absolute ceiling (CI machines vary) — this is "no noticeable freeze", not a tight budget.
    expect(timings.initialCaptureMs).toBeLessThan(3000);
    // The whole point of the CSS-variable design (FR7.2): a later change only touches one
    // property, no DOM walk, so it should be dramatically cheaper than the initial capture.
    // TR2: at least an order of magnitude (measured: over 100×); the 5 ms floor absorbs timer
    // resolution on a fast machine, where the capture itself takes only a few milliseconds.
    expect(timings.factorChangeMs).toBeLessThan(Math.max(5, timings.initialCaptureMs / 10));
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
