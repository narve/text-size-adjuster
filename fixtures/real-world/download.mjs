import { chromium, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { readSites, realWorldSnapshot } from '../../tools/paths.mjs';

// TR1a: snapshots a representative page from popular real-world sites, as an additional,
// non-gating fixture set alongside the synthetic TR1 fixtures. Snapshots are NOT committed to git
// (see .gitignore) — they go stale, and redistributing copies of third-party site markup in the
// repo is avoided; regenerate on demand with `npm run download -w fixtures`.
//
// Each snapshot is the page's *rendered* DOM, captured on an emulated phone (the tool's
// motivating use case, and what makes sites serve their mobile layout), then made static:
// - all <script> tags are removed. The DOM is already rendered; letting the site's scripts run a
//   second time on top of it duplicates script-inserted content, re-triggers consent/login
//   overlays, and throws errors once the scripts can't reach their own backends.
// - CSP <meta> tags are removed, so they can't block the tool's own script in the live demos.
// - common consent-overlay containers are removed, so they don't cover the page in screenshots.
// - CSS that the site inserted at runtime via the CSSOM is written into the snapshot (see
//   inlineRuntimeStyles), since it would otherwise be lost along with the scripts.
// - a <base href> keeps relative URLs (CSS, images, fonts) pointing at the live site, so the
//   snapshot keeps its real styling without mirroring every asset.

const sites = readSites();
// The full device (mobile user agent, touch), not just its size, so sites serve their mobile
// layout. Its width matches PHONE_VIEWPORT in tools/paths.mjs, which the screenshots use.
const DEVICE = devices['Pixel 7'];

const CONSENT_SELECTORS = [
  '[id^="sp_message_container"]',
  '#onetrust-consent-sdk',
  '#CybotCookiebotDialog',
  '.fc-consent-root',
  '#didomi-host',
  '#usercentrics-root',
  '.qc-cmp2-container',
  '#sp-cc',
  '#bbccookies',
];

/**
 * CSS-in-JS libraries (styled-components, emotion, ...) in production mode insert rules through
 * the CSSOM (`insertRule`), which leaves their <style> tags empty when the DOM is serialized. With
 * the site's scripts stripped, nothing would refill them and the snapshot would render unstyled —
 * so write each sheet's live rules back into its tag, and turn constructed (adopted) sheets into
 * real <style> tags, before capturing.
 */
function inlineRuntimeStyles() {
  for (const sheet of Array.from(document.styleSheets)) {
    const node = sheet.ownerNode;
    if (node?.nodeName !== 'STYLE' || node.textContent.trim() !== '') continue;
    try {
      node.textContent = Array.from(sheet.cssRules, (rule) => rule.cssText).join('\n');
    } catch {
      /* cross-origin sheet: not readable, and not a CSSOM-only sheet anyway */
    }
  }
  for (const sheet of document.adoptedStyleSheets ?? []) {
    const style = document.createElement('style');
    style.textContent = Array.from(sheet.cssRules, (rule) => rule.cssText).join('\n');
    document.head.append(style);
  }
}

function makeStatic(html, url) {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<meta[^>]+http-equiv=["']?content-security-policy["']?[^>]*>/gi, '')
    .replace(/<head(\s[^>]*)?>/i, (match) => `${match}<base href="${url}">`);
}

async function downloadSite({ id, url }, browser) {
  const context = await browser.newContext({ ...DEVICE });
  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: 'load', timeout: 30_000 });
    // Best-effort extra settle time; some sites never go fully idle (analytics, polling), so a
    // timeout here is not a failure — we still have a loaded page either way.
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    // Scroll down and back so lazy-loaded images near the top get their real src before capture.
    await page.evaluate(() => window.scrollTo(0, 3000));
    await page.waitForTimeout(1500);
    await page.evaluate(() => window.scrollTo(0, 0));

    await page.evaluate((selectors) => {
      for (const el of document.querySelectorAll(selectors.join(','))) el.remove();
    }, CONSENT_SELECTORS);
    await page.evaluate(inlineRuntimeStyles);

    const snapshot = makeStatic(await page.content(), url);

    const file = realWorldSnapshot(id);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, snapshot, 'utf8');
    console.log(`[ok]   ${id} <- ${url}`);
    return true;
  } catch (err) {
    console.warn(`[skip] ${id} <- ${url}: ${err instanceof Error ? err.message : err}`);
    return false;
  } finally {
    await context.close();
  }
}

async function main() {
  const browser = await chromium.launch();
  let ok = 0;
  try {
    for (const site of sites) {
      if (await downloadSite(site, browser)) ok += 1;
      // Polite delay between requests — one request per site, no crawling (TR1a).
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  } finally {
    await browser.close();
  }
  console.log(`Downloaded ${ok}/${sites.length} real-world snapshots.`);
}

main();
