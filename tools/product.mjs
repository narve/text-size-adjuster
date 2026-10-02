import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Lines starting with "#" are comments in product-description.txt; drop them and trim. */
export function stripComments(text) {
  return text
    .split('\n')
    .filter((line) => !line.startsWith('#'))
    .join('\n')
    .trim();
}

/**
 * The product's name, one-line summary (product.json) and long store description
 * (product-description.txt) — the single source for all descriptive text.
 */
export function readProduct() {
  const { name, summary } = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'product.json'), 'utf8'));
  const description = stripComments(fs.readFileSync(path.join(REPO_ROOT, 'product-description.txt'), 'utf8'));
  return { name, summary, description };
}
