import { devices, type PlaywrightTestConfig } from '@playwright/test';
import { FIXTURE_ORIGIN } from '../tools/paths.js';

/** Shared by the three configs: the fixture server, its base URL, and the browser projects. */
export const baseConfig: PlaywrightTestConfig = {
  testDir: '.',
  fullyParallel: true,
  retries: 0,
  reporter: [['list']],
  webServer: {
    command: 'node ../fixtures/server.js',
    url: `${FIXTURE_ORIGIN}/plain-px/`,
    reuseExistingServer: !process.env.CI,
    timeout: 20_000,
  },
  use: {
    baseURL: FIXTURE_ORIGIN,
  },
  projects: [
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
};
