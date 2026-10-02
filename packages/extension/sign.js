import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {
  EXTENSION_ARTIFACTS as ARTIFACTS,
  EXTENSION_DIR,
  EXTENSION_DIST as DIST,
  REPO_ROOT,
  SIGNED_XPI,
  readJson,
  requireBuilt,
} from '../../tools/paths.js';
import { writeAmoMetadata, writeSourceArchive } from './amo-listing.js';

// Signs the built extension (dist/) with Mozilla as an *unlisted* add-on: signed, so release
// Firefox (desktop and Android) installs it permanently, but not published on addons.mozilla.org.
//
// With --listed it instead submits it for the public listing on addons.mozilla.org, with the
// listing metadata and source code archive from amo-listing.js. Listed versions go through
// Mozilla's review, which can take days, so this doesn't wait for approval; Mozilla then publishes
// the version itself. Every version number can only be uploaded once, across both channels.
//
// Credentials (from https://addons.mozilla.org/developers/addon/api/key/) come from the repo's
// gitignored `private.env`, or from the environment (e.g. CI secrets):
//   JWT issuer: firefox_jwt_issuer or AMO_JWT_ISSUER   (looks like "user:12345678:123")
//   JWT secret: firefox_auth_key / firefox_jwt_secret or AMO_JWT_SECRET
// They're passed to web-ext via its WEB_EXT_API_* environment variables, never on the command
// line, so they don't show up in process listings or logs.

function readPrivateEnv() {
  const file = path.join(REPO_ROOT, 'private.env');
  if (!fs.existsSync(file)) return {};
  const values = {};
  for (const raw of fs.readFileSync(file, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const index = line.indexOf('=');
    values[line.slice(0, index).trim()] = line.slice(index + 1).trim().replace(/^["']|["']$/g, '');
  }
  return values;
}

const fileValues = readPrivateEnv();
const issuer = process.env.AMO_JWT_ISSUER ?? fileValues.firefox_jwt_issuer;
const secret = process.env.AMO_JWT_SECRET ?? fileValues.firefox_jwt_secret ?? fileValues.firefox_auth_key;

const missing = [];
if (!issuer) missing.push('JWT issuer (firefox_jwt_issuer / AMO_JWT_ISSUER)');
if (!secret) missing.push('JWT secret (firefox_auth_key / AMO_JWT_SECRET)');
if (missing.length > 0) {
  console.error(
    `Can't sign: missing ${missing.join(' and ')}.\n` +
      'Add them to private.env in the repo root, from https://addons.mozilla.org/developers/addon/api/key/',
  );
  process.exit(1);
}
const manifestFile = path.join(DIST, 'manifest.json');
requireBuilt(manifestFile, 'packages/extension');

const { version } = readJson(manifestFile);
const listed = process.argv.includes('--listed');
const webExt = (args) =>
  execFileSync('npx', ['web-ext', 'sign', '--source-dir', DIST, '--artifacts-dir', ARTIFACTS, ...args], {
    cwd: EXTENSION_DIR,
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

console.log(`Signing version ${version} as an unlisted add-on (usually takes a few minutes)...`);
webExt(['--channel', 'unlisted']);

const signed = fs
  .readdirSync(ARTIFACTS)
  .filter((f) => f.endsWith('.xpi') && f.includes(version))
  .map((f) => path.join(ARTIFACTS, f));
if (signed.length === 0) {
  console.error('web-ext finished but no signed .xpi for this version was found in web-ext-artifacts/.');
  process.exit(1);
}
fs.copyFileSync(signed[0], SIGNED_XPI);
console.log(`Signed: ${path.relative(REPO_ROOT, SIGNED_XPI)}`);
