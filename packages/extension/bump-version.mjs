import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Bumps the extension's minor version (x.Y.z → x.(Y+1).0) in every file that carries it, so they
// stay in sync. Run before signing: Mozilla signs each version number only once.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILES = ['manifest.firefox.json', 'manifest.chrome.json', 'package.json'];

const current = JSON.parse(fs.readFileSync(path.join(__dirname, FILES[0]), 'utf8')).version;
const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(current);
if (!match) {
  console.error(`Can't bump: "${current}" in ${FILES[0]} isn't a plain major.minor.patch version.`);
  process.exit(1);
}
const next = `${match[1]}.${Number(match[2]) + 1}.0`;

for (const file of FILES) {
  const fullPath = path.join(__dirname, file);
  const json = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  if (json.version !== current) {
    console.error(`Can't bump: ${file} has version ${json.version}, expected ${current} — fix by hand first.`);
    process.exit(1);
  }
  json.version = next;
  fs.writeFileSync(fullPath, `${JSON.stringify(json, null, 2)}\n`, 'utf8');
}
console.log(`Extension version ${current} → ${next}`);
