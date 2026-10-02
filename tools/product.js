import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SIGNED_XPI_FILENAME } from './paths.js';

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
 * `store` picks the {{platforms}} text in the description: 'firefox' (addons.mozilla.org, the
 * docs site) or 'chrome' (Chrome Web Store, Edge Add-ons).
 *
 * The product's name, one-line summary, links and license (product.json), long store description
 * (product-description.txt) and version — the single source for all descriptive text. The version
 * lives in packages/extension/package.json, where `npm run release:extension` bumps it.
 */
export function readProduct(store = 'firefox') {
  const { name, summary, homepage, repository, license, platforms, limits } = JSON.parse(
    fs.readFileSync(path.join(REPO_ROOT, 'product.json'), 'utf8'),
  );
  const { version } = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'packages', 'extension', 'package.json'), 'utf8'));
  const description = stripComments(
    fs.readFileSync(path.join(REPO_ROOT, 'product-description.txt'), 'utf8'),
  )
    .replaceAll('{{homepage}}', homepage)
    .replaceAll('{{platforms}}', platforms[store]);
  validateProduct({ name, summary, description }, limits);
  // The newest signed build, attached to the latest GitHub release by `npm run release:github`.
  const signedXpiUrl = `${repository}/releases/latest/download/${SIGNED_XPI_FILENAME}`;
  // Where Firefox checks for newer GitHub-released versions (see the docs build's updates.json).
  const updateUrl = `${homepage}updates.json`;
  return { name, summary, homepage, repository, license, version, description, signedXpiUrl, updateUrl };
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
