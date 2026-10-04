import fs from 'node:fs';
import path from 'node:path';
import { EXTENSION_ARTIFACTS, EXTENSION_DIR, readJson } from '../../tools/paths.js';
import { amoAuthHeader, amoCredentials } from './amo-credentials.js';

// Uploads the store screenshots from amo-screenshots.js (web-ext-artifacts/amo-screenshots/) to
// the add-on's listing on addons.mozilla.org, with their captions, in file-name order. web-ext
// can't do this; the AMO API's preview endpoints can. Refuses if the listing already has
// screenshots, unless run with --replace, which deletes those first.

const API = 'https://addons.mozilla.org/api/v5/addons/addon';
const DIR = path.join(EXTENSION_ARTIFACTS, 'amo-screenshots');
const credentials = amoCredentials();
const { browser_specific_settings: settings } = readJson(path.join(EXTENSION_DIR, 'manifest.json'));
const addon = `${API}/${encodeURIComponent(settings.gecko.id)}`;

async function call(method, url, body) {
  const headers = { Authorization: amoAuthHeader(credentials) };
  if (body !== undefined && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const response = await fetch(url, {
    method,
    headers,
    body: body === undefined || body instanceof FormData ? body : JSON.stringify(body),
  });
  // AMO throttles bursts of requests; wait as long as it says (in Retry-After, or in the body as
  // "Expected available in N seconds."), then try again.
  if (response.status === 429) {
    const inBody = /available in (\d+) second/.exec(await response.text())?.[1];
    const seconds = Number(response.headers.get('retry-after')) || Number(inBody) || 30;
    console.log(`Throttled by AMO, waiting ${seconds} s...`);
    await new Promise((resolve) => setTimeout(resolve, (seconds + 1) * 1000));
    return call(method, url, body);
  }
  if (!response.ok) throw new Error(`${method} ${url}: ${response.status} ${await response.text()}`);
  return response.status === 204 ? null : response.json();
}

const captions = readJson(path.join(DIR, 'captions.json'));
const files = Object.keys(captions).sort();

const { previews } = await call('GET', `${addon}/`);
if (previews.length > 0) {
  if (!process.argv.includes('--replace')) {
    console.error(`The listing already has ${previews.length} screenshot(s). Run with --replace to delete them first.`);
    process.exit(1);
  }
  for (const preview of previews) await call('DELETE', `${addon}/previews/${preview.id}/`);
  console.log(`Deleted ${previews.length} existing screenshot(s).`);
}

for (const [position, file] of files.entries()) {
  const form = new FormData();
  form.set('image', new Blob([fs.readFileSync(path.join(DIR, file))], { type: 'image/png' }), file);
  form.set('position', String(position));
  const preview = await call('POST', `${addon}/previews/`, form);
  // A caption can't be sent with the image, only set afterwards.
  await call('PATCH', `${addon}/previews/${preview.id}/`, { caption: { 'en-US': captions[file] } });
  console.log(`Uploaded ${file}`);
}
