import path from 'node:path';
import { EXTENSION_DIR, readJson, writeJson } from '../../tools/paths.js';

// Bumps the extension's minor version (x.Y.z → x.(Y+1).0). package.json is the single source of the
// version; the build injects it into the manifest. Run before signing: Mozilla signs each version
// number only once.

const file = path.join(EXTENSION_DIR, 'package.json');
const json = readJson(file);
const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(json.version);
if (!match) {
  console.error(`Can't bump: "${json.version}" isn't a plain major.minor.patch version.`);
  process.exit(1);
}
const next = `${match[1]}.${Number(match[2]) + 1}.0`;
console.log(`Extension version ${json.version} → ${next}`);
json.version = next;
writeJson(file, json);
