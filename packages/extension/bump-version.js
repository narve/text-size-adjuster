import path from 'node:path';
import { EXTENSION_DIR, readJson, writeJson } from '../../tools/paths.js';

// Bumps the extension's version. package.json is the single source of the version; the build
// injects it into the manifest. Run before signing: Mozilla signs each version number only once,
// on one channel.
//
// The numbering (developer guide, "Version numbers"): a version for addons.mozilla.org is x.Y.0,
// and the builds released on GitHub after it are x.Y.1, x.Y.2, … Without arguments this bumps the
// minor version, for addons.mozilla.org (x.Y.z → x.(Y+1).0); with --patch the patch version, for
// GitHub (x.y.Z → x.y.(Z+1)).

const file = path.join(EXTENSION_DIR, 'package.json');
const json = readJson(file);
const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(json.version);
if (!match) {
  console.error(`Can't bump: "${json.version}" isn't a plain major.minor.patch version.`);
  process.exit(1);
}
const [major, minor, patch] = match.slice(1).map(Number);
const next = process.argv.includes('--patch') ? `${major}.${minor}.${patch + 1}` : `${major}.${minor + 1}.0`;
console.log(`Extension version ${json.version} → ${next}`);
json.version = next;
writeJson(file, json);
