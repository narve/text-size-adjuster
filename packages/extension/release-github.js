import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readProduct } from '../../tools/product.js';
import { EXTENSION_DIST, REPO_ROOT, SIGNED_XPI, SIGNED_XPI_FILENAME, readJson, requireBuilt } from '../../tools/paths.js';

// Publishes the signed .xpi from `npm run release:extension` as a GitHub release, tagged
// v<version> at the current commit. The guides link to the latest release's .xpi
// (product.signedXpiUrl), so this is what makes a new version downloadable.
//
// The tag has to point at the commit with the bumped version, so commit and push that first.
// Afterwards it starts the docs workflow on master, which regenerates the site's updates.json from
// the releases, so Firefox installs from earlier releases update to this one.

const git = (...args) => execFileSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8' }).trim();

const manifestFile = path.join(EXTENSION_DIST, 'manifest.json');
requireBuilt(manifestFile, 'packages/extension');
const { version } = readJson(manifestFile);
if (!fs.existsSync(SIGNED_XPI)) {
  console.error(`No signed .xpi at ${path.relative(REPO_ROOT, SIGNED_XPI)}. Run "npm run release:extension" first.`);
  process.exit(1);
}

const head = git('rev-parse', 'HEAD');
if (git('status', '--porcelain', '--untracked-files=no') !== '') {
  console.error('Uncommitted changes. Commit (the version bump at least) and push before releasing.');
  process.exit(1);
}
git('fetch', '--quiet', 'origin');
if (!git('branch', '--remotes', '--contains', head)) {
  console.error(`Commit ${head.slice(0, 7)} isn't on GitHub yet. Push it before releasing.`);
  process.exit(1);
}

// The release asset takes its name from the file, so copy it under the name the guides link to.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tsa-release-'));
const asset = path.join(dir, SIGNED_XPI_FILENAME);
fs.copyFileSync(SIGNED_XPI, asset);

const product = readProduct();
const notes =
  `Signed by Mozilla (unlisted). Open the .xpi in Firefox to install it, on desktop or Android.\n\n` +
  `Install guide: ${product.homepage}guides/install.html`;
execFileSync(
  'gh',
  ['release', 'create', `v${version}`, asset, '--target', head, '--title', `${product.name} ${version}`, '--notes', notes],
  { cwd: REPO_ROOT, stdio: 'inherit' },
);
fs.rmSync(dir, { recursive: true, force: true });

execFileSync('gh', ['workflow', 'run', 'docs.yml', '--ref', 'master'], { cwd: REPO_ROOT, stdio: 'inherit' });
console.log('Started the docs workflow, which publishes the new updates.json.');
