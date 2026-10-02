export interface Fixture {
  id: string;
  label: string;
  exercises: string;
  traces: string;
  entry: string;
  extraFiles?: string[];
  standard: boolean;
  demo: boolean;
}

export interface Site {
  id: string;
  name: string;
  url: string;
  description: string;
  /** Playwright selector; screenshots start at this element (e.g. the article's first paragraph). */
  screenshotFrom?: string;
}

export const REPO_ROOT: string;
export const CORE_BUNDLE: string;
export const USERSCRIPT_FILENAME: string;
export const USERSCRIPT_DIST: string;
export const USERSCRIPT_BUNDLE: string;
export const EXTENSION_DIR: string;
export const EXTENSION_DIST: string;
export const EXTENSION_ARTIFACTS: string;
export const EXTENSION_CHROME_DIST: string;
export function chromeZipFilename(version: string): string;
export const UNSIGNED_XPI_FILENAME: string;
export const SIGNED_XPI: string;
export const SIGNED_XPI_FILENAME: string;
export const THEME_CSS: string;
export const FIXTURES_DIR: string;
export const SITES_FILE: string;
export const SCREENSHOT_DIR: string;
export const FIXTURE_PORT: number;
export const FIXTURE_SECONDARY_PORT: number;
export const FIXTURE_ORIGIN: string;
export const PHONE_VIEWPORT: { width: number; height: number };
export const PHONE_SCALE: number;
export function fixtureScreenshot(id: string, factor: number): string;
export function realWorldScreenshot(id: string, factor: number): string;
export function realWorldSnapshot(id: string): string;
export function readFixtures(): Fixture[];
export function readSites(): Site[];
export function readJson(file: string): unknown;
export function writeJson(file: string, value: unknown): void;
export function requireBuilt(file: string, workspace: string): void;
