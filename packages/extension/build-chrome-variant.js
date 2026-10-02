import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {
  EXTENSION_ARTIFACTS,
  EXTENSION_CHROME_DIST as CHROME_DIST,
  EXTENSION_DIR,
  EXTENSION_DIST,
  chromeZipFilename,
  readJson,
  requireBuilt,
  writeJson,
} from '../../tools/paths.js';

// FR8 (best-effort, not a primary target): reuses the built Firefox extension as-is — the
// bundles are already cross-browser via webextension-polyfill's `browser` global — and only
// swaps in the Chrome-specific manifest (no browser_specific_settings, a background service worker
// instead of Firefox's background scripts).

const manifestFile = path.join(EXTENSION_DIST, 'manifest.json');
requireBuilt(manifestFile, 'packages/extension');

fs.rmSync(CHROME_DIST, { recursive: true, force: true });
// Without dot files: web-ext sign leaves its upload cache (.amo-upload-uuid) in dist/.
fs.cpSync(EXTENSION_DIST, CHROME_DIST, { recursive: true, filter: (src) => !path.basename(src).startsWith('.') });
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

// The upload package for the Chrome Web Store (or Microsoft Edge Add-ons): dist-chrome/ zipped.
const zip = chromeZipFilename(manifest.version);
execFileSync(
  'npx',
  ['web-ext', 'build', '--source-dir', CHROME_DIST, '--artifacts-dir', EXTENSION_ARTIFACTS, '--filename', zip, '--overwrite-dest'],
  { cwd: EXTENSION_DIR, stdio: 'ignore' },
);
console.log(`Chrome build written to dist-chrome/ and web-ext-artifacts/${zip} (best-effort, FR8).`);
