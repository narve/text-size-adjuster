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
  validateProduct({ name, summary, description });
  return { name, summary, description };
}

/**
 * Length limits, so a build fails early instead of a store rejecting the upload:
 * - name: 50 characters, addons.mozilla.org's add-on name limit (Chrome allows 75).
 * - summary: 132 characters — it's also the manifest `description`, and Chrome's limit for that
 *   is 132 (stricter than AMO's 250 for both the manifest field and the listing summary).
 * - description: no practical store limit; 5000 is this project's own readability guideline.
 */
export const LIMITS = { name: 50, summary: 132, description: 5000 };

export function validateProduct(product) {
  const problems = [];
  for (const [field, max] of Object.entries(LIMITS)) {
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
