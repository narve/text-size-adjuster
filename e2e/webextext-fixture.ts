import { createFixture } from 'playwright-webextext';
import { EXTENSION_DIST } from '../tools/paths.mjs';

export const { test, expect } = createFixture(EXTENSION_DIST);
