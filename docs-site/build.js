import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import MarkdownIt from 'markdown-it';
import { chromium } from 'playwright';
import { readProduct } from '../tools/product.js';
import {
  REPO_ROOT,
  EXTENSION_DIR,
  EXTENSION_DIST,
  FIXTURES_DIR,
  THEME_CSS,
  UNSIGNED_XPI_FILENAME,
  USERSCRIPT_BUNDLE,
  USERSCRIPT_FILENAME,
  fixtureScreenshot,
  readFixtures,
  readSites,
  realWorldScreenshot,
  realWorldSnapshot,
} from '../tools/paths.js';
import { imageDataUri, screenshotHtml } from '../tools/render-image.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, 'src');
const DIST = path.join(__dirname, 'dist');

// Name and descriptive text: product.json is the single source (also used by the manifests,
// the userscript header and the store listing).
const product = readProduct();

const md = new MarkdownIt({ html: false, linkify: true });

// --- TR1 fixtures (fixtures/fixtures.json): `standard` ones are in the gallery, `demo` ones get a
// live demo page. ---
const fixtures = readFixtures();

/** Real-world sites (fixtures/real-world/sites.json); none if the file is unreadable. */
function readSitesSafe() {
  try {
    return readSites();
  } catch {
    return [];
  }
}

function rimrafSync(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readTemplate(name) {
  return fs.readFileSync(path.join(SRC, 'templates', name), 'utf8');
}

function renderPage({ title, bodyHtml, assetRoot, isDev = false }) {
  const template = readTemplate('page.html');
  const devBanner = isDev
    ? '<div class="dev-banner">You are in the contributor/developer section. Looking to install or use the tool? Go to <a href="' +
      assetRoot +
      'index.html">Home</a> instead.</div>'
    : '';
  const fullTitle = title === product.name ? title : `${title} — ${product.name}`;
  return template
    .replaceAll('{{TITLE}}', fullTitle)
    .replaceAll('{{NAME}}', product.name)
    .replaceAll('{{LICENSE}}', product.license)
    .replaceAll('{{ASSET_ROOT}}', assetRoot)
    .replaceAll('{{DEV_BANNER}}', devBanner)
    .replace('{{BODY}}', bodyHtml);
}

function writePage(outPath, opts) {
  ensureDir(path.dirname(outPath));
  fs.writeFileSync(outPath, renderPage(opts), 'utf8');
}

function slugTitle(filename) {
  return filename
    .replace(/\.md$/, '')
    .split('-')
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}

// --- 1. Clean + shared assets ---
rimrafSync(DIST);
ensureDir(DIST);
fs.copyFileSync(THEME_CSS, path.join(DIST, 'theme.css'));
fs.copyFileSync(path.join(SRC, 'style.css'), path.join(DIST, 'style.css'));
fs.copyFileSync(path.join(EXTENSION_DIR, 'icons', 'icon.svg'), path.join(DIST, 'icon.svg'));

// --- 2. End-user guides (TR5.2/5.2a/5.2b) ---
const guidesDir = path.join(SRC, 'guides');
const guideFiles = fs.readdirSync(guidesDir).filter((f) => f.endsWith('.md'));
const guideLinks = [];
for (const file of guideFiles) {
  // Guides may use {{name}}, {{homepage}} and {{signedXpi}} (the latest signed release's .xpi).
  const raw = fs
    .readFileSync(path.join(guidesDir, file), 'utf8')
    .replaceAll('{{name}}', product.name)
    .replaceAll('{{homepage}}', product.homepage)
    .replaceAll('{{signedXpi}}', product.signedXpiUrl);
  const slug = file.replace(/\.md$/, '');
  const titleMatch = raw.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1] : slugTitle(file);
  writePage(path.join(DIST, 'guides', `${slug}.html`), {
    title,
    bodyHtml: md.render(raw),
    assetRoot: '../',
  });
  guideLinks.push({ slug, title });
}

// --- 3. Developer/contributor section (TR6, TR7.2) — separate, clearly labeled, never the
// default landing experience (TR5.0). ---
const DEV_DOCS = [
  { file: 'functional-requirements.md', title: 'Functional Requirements' },
  { file: 'test-and-documentation-requirements.md', title: 'Test & Documentation Requirements' },
  { file: 'implementation-plan.md', title: 'Implementation Plan' },
  { file: 'developer-guide.md', title: 'Developer Guide' },
  { file: 'android-manual-qa-checklist.md', title: 'Android Manual QA Checklist' },
];
for (const { file, title } of DEV_DOCS) {
  const raw = fs.readFileSync(path.join(REPO_ROOT, 'docs', file), 'utf8');
  const slug = file.replace(/\.md$/, '');
  writePage(path.join(DIST, 'dev', `${slug}.html`), {
    title,
    bodyHtml: md.render(raw),
    assetRoot: '../',
    isDev: true,
  });
}
writePage(path.join(DIST, 'dev', 'store-listing.html'), {
  title: 'Store listing text',
  assetRoot: '../',
  isDev: true,
  bodyHtml:
    `<h1>Store listing text</h1><p>From <code>product.json</code> (name, summary) and ` +
    `<code>product-description.txt</code> (description), as used for the add-on store.</p>` +
    `<h2>Name</h2><p>${product.name}</p><h2>Summary</h2><p>${product.summary}</p>` +
    `<h2>Description</h2>` +
    product.description.split(/\n\s*\n/).map((para) => `<p>${para.replace(/\n/g, '<br>')}</p>`).join(''),
});
writePage(path.join(DIST, 'dev', 'index.html'), {
  title: 'For contributors',
  assetRoot: '../',
  isDev: true,
  bodyHtml:
    '<h1>For contributors</h1><p>Build/test instructions, architecture, and the project\'s requirements docs.</p><ul>' +
    DEV_DOCS.map((d) => `<li><a href="${d.file.replace(/\.md$/, '.html')}">${d.title}</a></li>`).join('') +
    '<li><a href="store-listing.html">Store listing text</a></li></ul>',
});

// --- 4. Gallery (TR5.3/TR5.4) + live demos (TR5.5), via a headless browser for compositing ---
const browser = await chromium.launch();
const page = await browser.newPage();

/** Puts a phone screenshot into the frame-mobile.html device frame, with `urlText` in its address bar. */
async function frameScreenshot(imagePath, urlText, outPath) {
  const html = readTemplate('frame-mobile.html')
    .replace('{{IMAGE_SRC}}', imageDataUri(imagePath))
    .replace('{{URL_TEXT}}', urlText);
  // Transparent outside the frame's rounded corners, so it sits cleanly on light and dark pages.
  await screenshotHtml(page, html, outPath, { selector: '.frame' });
}

const galleryEntries = [];

for (const fixture of fixtures.filter((f) => f.standard)) {
  // Phone-viewport shots (see the 'phone gallery screenshots' block in e2e/engine.spec.ts).
  const beforePng = fixtureScreenshot(fixture.id, 1);
  const afterPng = fixtureScreenshot(fixture.id, 2);
  if (!fs.existsSync(beforePng) || !fs.existsSync(afterPng)) {
    console.warn(`[gallery] skipping ${fixture.id}: screenshots not found (run the Layer 1 suite first)`);
    continue;
  }
  const outDir = path.join(DIST, 'gallery', fixture.id);
  ensureDir(outDir);
  const urlText = `https://example.com/${fixture.id}/`;
  await frameScreenshot(beforePng, urlText, path.join(outDir, 'before.png'));
  await frameScreenshot(afterPng, urlText, path.join(outDir, 'after.png'));
  galleryEntries.push({ id: fixture.id, label: fixture.label, hasDemo: fixture.demo });
}

for (const site of readSitesSafe()) {
  const beforePng = realWorldScreenshot(site.id, 1);
  const afterPng = realWorldScreenshot(site.id, 2);
  if (!fs.existsSync(beforePng) || !fs.existsSync(afterPng)) {
    console.warn(`[gallery] skipping real-world/${site.id}: screenshots not found (run "npm run test:real-world" first)`);
    continue;
  }
  const outDir = path.join(DIST, 'gallery', site.id);
  ensureDir(outDir);
  // Real sites are captured on a phone viewport (see fixtures/real-world/download.js).
  await frameScreenshot(beforePng, site.url, path.join(outDir, 'before.png'));
  await frameScreenshot(afterPng, site.url, path.join(outDir, 'after.png'));
  galleryEntries.push({
    id: site.id,
    label: site.name,
    subtitle: site.description,
    hasDemo: fs.existsSync(realWorldSnapshot(site.id)),
    isRealWorld: true,
  });
}

// Gallery: one page with every before/after pair inline, in two sections — real sites first,
// then function demos (synthetic pages, one technique each) — each linking to its live demo.
function galleryEntryHtml(entry) {
  const demo = entry.hasDemo
    ? `<a class="button" href="../demos/${entry.id}/index.html">Try it live<span class="visually-hidden"> — ${entry.label}</span></a>`
    : '';
  const subtitle = entry.subtitle ? `<p class="gallery-subtitle">${entry.subtitle}</p>` : '';
  return `
    <section class="gallery-entry panel" aria-labelledby="g-${entry.id}">
      <h3 id="g-${entry.id}">${entry.label}</h3>
      ${subtitle}
      <div class="shot-pair">
        <figure><img src="${entry.id}/before.png" alt="${entry.label}: page at normal text size" loading="lazy"><figcaption>Before</figcaption></figure>
        <figure><img src="${entry.id}/after.png" alt="${entry.label}: the same page with text at 200%" loading="lazy"><figcaption>After (2×)</figcaption></figure>
      </div>
      ${demo}
    </section>`;
}
const galleryHtml =
  '<h2>Real sites</h2><p>Saved copies of real websites, shown on a phone.</p>' +
  galleryEntries.filter((e) => e.isRealWorld).map(galleryEntryHtml).join('') +
  '<h2>Function demos</h2><p>Small pages that each use one technique websites rely on to size ' +
  'their text. They double as the test fixtures: the automated test suite checks every one of them ' +
  'in Firefox and Chromium.</p>' +
  galleryEntries.filter((e) => !e.isRealWorld).map(galleryEntryHtml).join('');
writePage(path.join(DIST, 'gallery', 'index.html'), {
  title: 'Screenshot gallery',
  assetRoot: '../',
  bodyHtml:
    '<h1>Screenshot gallery</h1><p class="lead">Each pair shows a page at normal size and with the text doubled. ' +
    'Headings stay bigger than body text, pictures keep their size, and nothing needs sideways scrolling.</p>' +
    galleryHtml,
});

// --- Live demos (TR5.5) ---
const userscriptBundle = fs.existsSync(USERSCRIPT_BUNDLE) ? fs.readFileSync(USERSCRIPT_BUNDLE, 'utf8') : null;

function injectDemoScript(html) {
  // Inlined (not an external <script src>) so it keeps working even when a real-world snapshot's
  // injected <base href> would otherwise resolve a relative src against the live site instead of
  // our own docs site.
  return html.replace('</body>', `<script>${userscriptBundle}</script></body>`);
}

if (!userscriptBundle) {
  console.warn('[demos] userscript bundle not found — skipping live demos entirely. Run "npm run build -w packages/userscript" first.');
} else {
  for (const fixture of fixtures.filter((f) => f.demo)) {
    const entryPath = path.join(FIXTURES_DIR, fixture.id, fixture.entry);
    if (!fs.existsSync(entryPath)) continue;
    const outDir = path.join(DIST, 'demos', fixture.id);
    ensureDir(outDir);
    const html = fs.readFileSync(entryPath, 'utf8');
    fs.writeFileSync(path.join(outDir, 'index.html'), injectDemoScript(html), 'utf8');
    for (const extra of fixture.extraFiles ?? []) {
      fs.copyFileSync(path.join(FIXTURES_DIR, fixture.id, extra), path.join(outDir, extra));
    }
  }

  // Fixture pages reference shared files (e.g. the sample image) as ../assets/…
  fs.cpSync(path.join(FIXTURES_DIR, 'assets'), path.join(DIST, 'demos', 'assets'), { recursive: true });

  for (const site of readSitesSafe()) {
    const snapshotPath = realWorldSnapshot(site.id);
    if (!fs.existsSync(snapshotPath)) continue;
    const outDir = path.join(DIST, 'demos', site.id);
    ensureDir(outDir);
    const html = fs.readFileSync(snapshotPath, 'utf8');
    fs.writeFileSync(path.join(outDir, 'index.html'), injectDemoScript(html), 'utf8');
  }
}
// Fixtures without `demo` (e.g. iframe-cross-origin, which needs the local two-port test server)
// have no live demo on purpose (TR5.5): they wouldn't work once this site is deployed elsewhere.

// --- Downloads: the built userscript and an *unsigned* extension package, so the advanced
// install guides can link to real files. Release Firefox (desktop permanent installs, and
// Android) only accepts Mozilla-signed packages — signing needs the maintainer's AMO API
// credentials, so a signed .xpi isn't produced here. ---
ensureDir(path.join(DIST, 'downloads'));
if (userscriptBundle) {
  fs.writeFileSync(path.join(DIST, 'downloads', USERSCRIPT_FILENAME), userscriptBundle, 'utf8');
}
if (fs.existsSync(path.join(EXTENSION_DIST, 'manifest.json'))) {
  execFileSync(
    'npx',
    [
      'web-ext', 'build',
      '--source-dir', EXTENSION_DIST,
      '--artifacts-dir', path.join(DIST, 'downloads'),
      '--filename', UNSIGNED_XPI_FILENAME,
      '--overwrite-dest',
    ],
    { cwd: EXTENSION_DIR, stdio: 'ignore' },
  );
} else {
  console.warn('[downloads] extension not built — skipping the .xpi. Run "npm run build -w packages/extension" first.');
}
// The Mozilla-signed build isn't copied here: it's attached to each GitHub release, and the guides
// link there ({{signedXpi}}).

// --- Website embed (FR3.4/TR5.6): the same self-starting bundle, published as a plain script a
// site owner can include with one <script src> tag, plus a demo that loads it exactly that way. ---
if (userscriptBundle) {
  const embedScript = userscriptBundle.replace(/^\/\/ ==UserScript==[\s\S]*?\/\/ ==\/UserScript==\s*/, '');
  ensureDir(path.join(DIST, 'embed'));
  fs.writeFileSync(path.join(DIST, 'embed', 'text-size-adjuster.js'), embedScript, 'utf8');

  ensureDir(path.join(DIST, 'demos', 'script-tag'));
  fs.copyFileSync(path.join(SRC, 'demos', 'script-tag.html'), path.join(DIST, 'demos', 'script-tag', 'index.html'));
}

await browser.close();

// --- 5. Landing page (TR5.0/TR5.2) — the install section is for end users; the userscript and
// manual extension installs are for technical users and live under their own heading.
writePage(path.join(DIST, 'index.html'), {
  title: product.name,
  assetRoot: '',
  bodyHtml: `
    <section class="hero" aria-labelledby="hero-title">
      <img src="icon.svg" alt="" width="96" height="96" />
      <div>
        <h1 id="hero-title">${product.name}</h1>
        <p class="lead">${product.summary}</p>
        <div class="actions">
          <a class="button button-primary" href="guides/install.html">Install</a>
          <a class="button" href="gallery/index.html">See it in action</a>
        </div>
      </div>
    </section>

    <h2>Learn more</h2>
    <ul>
      <li><a href="guides/how-it-differs.html">How this differs from your browser's zoom/accessibility settings</a></li>
      <li><a href="guides/limitations.html">What this can't fix (and why)</a></li>
    </ul>

    <h2>Run a website?</h2>
    <p>Give every visitor the same +/− control with a single script tag —
    <a href="guides/add-to-your-website.html">see how</a>, or
    <a href="demos/script-tag/index.html">try the demo page</a> that does exactly that.</p>

    <h2 id="advanced">Advanced installation</h2>
    <p>For technical users who want to try it before it's on Firefox Add-ons, run their own build,
    or use it outside Firefox:</p>
    <ul>
      <li><a href="guides/install-userscript.html">As a userscript</a> (Tampermonkey/Violentmonkey; also works in Chrome) — no signing needed, but doesn't remember sizes per site</li>
      <li><a href="guides/install-extension-manually.html">The extension, installed manually</a> — for trying a build before it's on Firefox Add-ons</li>
      <li><a href="guides/install-extension-manually-android.html">The extension, installed manually on Android</a></li>
    </ul>
  `,
});

console.log(`Documentation site built at ${DIST}`);
