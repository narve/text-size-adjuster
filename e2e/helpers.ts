import type { Page } from '@playwright/test';
import { CORE_BUNDLE } from '../tools/paths.mjs';

/** The slice of the engine API the specs drive through `window.__tsa`. */
export interface MinimalEngine {
  attach(): void;
  setFactor(k: number): number;
}

export type TsaWindow = Window & {
  TSA_CORE: { createEngine: () => MinimalEngine };
  __tsa: MinimalEngine;
};

/** Creates and attaches an engine on `window.__tsa` (the core bundle must already be loaded). */
export function attachEngine(page: Page): Promise<void> {
  return page.evaluate(() => {
    const w = window as unknown as TsaWindow;
    w.__tsa = w.TSA_CORE.createEngine();
    w.__tsa.attach();
  });
}

/** Registers the core bundle as an init script, navigates, then attaches an engine. */
export async function gotoAndAttach(
  page: Page,
  url: string,
  options?: Parameters<Page['goto']>[1],
): Promise<void> {
  await page.addInitScript({ path: CORE_BUNDLE });
  await page.goto(url, options);
  await attachEngine(page);
}

export function setFactor(page: Page, factor: number): Promise<void> {
  return page.evaluate((k) => {
    (window as unknown as TsaWindow).__tsa.setFactor(k);
  }, factor);
}
