import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { readProduct } from '../../tools/product.js';
import { EXTENSION_ARTIFACTS, EXTENSION_DIST, REPO_ROOT, THEME_CSS, requireBuilt } from '../../tools/paths.js';
import { imageDataUri, screenshotHtml } from '../../tools/render-image.js';

// Screenshots for the addons.mozilla.org listing (1280×800, AMO's recommended size), written to
// web-ext-artifacts/amo-screenshots/ for uploading in the developer hub; web-ext can't upload them.
// Built from the docs site's gallery images (run `npm run docs:build` first) and the built
// options page (`npm run build -w packages/extension`).

const GALLERY = path.join(REPO_ROOT, 'docs-site', 'dist', 'gallery');
const OUT = path.join(EXTENSION_ARTIFACTS, 'amo-screenshots');

const PAIRS = [
  { id: 'norvig', caption: 'Pages made for computers are tiny on a phone. Make just the text bigger — no sideways scrolling.' },
  { id: 'ap-no', caption: 'Text grows, pictures and layout keep their size, and the page still fits the screen.' },
];

const theme = fs.readFileSync(THEME_CSS, 'utf8');

function slide(caption, body) {
  return `<!doctype html><html><head><style>${theme}
    body { margin: 0; }
    .slide { width: 1280px; height: 800px; display: flex; flex-direction: column; align-items: center;
      justify-content: center; gap: 28px; background: linear-gradient(160deg, var(--accent-soft), var(--bg)); }
    h1 { margin: 0; max-width: 1080px; text-align: center; font-size: 34px; line-height: 1.25; color: var(--fg); }
    .row { display: flex; gap: 56px; align-items: center; }
    figure { margin: 0; display: grid; gap: 10px; justify-items: center; }
    figcaption { font: 600 20px var(--font); color: var(--fg-muted); }
    img { display: block; }
  </style></head><body><div class="slide"><h1>${caption}</h1>${body}</div></body></html>`;
}

/** Stand-in for the WebExtension APIs, so the options page renders with example settings. */
function fakeBrowser(version) {
  const data = {
    'tsa:settings': { position: 'bottom-right', show: 'on-zoom', autoRemember: true },
    'https://www.aftenposten.no': 1.5,
    'https://en.wikipedia.org': 1.2,
    'https://news.ycombinator.com': 1.8,
    'https://norvig.com': 2,
  };
  window.chrome = { runtime: { id: 'screenshot' } };
  window.browser = {
    runtime: { id: 'screenshot', getManifest: () => ({ version, homepage_url: '#' }), openOptionsPage() {} },
    storage: {
      local: {
        get: async (keys) =>
          keys === null ? data : Object.fromEntries([].concat(keys).filter((k) => k in data).map((k) => [k, data[k]])),
        set: async () => {},
        remove: async () => {},
      },
      onChanged: { addListener() {} },
    },
  };
}

requireBuilt(path.join(EXTENSION_DIST, 'options.html'), 'packages/extension');
fs.mkdirSync(OUT, { recursive: true });
const product = readProduct();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

for (const [index, { id, caption }] of PAIRS.entries()) {
  const before = path.join(GALLERY, id, 'before.png');
  requireBuilt(before, 'docs-site');
  const figure = (file, label) =>
    `<figure><img src="${imageDataUri(path.join(GALLERY, id, file))}" height="600"><figcaption>${label}</figcaption></figure>`;
  const html = slide(caption, `<div class="row">${figure('before.png', 'Before')}${figure('after.png', 'With ' + product.name)}</div>`);
  await screenshotHtml(page, html, path.join(OUT, `${index + 1}-${id}.png`));
}

// The options page's two panels side by side, rendered at phone width.
const options = await browser.newPage({ viewport: { width: 420, height: 1000 }, deviceScaleFactor: 2 });
await options.addInitScript(fakeBrowser, product.version);
await options.goto(`file://${path.join(EXTENSION_DIST, 'options.html')}`);
await options.waitForSelector('#sites li');
const panels = [];
for (const [index, panel] of (await options.locator('section.panel').all()).entries()) {
  const file = path.join(OUT, `options-panel-${index}.tmp.png`);
  await panel.screenshot({ path: file });
  panels.push(file);
}
await screenshotHtml(
  page,
  slide(
    'Choose where the control sits and when it shows. Sizes are remembered per site.',
    `<div class="row" style="align-items: flex-start">${panels
      .map((file) => `<img src="${imageDataUri(file)}" style="max-height: 620px; max-width: 480px; border-radius: 14px; box-shadow: var(--shadow)">`)
      .join('')}</div>`,
  ),
  path.join(OUT, `${PAIRS.length + 1}-options.png`),
);
for (const file of panels) fs.rmSync(file);

await browser.close();
console.log(`Screenshots written to ${path.relative(REPO_ROOT, OUT)}/`);
