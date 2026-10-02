import fs from 'node:fs';
import path from 'node:path';
import { EXTENSION_DIR, EXTENSION_DIST, readJson, requireBuilt, writeJson } from '../../tools/paths.js';

// FR8 (best-effort, not a primary target): reuses the built Firefox extension as-is — the
// bundles are already cross-browser via webextension-polyfill's `browser` global — and only
// swaps in the Chrome-specific manifest (no browser_specific_settings, background.service_worker
// only, no Firefox scripts fallback).

const CHROME_DIST = path.join(EXTENSION_DIR, 'dist-chrome');
const manifestFile = path.join(EXTENSION_DIST, 'manifest.json');
requireBuilt(manifestFile, 'packages/extension');

fs.rmSync(CHROME_DIST, { recursive: true, force: true });
fs.cpSync(EXTENSION_DIST, CHROME_DIST, { recursive: true });
// Derived from the built Firefox manifest (single source): drop the Firefox-only keys. Chrome
// MV3 wants only a service worker background, and has no browser_specific_settings.
const manifest = readJson(manifestFile);
delete manifest.browser_specific_settings;
manifest.background = { service_worker: manifest.background.service_worker };
writeJson(path.join(CHROME_DIST, 'manifest.json'), manifest);

console.log('Chrome-targeted build written to dist-chrome/ (best-effort, FR8 — not a primary target).');
