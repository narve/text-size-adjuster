import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Shared locations and conventions for build scripts, tests and the docs site, so each path,
 * file name and port is written once. Types for the TypeScript consumers are in paths.d.ts.
 */

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const CORE_BUNDLE = path.join(REPO_ROOT, 'packages', 'core', 'dist', 'index.global.js');

export const USERSCRIPT_FILENAME = 'text-size-adjuster.user.js';
export const USERSCRIPT_DIST = path.join(REPO_ROOT, 'packages', 'userscript', 'dist');
export const USERSCRIPT_BUNDLE = path.join(USERSCRIPT_DIST, USERSCRIPT_FILENAME);

export const EXTENSION_DIR = path.join(REPO_ROOT, 'packages', 'extension');
export const EXTENSION_DIST = path.join(EXTENSION_DIR, 'dist');
export const EXTENSION_ARTIFACTS = path.join(EXTENSION_DIR, 'web-ext-artifacts');
export const UNSIGNED_XPI_FILENAME = 'text-size-adjuster-unsigned.xpi';
export const SIGNED_XPI = path.join(EXTENSION_ARTIFACTS, 'text-size-adjuster-signed.xpi');

export const FIXTURES_DIR = path.join(REPO_ROOT, 'fixtures');
export const SITES_FILE = path.join(FIXTURES_DIR, 'real-world', 'sites.json');
export const SCREENSHOT_DIR = path.join(REPO_ROOT, 'e2e', 'screenshots');

/** Fixture server (fixtures/server.js): two ports give two origins for the cross-origin fixture. */
export const FIXTURE_PORT = Number(process.env.TSA_FIXTURES_PORT ?? 4310);
export const FIXTURE_SECONDARY_PORT = Number(process.env.TSA_FIXTURES_SECONDARY_PORT ?? 4311);
export const FIXTURE_ORIGIN = `http://127.0.0.1:${FIXTURE_PORT}`;

/** Phone viewport for gallery screenshots; as wide as the Pixel 7 the real-world snapshots use. */
export const PHONE_VIEWPORT = { width: 412, height: 915 };
export const PHONE_SCALE = 2;

/** Gallery screenshots, written by the e2e specs and read by the docs build. */
export function fixtureScreenshot(id, factor) {
  return path.join(SCREENSHOT_DIR, id, `phone-${factor}x.png`);
}
export function realWorldScreenshot(id, factor) {
  return path.join(SCREENSHOT_DIR, 'real-world', `${id}-${factor}x.png`);
}
export function realWorldSnapshot(id) {
  return path.join(FIXTURES_DIR, 'real-world', 'snapshots', id, 'index.html');
}

/** The synthetic fixtures (fixtures/fixtures.json). */
export function readFixtures() {
  return readJson(path.join(FIXTURES_DIR, 'fixtures.json')).fixtures;
}

/** The real-world sites (fixtures/real-world/sites.json). */
export function readSites() {
  return readJson(SITES_FILE);
}

export function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function writeJson(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
}

/** Throws a helpful error when a build output is missing. */
export function requireBuilt(file, workspace) {
  if (!fs.existsSync(file)) {
    throw new Error(
      `${path.relative(REPO_ROOT, file)} not found. Run "npm run build -w ${workspace}" first.`,
    );
  }
}
