import { test, expect, type Page } from '@playwright/test';
import { USERSCRIPT_BUNDLE, requireBuilt } from '../tools/paths.mjs';

test.beforeAll(() => requireBuilt(USERSCRIPT_BUNDLE, 'packages/userscript'));

/**
 * FR10.3: a site owner embedding the built bundle with a real `<script src>` tag (served by the
 * fixture server's /__bundles/ route) can set the control's placement via a `data-position`
 * attribute or a `?position=` URL parameter, and visibility via `data-show`/`?show=`.
 */
async function panelState(page: Page) {
  const host = page.locator('[data-tsa-ignore]');
  await expect(host).toBeAttached();
  return host.locator('.tsa-widget').evaluate((panel) => {
    const rect = panel.getBoundingClientRect();
    return {
      position: (panel as HTMLElement).dataset.position,
      hidden: (panel as HTMLElement).hidden,
      nearLeft: rect.left < window.innerWidth / 2,
      nearTop: rect.top < window.innerHeight / 2,
    };
  });
}

const CASES: Array<[file: string, expected: string, top: boolean, left: boolean]> = [
  ['default.html', 'bottom-right', false, false],
  ['attribute.html', 'top-left', true, true],
  ['parameter.html', 'top-right', true, false],
  ['both.html', 'bottom-left', false, true], // attribute (bl) wins over parameter (tr)
];

for (const [file, expected, top, left] of CASES) {
  test(`placement from the script tag: ${file} → ${expected}`, async ({ page }) => {
    await page.goto(`/script-tag/${file}`);
    const state = await panelState(page);
    expect(state.position).toBe(expected);
    expect(state.nearTop).toBe(top);
    expect(state.nearLeft).toBe(left);
    expect(state.hidden).toBe(false); // default visibility for the embed is "always" (FR10.4)
  });
}

test('show=on-zoom keeps the control hidden until the page is pinch-zoomed', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'pinch-zoom is simulated via Chromium DevTools protocol');
  await page.goto('/script-tag/on-zoom.html');
  expect((await panelState(page)).hidden).toBe(true);

  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setPageScaleFactor', { pageScaleFactor: 2 });
  await expect.poll(async () => (await panelState(page)).hidden).toBe(false);

  // Still inside the visible (zoomed) area, at its normal size.
  const visible = await page.evaluate(() => {
    const panel = document.querySelector('[data-tsa-ignore]')!.shadowRoot!.querySelector('.tsa-widget')!;
    const rect = panel.getBoundingClientRect();
    const viewport = window.visualViewport!;
    return {
      inside:
        rect.left >= viewport.offsetLeft - 1 &&
        rect.top >= viewport.offsetTop - 1 &&
        rect.right <= viewport.offsetLeft + viewport.width + 1 &&
        rect.bottom <= viewport.offsetTop + viewport.height + 1,
    };
  });
  expect(visible.inside).toBe(true);
});
