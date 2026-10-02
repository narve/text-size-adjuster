import fs from 'node:fs';
import path from 'node:path';

const MIME = {
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};

/**
 * A local image as a data: URI. Pages loaded with setContent() have no origin that may load
 * file:// URLs, so an <img> pointed at a local file never fires `load`.
 */
export function imageDataUri(file) {
  const mime = MIME[path.extname(file).toLowerCase()];
  if (!mime) throw new Error(`No image type known for ${file}`);
  return `data:${mime};base64,${fs.readFileSync(file).toString('base64')}`;
}

/**
 * Loads `html` into a Playwright `page`, waits until every <img> has finished loading, and saves a
 * transparent-background PNG of the element matching `selector` (the whole viewport if omitted).
 */
export async function screenshotHtml(page, html, outPath, { selector } = {}) {
  await page.setContent(html);
  // setContent resolves once the DOM exists, not once images have decoded; without this wait an
  // image can still have zero size at capture time.
  await page.waitForFunction(() =>
    [...document.images].every((img) => img.complete && img.naturalWidth > 0),
  );
  const target = selector ? page.locator(selector) : page;
  await target.screenshot({ path: outPath, omitBackground: true });
}
