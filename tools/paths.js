// @ts-check
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Shared locations and conventions for build scripts, tests and the docs site, so each path,
 * file name and port is written once. The JSDoc types here are what the TypeScript consumers see
 * (the e2e workspace's typecheck also checks this file against them).
 */

/**
 * A synthetic fixture (fixtures/fixtures.json).
 * @typedef {object} Fixture
 * @property {string} id
 * @property {string} label
 * @property {string} exercises
 * @property {string} traces
 * @property {string} entry
 * @property {string[]} [extraFiles]
 * @property {boolean} standard
 * @property {boolean} demo
 */

/**
 * A real-world site (fixtures/real-world/sites.json).
 * @typedef {object} Site
 * @property {string} id
 * @property {string} name
 * @property {string} url
 * @property {string} description
 * @property {string} [screenshotFrom] Playwright selector; screenshots start at this element
 *   (e.g. the article's first paragraph).
 */

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const CORE_BUNDLE = path.join(REPO_ROOT, 'packages', 'core', 'dist', 'index.global.js');

export const USERSCRIPT_FILENAME = 'text-size-adjuster.user.js';
export const USERSCRIPT_DIST = path.join(REPO_ROOT, 'packages', 'userscript', 'dist');
export const USERSCRIPT_BUNDLE = path.join(USERSCRIPT_DIST, USERSCRIPT_FILENAME);

export const EXTENSION_DIR = path.join(REPO_ROOT, 'packages', 'extension');
export const EXTENSION_DIST = path.join(EXTENSION_DIR, 'dist');
export const EXTENSION_ARTIFACTS = path.join(EXTENSION_DIR, 'web-ext-artifacts');
/** The Chrome variant (build-chrome-variant.js) and its zip, for the Chrome Web Store or Edge Add-ons. */
export const EXTENSION_CHROME_DIST = path.join(EXTENSION_DIR, 'dist-chrome');
export const chromeZipFilename = (/** @type {string} */ version) =>
  `text-size-adjuster-chrome-${version}.zip`;
export const UNSIGNED_XPI_FILENAME = 'text-size-adjuster-unsigned.xpi';
export const SIGNED_XPI = path.join(EXTENSION_ARTIFACTS, 'text-size-adjuster-signed.xpi');
/**
 * The signed .xpi addons.mozilla.org returned for `version`, as web-ext saved it, or undefined.
 * @param {string} version
 */
export function signedXpiFor(version) {
  if (!fs.existsSync(EXTENSION_ARTIFACTS)) return undefined;
  const file = fs.readdirSync(EXTENSION_ARTIFACTS).find((f) => f.endsWith(`-${version}.xpi`));
  return file && path.join(EXTENSION_ARTIFACTS, file);
}
/** File name of the signed .xpi attached to each GitHub release (see release-github.js). */
export const SIGNED_XPI_FILENAME = 'text-size-adjuster.xpi';

/** Shared CSS for the docs site and the extension's pages. */
export const THEME_CSS = path.join(REPO_ROOT, 'packages', 'theme', 'theme.css');

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

/**
 * Gallery screenshots, written by the e2e specs and read by the docs build.
 * @param {string} id
 * @param {number} factor
 */
export function fixtureScreenshot(id, factor) {
  return path.join(SCREENSHOT_DIR, id, `phone-${factor}x.png`);
}
/**
 * @param {string} id
 * @param {number} factor
 */
export function realWorldScreenshot(id, factor) {
  return path.join(SCREENSHOT_DIR, 'real-world', `${id}-${factor}x.png`);
}
/** @param {string} id */
export function realWorldSnapshot(id) {
  return path.join(FIXTURES_DIR, 'real-world', 'snapshots', id, 'index.html');
}

/**
 * The synthetic fixtures (fixtures/fixtures.json).
 * @returns {Fixture[]}
 */
export function readFixtures() {
  return readJson(path.join(FIXTURES_DIR, 'fixtures.json')).fixtures;
}

/**
 * The real-world sites (fixtures/real-world/sites.json).
 * @returns {Site[]}
 */
export function readSites() {
  return readJson(SITES_FILE);
}

/**
 * @param {string} file
 * @returns {any}
 */
export function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/**
 * @param {string} file
 * @param {unknown} value
 */
export function writeJson(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
}

/**
 * Throws a helpful error when a build output is missing.
 * @param {string} file
 * @param {string} workspace
 */
export function requireBuilt(file, workspace) {
  if (!fs.existsSync(file)) {
    throw new Error(
      `${path.relative(REPO_ROOT, file)} not found. Run "npm run build -w ${workspace}" first.`,
    );
  }
}
