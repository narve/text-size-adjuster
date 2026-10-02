import fs from 'node:fs';
import path from 'node:path';
import { EXTENSION_DIR, EXTENSION_DIST, readJson, requireBuilt, writeJson } from '../../tools/paths.js';

// FR8 (best-effort, not a primary target): reuses the built Firefox extension as-is — the
// bundles are already cross-browser via webextension-polyfill's `browser` global — and only
// swaps in the Chrome-specific manifest (no browser_specific_settings, a background service worker
// instead of Firefox's background scripts).

const CHROME_DIST = path.join(EXTENSION_DIR, 'dist-chrome');
const manifestFile = path.join(EXTENSION_DIST, 'manifest.json');
requireBuilt(manifestFile, 'packages/extension');

fs.rmSync(CHROME_DIST, { recursive: true, force: true });
fs.cpSync(EXTENSION_DIST, CHROME_DIST, { recursive: true });
// Derived from the built Firefox manifest (single source): drop the Firefox-only keys. Chrome
// MV3 wants a service worker background (Firefox ignores that key and web-ext lint warns about
// it, so the Firefox manifest only has `scripts`), and has no browser_specific_settings.
const manifest = readJson(manifestFile);
delete manifest.browser_specific_settings;
const [backgroundScript, ...others] = manifest.background.scripts;
if (!backgroundScript || others.length > 0) {
  throw new Error('Expected exactly one background script to turn into the Chrome service worker.');
}
manifest.background = { service_worker: backgroundScript };
writeJson(path.join(CHROME_DIST, 'manifest.json'), manifest);

console.log('Chrome-targeted build written to dist-chrome/ (best-effort, FR8 — not a primary target).');
