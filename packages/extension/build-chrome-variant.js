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
// swaps in the Chrome-specific manifest (no browser_specific_settings, background.service_worker
// only, no Firefox scripts fallback).

const manifestFile = path.join(EXTENSION_DIST, 'manifest.json');
requireBuilt(manifestFile, 'packages/extension');

fs.rmSync(CHROME_DIST, { recursive: true, force: true });
// Without dot files: web-ext sign leaves its upload cache (.amo-upload-uuid) in dist/.
fs.cpSync(EXTENSION_DIST, CHROME_DIST, { recursive: true, filter: (src) => !path.basename(src).startsWith('.') });
// Derived from the built Firefox manifest (single source): drop the Firefox-only keys. Chrome
// MV3 wants only a service worker background, and has no browser_specific_settings.
const manifest = readJson(manifestFile);
delete manifest.browser_specific_settings;
manifest.background = { service_worker: manifest.background.service_worker };
writeJson(path.join(CHROME_DIST, 'manifest.json'), manifest);

// The upload package for the Chrome Web Store (or Microsoft Edge Add-ons): dist-chrome/ zipped.
const zip = chromeZipFilename(manifest.version);
execFileSync(
  'npx',
  ['web-ext', 'build', '--source-dir', CHROME_DIST, '--artifacts-dir', EXTENSION_ARTIFACTS, '--filename', zip, '--overwrite-dest'],
  { cwd: EXTENSION_DIR, stdio: 'ignore' },
);
console.log(`Chrome build written to dist-chrome/ and web-ext-artifacts/${zip} (best-effort, FR8).`);
