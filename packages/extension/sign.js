import fs from 'node:fs';
import path from 'node:path';
import {
  EXTENSION_ARTIFACTS as ARTIFACTS,
  EXTENSION_DIST as DIST,
  REPO_ROOT,
  SIGNED_XPI,
  signedXpiFor,
  readJson,
  requireBuilt,
  writeJson,
} from '../../tools/paths.js';
import { readProduct } from '../../tools/product.js';
import { runWebExt } from '../../tools/web-ext.js';
import { amoCredentials } from './amo-credentials.js';
import { writeAmoMetadata, writeSourceArchive } from './amo-listing.js';

// Signs the built extension (dist/) with Mozilla as an *unlisted* add-on: signed, so release
// Firefox (desktop and Android) installs it permanently, but not published on addons.mozilla.org.
//
// With --listed it instead submits it for the public listing on addons.mozilla.org, with the
// listing metadata and source code archive from amo-listing.js. Listed versions go through
// Mozilla's review, which can take days, so this doesn't wait for approval; Mozilla then publishes
// the version itself. Every version number can only be uploaded once, across both channels.
//
// Credentials: see amo-credentials.js. They're passed to web-ext via its WEB_EXT_API_*
// environment variables, never on the command line, so they don't show up in process listings or
// logs.
const { issuer, secret } = amoCredentials();
const manifestFile = path.join(DIST, 'manifest.json');
requireBuilt(manifestFile, 'packages/extension');

const { version } = readJson(manifestFile);
const listed = process.argv.includes('--listed');
const webExt = (args) =>
  runWebExt(['sign', '--source-dir', DIST, '--artifacts-dir', ARTIFACTS, ...args], {
    stdio: 'inherit',
    env: { ...process.env, WEB_EXT_API_KEY: issuer, WEB_EXT_API_SECRET: secret },
  });

if (listed) {
  const source = writeSourceArchive(version);
  const metadata = writeAmoMetadata(version);
  console.log(`Submitting version ${version} for the public listing on addons.mozilla.org...`);
  webExt([
    '--channel', 'listed',
    '--amo-metadata', metadata,
    '--upload-source-code', source,
    '--approval-timeout', '0',
  ]);
  console.log('Submitted. Mozilla reviews it and publishes it on addons.mozilla.org when approved.');
  process.exit(0);
}

// Unlisted builds are installed from GitHub releases, so they tell Firefox where to look for
// updates: the docs site's updates.json, generated from those releases. Only these builds: AMO
// doesn't allow update_url in listed add-ons, which it updates itself.
const manifest = readJson(manifestFile);
manifest.browser_specific_settings.gecko.update_url = readProduct().updateUrl;
writeJson(manifestFile, manifest);

console.log(`Signing version ${version} as an unlisted add-on (usually takes a few minutes)...`);
webExt(['--channel', 'unlisted']);

const signed = signedXpiFor(version);
if (!signed) {
  console.error('web-ext finished but no signed .xpi for this version was found in web-ext-artifacts/.');
  process.exit(1);
}
fs.copyFileSync(signed, SIGNED_XPI);
console.log(`Signed: ${path.relative(REPO_ROOT, SIGNED_XPI)}`);
