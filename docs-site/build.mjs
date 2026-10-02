import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import MarkdownIt from 'markdown-it';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const SRC = path.join(__dirname, 'src');
const DIST = path.join(__dirname, 'dist');
const SCREENSHOT_DIR = path.join(REPO_ROOT, 'e2e', 'screenshots');
const FIXTURES_DIR = path.join(REPO_ROOT, 'fixtures');
const SITES_FILE = path.join(FIXTURES_DIR, 'real-world', 'sites.json');
const USERSCRIPT_BUNDLE = path.join(
  REPO_ROOT,
  'packages',
  'userscript',
  'dist',
  'text-size-adjuster.user.js',
);

const md = new MarkdownIt({ html: false, linkify: true });

// --- TR1 fixtures shown in the gallery (TR5.3) --- the ids Layer 1 actually screenshots via the
// generic before/after loop (see e2e/fixtures.ts STANDARD_FIXTURES). Kept as a literal list here
// rather than importing that TS file, since this is a plain Node script.
const SYNTHETIC_GALLERY_FIXTURES = [
  { id: 'plain-px', label: 'Plain px sizing', sourceDir: 'plain-px', entry: 'index.html' },
  { id: 'rem-em', label: 'Root-relative sizing (rem/em)', sourceDir: 'rem-em', entry: 'index.html' },
  { id: 'nested-em', label: 'Deeply nested em inheritance', sourceDir: 'nested-em', entry: 'index.html' },
  { id: 'shadow-dom-open', label: 'Open shadow DOM content', sourceDir: 'shadow-dom-open', entry: 'index.html' },
  { id: 'overflow-clipping', label: 'Fixed-height container', sourceDir: 'overflow-clipping', entry: 'index.html' },
  {
    id: 'important-high-specificity',
    label: 'Stubborn !important styling',
    sourceDir: 'important-high-specificity',
    entry: 'index.html',
  },
  { id: 'line-height-mixed', label: 'Mixed line-height styles', sourceDir: 'line-height-mixed', entry: 'index.html' },
  {
    id: 'large-dom-performance',
    label: 'Large page (performance)',
    sourceDir: 'large-dom-performance',
    entry: 'index.html',
  },
];

// Also demo-able even though they're not in the generic before/after screenshot loop.
const EXTRA_DEMO_FIXTURES = [
  { id: 'iframe-same-origin', sourceDir: 'iframe-same-origin', entry: 'parent.html', extraFiles: ['child.html'] },
  { id: 'spa-mutation', sourceDir: 'spa-mutation', entry: 'index.html' },
];

const GALLERY_FACTOR = '2'; // the representative "after" factor shown per fixture (TR5.3)

function readSitesConfig() {
  if (!fs.existsSync(SITES_FILE)) return [];
  return JSON.parse(fs.readFileSync(SITES_FILE, 'utf8'));
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
  const fullTitle = title === 'Text Size Adjuster' ? title : `${title} — Text Size Adjuster`;
  return template
    .replaceAll('{{TITLE}}', fullTitle)
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
fs.copyFileSync(path.join(SRC, 'style.css'), path.join(DIST, 'style.css'));

// --- 2. End-user guides (TR5.2/5.2a/5.2b) ---
const guidesDir = path.join(SRC, 'guides');
const guideFiles = fs.readdirSync(guidesDir).filter((f) => f.endsWith('.md'));
const guideLinks = [];
for (const file of guideFiles) {
  const raw = fs.readFileSync(path.join(guidesDir, file), 'utf8');
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
writePage(path.join(DIST, 'dev', 'index.html'), {
  title: 'For contributors',
  assetRoot: '../',
  isDev: true,
  bodyHtml:
    '<h1>For contributors</h1><p>Build/test instructions, architecture, and the project\'s requirements docs.</p><ul>' +
    DEV_DOCS.map((d) => `<li><a href="${d.file.replace(/\.md$/, '.html')}">${d.title}</a></li>`).join('') +
    '</ul>',
});

// --- 4. Gallery (TR5.3/TR5.4) + live demos (TR5.5), via a headless browser for compositing ---
const browser = await chromium.launch();
const page = await browser.newPage();

async function frameScreenshot(imagePath, urlText, outPath) {
  // A data: URI rather than file:// — a page loaded via setContent() has no origin that's
  // allowed to load local files, so an img pointed at file://... never fires `load` and the
  // screenshot would time out waiting for it.
  const dataUri = `data:image/png;base64,${fs.readFileSync(imagePath).toString('base64')}`;
  const template = readTemplate('frame-desktop.html')
    .replace('{{IMAGE_SRC}}', dataUri)
    .replace('{{URL_TEXT}}', urlText);
  await page.setContent(template);
  // waitForSelector only waits for the <img> to exist in the DOM, not for it to finish loading —
  // without waiting for that too, the image has zero rendered height at capture time and the
  // screenshot comes out as just an empty title bar.
  await page.waitForFunction(() => {
    const img = document.querySelector('img');
    return !!img && img.complete && img.naturalWidth > 0;
  });
  await page.locator('.frame').screenshot({ path: outPath });
}

function readSitesConfigSafe() {
  try {
    return readSitesConfig();
  } catch {
    return [];
  }
}

const galleryEntries = [];

for (const fixture of SYNTHETIC_GALLERY_FIXTURES) {
  const beforePng = path.join(SCREENSHOT_DIR, fixture.id, `${GALLERY_FACTOR}-before.png`);
  const afterPng = path.join(SCREENSHOT_DIR, fixture.id, `${GALLERY_FACTOR}-after.png`);
  if (!fs.existsSync(beforePng) || !fs.existsSync(afterPng)) {
    console.warn(`[gallery] skipping ${fixture.id}: screenshots not found (run the Layer 1 suite first)`);
    continue;
  }
  const outDir = path.join(DIST, 'gallery', fixture.id);
  ensureDir(outDir);
  const urlText = `https://example.com/${fixture.id}/`;
  await frameScreenshot(beforePng, urlText, path.join(outDir, 'before.png'));
  await frameScreenshot(afterPng, urlText, path.join(outDir, 'after.png'));
  galleryEntries.push({ id: fixture.id, label: fixture.label, hasDemo: true });
}

for (const site of readSitesConfigSafe()) {
  const beforePng = path.join(SCREENSHOT_DIR, 'real-world', `${site.id}-1x.png`);
  const afterPng = path.join(SCREENSHOT_DIR, 'real-world', `${site.id}-1.5x.png`);
  if (!fs.existsSync(beforePng) || !fs.existsSync(afterPng)) {
    console.warn(`[gallery] skipping real-world/${site.id}: screenshots not found (run "npm run test:real-world" first)`);
    continue;
  }
  const outDir = path.join(DIST, 'gallery', site.id);
  ensureDir(outDir);
  await frameScreenshot(beforePng, site.url, path.join(outDir, 'before.png'));
  await frameScreenshot(afterPng, site.url, path.join(outDir, 'after.png'));
  const hasSnapshot = fs.existsSync(path.join(FIXTURES_DIR, 'real-world', 'snapshots', site.id, 'index.html'));
  galleryEntries.push({ id: site.id, label: `${site.description} (real site)`, hasDemo: hasSnapshot, isRealWorld: true });
}

// Gallery per-fixture pages
for (const entry of galleryEntries) {
  const demoLink = entry.hasDemo
    ? `<p><a class="demo-link" href="../../demos/${entry.id}/index.html">Try it live &rarr;</a></p>`
    : '';
  writePage(path.join(DIST, 'gallery', entry.id, 'index.html'), {
    title: entry.label,
    assetRoot: '../../',
    bodyHtml: `
      <h1>${entry.label}</h1>
      <div class="shot-pair">
        <figure><img src="before.png" alt="Before scaling"><figcaption>Before</figcaption></figure>
        <figure><img src="after.png" alt="After scaling"><figcaption>After (2&times;)</figcaption></figure>
      </div>
      ${demoLink}
    `,
  });
}

writePage(path.join(DIST, 'gallery', 'index.html'), {
  title: 'Screenshot gallery',
  assetRoot: '../',
  bodyHtml:
    '<h1>Screenshot gallery</h1><p>Before/after examples across a range of page styles, including real sites.</p><div class="card-grid">' +
    galleryEntries
      .map((e) => `<div class="card"><h3>${e.label}</h3><a href="${e.id}/index.html">View</a></div>`)
      .join('') +
    '</div>',
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
  for (const fixture of [...SYNTHETIC_GALLERY_FIXTURES, ...EXTRA_DEMO_FIXTURES]) {
    const entryPath = path.join(FIXTURES_DIR, fixture.sourceDir, fixture.entry);
    if (!fs.existsSync(entryPath)) continue;
    const outDir = path.join(DIST, 'demos', fixture.id);
    ensureDir(outDir);
    const html = fs.readFileSync(entryPath, 'utf8');
    fs.writeFileSync(path.join(outDir, 'index.html'), injectDemoScript(html), 'utf8');
    for (const extra of fixture.extraFiles ?? []) {
      fs.copyFileSync(path.join(FIXTURES_DIR, fixture.sourceDir, extra), path.join(outDir, extra));
    }
  }

  for (const site of readSitesConfigSafe()) {
    const snapshotPath = path.join(FIXTURES_DIR, 'real-world', 'snapshots', site.id, 'index.html');
    if (!fs.existsSync(snapshotPath)) continue;
    const outDir = path.join(DIST, 'demos', site.id);
    ensureDir(outDir);
    const html = fs.readFileSync(snapshotPath, 'utf8');
    fs.writeFileSync(path.join(outDir, 'index.html'), injectDemoScript(html), 'utf8');
  }
}
// iframe-cross-origin has no live demo on purpose (TR5.5): it depends on the local two-port test
// server setup and wouldn't work once this site is served/deployed elsewhere.

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

// --- 5. Landing page (TR5.2/TR5.2a/TR5.2b) ---
const installCards = [
  ['install-firefox-desktop-userscript', 'Firefox Desktop — userscript'],
  ['install-firefox-desktop-extension', 'Firefox Desktop — extension'],
  ['install-firefox-android-userscript', 'Firefox Android — userscript'],
  ['install-firefox-android-extension', 'Firefox Android — extension'],
]
  .map(
    ([slug, label]) =>
      `<div class="card"><h3>${label}</h3><a href="guides/${slug}.html">Install guide</a></div>`,
  )
  .join('');

writePage(path.join(DIST, 'index.html'), {
  title: 'Text Size Adjuster',
  assetRoot: '',
  bodyHtml: `
    <h1>Text Size Adjuster</h1>
    <p>Scale a web page's text up or down, on the spot, without the sideways-scrolling mess
    native pinch/page zoom causes. Available as a userscript (Tampermonkey/Violentmonkey) or a
    Firefox extension, on both desktop and Android.</p>

    <h2>Install</h2>
    <div class="card-grid">${installCards}</div>

    <h2>Run a website?</h2>
    <p>Give every visitor the same +/− control with a single script tag —
    <a href="guides/add-to-your-website.html">see how</a>, or
    <a href="demos/script-tag/index.html">try the demo page</a> that does exactly that.</p>

    <h2>Learn more</h2>
    <ul>
      <li><a href="guides/how-it-differs.html">How this differs from your browser's zoom/accessibility settings</a></li>
      <li><a href="guides/limitations.html">What this can't fix (and why)</a></li>
      <li><a href="gallery/index.html">Screenshot gallery</a> — before/after examples, including real sites, with live demos to try yourself</li>
    </ul>
  `,
});

console.log(`Documentation site built at ${DIST}`);
