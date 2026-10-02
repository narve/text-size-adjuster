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
  const { name, summary, homepage, limits } = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'product.json'), 'utf8'));
  const description = stripComments(
    fs.readFileSync(path.join(REPO_ROOT, 'product-description.txt'), 'utf8'),
  ).replaceAll('{{homepage}}', homepage);
  validateProduct({ name, summary, description }, limits);
  return { name, summary, homepage, description };
}

/** Checks each text against `limits` from product.json (see its `_about` for where they come from). */
export function validateProduct(product, limits) {
  const problems = [];
  for (const [field, max] of Object.entries(limits)) {
    const value = product[field];
    if (typeof value !== 'string' || value.trim() === '') {
      problems.push(`${field} is empty`);
    } else if ([...value].length > max) {
      problems.push(`${field} is ${[...value].length} characters, the limit is ${max}`);
    }
  }
  if (problems.length > 0) {
    throw new Error(`product.json / product-description.txt: ${problems.join('; ')}.`);
  }
}
