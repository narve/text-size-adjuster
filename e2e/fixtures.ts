import { readFixtures } from '../tools/paths.mjs';

export interface FixtureDef {
  id: string;
  /** Path relative to the Playwright config's baseURL. */
  path: string;
}

/**
 * Fixtures validated with the generic "small/large reference ratio is preserved" check (TR2),
 * marked `standard` in fixtures/fixtures.json. The others (e.g. `spa-mutation`,
 * `iframe-cross-origin`) have their own dedicated test blocks in engine.spec.ts because they need
 * extra interaction/assertions beyond that generic check.
 */
export const STANDARD_FIXTURES: FixtureDef[] = readFixtures()
  .filter((f) => f.standard)
  .map((f) => ({ id: f.id, path: `/${f.id}/` }));

export const FACTORS = [0.5, 0.8, 1.0, 1.5, 2.0, 3.0];
