import { createFixture } from 'playwright-webextext';
import { EXTENSION_DIST } from '../tools/paths.js';

export const { test, expect } = createFixture(EXTENSION_DIST);
