import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFixture } from 'playwright-webextext';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXTENSION_DIR = path.resolve(__dirname, '../packages/extension/dist');

export const { test, expect } = createFixture(EXTENSION_DIR);
export { EXTENSION_DIR };
