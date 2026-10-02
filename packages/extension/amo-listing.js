import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { readProduct, stripComments } from '../../tools/product.js';
import { EXTENSION_ARTIFACTS, EXTENSION_DIR, REPO_ROOT, writeJson } from '../../tools/paths.js';

/**
 * What a listed addons.mozilla.org submission needs besides the package itself (see sign.js):
 * - the listing metadata, for web-ext's --amo-metadata: name, summary and description from
 *   product.json / product-description.txt, categories, support and homepage links, license, and
 *   the reviewer notes from amo-reviewer-notes.txt;
 * - the source code archive, for --upload-source-code: the git repository at HEAD, since the
 *   extension is bundled and minified.
 * Both are written to web-ext-artifacts/; the functions return their paths.
 */

/** AMO's category slugs (https://addons.mozilla.org/api/v5/addons/categories/); shared by desktop and Android. */
const CATEGORIES = ['appearance'];

export function writeAmoMetadata(version) {
  const product = readProduct();
  const notes = stripComments(fs.readFileSync(path.join(EXTENSION_DIR, 'amo-reviewer-notes.txt'), 'utf8'));
  const file = path.join(EXTENSION_ARTIFACTS, `amo-metadata-${version}.json`);
  fs.mkdirSync(EXTENSION_ARTIFACTS, { recursive: true });
  writeJson(file, {
    name: { 'en-US': product.name },
    summary: { 'en-US': product.summary },
    description: { 'en-US': product.description },
    homepage: { 'en-US': product.homepage },
    support_url: { 'en-US': `${product.repository}/issues` },
    categories: CATEGORIES,
    is_experimental: false,
    requires_payment: false,
    version: { license: product.license, approval_notes: notes },
  });
  return file;
}

/** The repository at HEAD as a zip. Refuses uncommitted changes, which wouldn't be in it. */
export function writeSourceArchive(version) {
  const git = (...args) => execFileSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
  if (git('status', '--porcelain', '--untracked-files=no') !== '') {
    throw new Error('Uncommitted changes: commit them first, so the source archive matches the build.');
  }
  const file = path.join(EXTENSION_ARTIFACTS, `source-${version}.zip`);
  fs.mkdirSync(EXTENSION_ARTIFACTS, { recursive: true });
  git('archive', '--format=zip', '--prefix=text-size-adjuster/', '-o', file, 'HEAD');
  return file;
}

// `node amo-listing.js` writes both, to check them before submitting.
if (import.meta.url === `file://${process.argv[1]}`) {
  const { version } = JSON.parse(fs.readFileSync(path.join(EXTENSION_DIR, 'package.json'), 'utf8'));
  console.log(path.relative(REPO_ROOT, writeAmoMetadata(version)));
  console.log(path.relative(REPO_ROOT, writeSourceArchive(version)));
}
