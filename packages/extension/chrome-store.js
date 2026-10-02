import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { readProduct, stripComments } from '../../tools/product.js';
import {
  EXTENSION_ARTIFACTS,
  EXTENSION_DIR,
  REPO_ROOT,
  THEME_CSS,
  chromeZipFilename,
  readJson,
  requireBuilt,
} from '../../tools/paths.js';
import { imageDataUri, screenshotHtml } from '../../tools/render-image.js';

// Everything for a Chrome Web Store (or Edge Add-ons) submission except the zip itself
// (build:chrome makes that), in web-ext-artifacts/chrome-store/:
// - listing.md: every text field to paste into the developer dashboard, from product.json,
//   product-description.txt (with the Chrome platforms line) and chrome-store.txt;
// - promo-440x280.png: the small promo tile; icon-128.png: the store icon;
// - the 1280×800 screenshots from amo-screenshots.js (run `npm run amo:screenshots` first).

const OUT = path.join(EXTENSION_ARTIFACTS, 'chrome-store');
const SCREENSHOTS = path.join(EXTENSION_ARTIFACTS, 'amo-screenshots');
const product = readProduct('chrome');
const { version } = readJson(path.join(EXTENSION_DIR, 'package.json'));
requireBuilt(path.join(SCREENSHOTS, 'captions.json'), 'packages/extension (npm run amo:screenshots)');
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

/** chrome-store.txt's "== field ==" sections. */
const sections = Object.fromEntries(
  stripComments(fs.readFileSync(path.join(EXTENSION_DIR, 'chrome-store.txt'), 'utf8'))
    .split(/^== (.+) ==$/m)
    .slice(1)
    .reduce((pairs, part, i, all) => (i % 2 === 0 ? [...pairs, [part, all[i + 1].trim()]] : pairs), []),
);

const screenshots = Object.keys(readJson(path.join(SCREENSHOTS, 'captions.json'))).sort();
for (const file of screenshots) fs.copyFileSync(path.join(SCREENSHOTS, file), path.join(OUT, file));
fs.copyFileSync(path.join(EXTENSION_DIR, 'icons', 'icon-128.png'), path.join(OUT, 'icon-128.png'));

const field = (label, value) => `## ${label}\n\n${value}\n`;
const listing = [
  `# ${product.name} ${version}: Chrome Web Store listing\n`,
  `Upload \`${chromeZipFilename(version)}\` (in web-ext-artifacts/), then copy each field below.\n`,
  '# Store listing tab\n',
  field('Description', product.description),
  field('Category', 'Accessibility'),
  field('Language', 'English'),
  field('Store icon', '`icon-128.png`'),
  field('Screenshots (1280×800)', screenshots.map((f) => `- \`${f}\``).join('\n')),
  field('Small promo tile (440×280)', '`promo-440x280.png`'),
  field('Official URL / Homepage URL', product.homepage),
  field('Support URL', `${product.repository}/issues`),
  '# Privacy practices tab\n',
  ...Object.entries(sections).map(([label, value]) => field(label, value)),
  field('Privacy policy URL', `${product.homepage}guides/privacy.html`),
  '# Distribution tab\n',
  field('Visibility and regions', 'Public, all regions. Free (no in-app purchases).'),
].join('\n');
fs.writeFileSync(path.join(OUT, 'listing.md'), listing);

// The promo tile: icon, name and a short line, on the theme's colours.
const theme = fs.readFileSync(THEME_CSS, 'utf8');
const tile = `<!doctype html><html><head><style>${theme}
  body { margin: 0; }
  .tile { width: 440px; height: 280px; display: flex; align-items: center; gap: 22px; padding: 0 34px;
    background: linear-gradient(160deg, var(--accent-soft), var(--bg)); }
  h1 { margin: 0 0 8px; font-size: 30px; line-height: 1.1; color: var(--fg); }
  p { margin: 0; font-size: 17px; line-height: 1.35; color: var(--fg-muted); }
</style></head><body><div class="tile">
  <img src="${imageDataUri(path.join(EXTENSION_DIR, 'icons', 'icon.svg'))}" width="110" height="110">
  <div><h1>${product.name}</h1><p>Bigger text, same layout. No sideways scrolling.</p></div>
</div></body></html>`;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 440, height: 280 } });
await screenshotHtml(page, tile, path.join(OUT, 'promo-440x280.png'));
await browser.close();

console.log(`Chrome Web Store material written to ${path.relative(REPO_ROOT, OUT)}/`);
