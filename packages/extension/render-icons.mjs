import path from 'node:path';
import { chromium } from 'playwright';
import { EXTENSION_DIR } from '../../tools/paths.mjs';
import { imageDataUri, screenshotHtml } from '../../tools/render-image.mjs';

// Rasterizes icons/icon.svg (the source of truth) into the PNG sizes the manifests reference.
// Chrome doesn't accept SVG extension icons, so both manifests use these PNGs. Re-run after
// editing the SVG: `npm run icons -w packages/extension`.

const ICONS = path.join(EXTENSION_DIR, 'icons');
const SIZES = [16, 32, 48, 96, 128];

const src = imageDataUri(path.join(ICONS, 'icon.svg'));

const browser = await chromium.launch();
try {
  for (const size of SIZES) {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    await screenshotHtml(
      page,
      `<body style="margin:0;background:transparent"><img src="${src}" width="${size}" height="${size}" style="display:block"></body>`,
      path.join(ICONS, `icon-${size}.png`),
    );
    await page.close();
  }
} finally {
  await browser.close();
}
console.log(`Rendered ${SIZES.map((s) => `icon-${s}.png`).join(', ')}`);
