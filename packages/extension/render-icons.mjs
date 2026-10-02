import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

// Rasterizes icons/icon.svg (the source of truth) into the PNG sizes the manifests reference.
// Chrome doesn't accept SVG extension icons, so both manifests use these PNGs. Re-run after
// editing the SVG: `npm run icons -w packages/extension`.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ICONS = path.join(__dirname, 'icons');
const SIZES = [16, 32, 48, 96, 128];

const svg = fs.readFileSync(path.join(ICONS, 'icon.svg'), 'utf8');
const src = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;

const browser = await chromium.launch();
try {
  for (const size of SIZES) {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    await page.setContent(
      `<body style="margin:0;background:transparent"><img src="${src}" width="${size}" height="${size}" style="display:block"></body>`,
    );
    await page.waitForFunction(() => document.images[0].complete && document.images[0].naturalWidth > 0);
    await page.screenshot({ path: path.join(ICONS, `icon-${size}.png`), omitBackground: true });
    await page.close();
  }
} finally {
  await browser.close();
}
console.log(`Rendered ${SIZES.map((s) => `icon-${s}.png`).join(', ')}`);
