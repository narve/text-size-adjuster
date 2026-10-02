import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// FR8 (best-effort, not a primary target): reuses the already-built JS bundles as-is — they're
// already cross-browser via webextension-polyfill's `browser` global — and only swaps in the
// Chrome-specific manifest (no browser_specific_settings, background.service_worker only, no
// Firefox scripts fallback).

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIST = path.join(__dirname, 'dist');
const CHROME_DIST = path.join(__dirname, 'dist-chrome');

if (!fs.existsSync(SRC_DIST)) {
  throw new Error('dist/ not found — run "npm run build -w packages/extension" first.');
}

fs.rmSync(CHROME_DIST, { recursive: true, force: true });
fs.mkdirSync(CHROME_DIST, { recursive: true });

for (const file of ['content.js', 'background.js', 'popup.js', 'popup.html', 'options.js', 'options.html']) {
  fs.copyFileSync(path.join(SRC_DIST, file), path.join(CHROME_DIST, file));
}
fs.cpSync(path.join(SRC_DIST, 'icons'), path.join(CHROME_DIST, 'icons'), { recursive: true });
// Derived from the built Firefox manifest (single source): drop the Firefox-only keys. Chrome
// MV3 wants only a service worker background, and has no browser_specific_settings.
const manifest = JSON.parse(fs.readFileSync(path.join(SRC_DIST, 'manifest.json'), 'utf8'));
delete manifest.browser_specific_settings;
manifest.background = { service_worker: manifest.background.service_worker };
fs.writeFileSync(path.join(CHROME_DIST, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

console.log('Chrome-targeted build written to dist-chrome/ (best-effort, FR8 — not a primary target).');
