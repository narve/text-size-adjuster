import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// TR1a: a script to snapshot a representative page from popular real-world sites, as an
// additional, non-gating fixture set alongside the synthetic TR1 fixtures. Snapshots are NOT
// committed to git (see .gitignore) — they go stale, and redistributing copies of third-party
// site markup in the repo is avoided; regenerate on demand with `npm run download -w fixtures`.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sites = JSON.parse(fs.readFileSync(path.join(__dirname, 'sites.json'), 'utf8'));
const OUT_DIR = path.join(__dirname, 'snapshots');

/**
 * Injects `<base href="...">` right after `<head>` so every relative URL already in the page
 * (href, src, srcset, CSS `url()` in linked/inline stylesheets, fetch() calls the page's own JS
 * makes, ...) resolves against the live site instead of this snapshot's own location. Keeps the
 * saved snapshot's real styling/images without mirroring every asset.
 */
function injectBaseHref(html, url) {
  return html.replace(/<head(\s[^>]*)?>/i, (match) => `${match}<base href="${url}">`);
}

async function downloadSite({ id, url }, browser) {
  const page = await browser.newPage();
  try {
    await page.goto(url, { waitUntil: 'load', timeout: 30_000 });
    // Best-effort extra settle time; some sites never go fully idle (analytics, polling), so a
    // timeout here is not a failure — we still have a loaded page either way.
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});

    const html = await page.content();
    const snapshot = injectBaseHref(html, url);

    const dir = path.join(OUT_DIR, id);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), snapshot, 'utf8');
    console.log(`[ok]   ${id} <- ${url}`);
    return true;
  } catch (err) {
    console.warn(`[skip] ${id} <- ${url}: ${err instanceof Error ? err.message : err}`);
    return false;
  } finally {
    await page.close();
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
