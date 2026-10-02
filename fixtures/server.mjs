import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { FIXTURE_PORT as PRIMARY_PORT, FIXTURE_SECONDARY_PORT as SECONDARY_PORT, USERSCRIPT_DIST } from '../tools/paths.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

/** Serves `rel` from inside `base`, refusing paths that escape it. */
function serveFile(res, base, rel) {
  let filePath = path.join(base, rel);
  if (rel.endsWith('/')) filePath = path.join(filePath, 'index.html');
  if (!filePath.startsWith(base)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] ?? 'application/octet-stream' });
    res.end(data);
  });
}

// Two listeners on different ports = two different origins (scheme+host+port all have to
// match for same-origin), which is what the iframe-cross-origin fixture needs: its parent is
// served from PRIMARY_PORT and its child iframe points at SECONDARY_PORT.
function createServer() {
  return http.createServer((req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
    // Built bundles (e.g. the userscript/embed) for tests that load them via a real <script src>.
    if (urlPath.startsWith('/__bundles/')) {
      serveFile(res, USERSCRIPT_DIST, urlPath.slice('/__bundles/'.length));
      return;
    }
    serveFile(res, ROOT, urlPath);
  });
}

export function startFixtureServers() {
  const primary = createServer();
  const secondary = createServer();
  return Promise.all([
    new Promise((resolve) => primary.listen(PRIMARY_PORT, '127.0.0.1', resolve)),
    new Promise((resolve) => secondary.listen(SECONDARY_PORT, '127.0.0.1', resolve)),
  ]).then(() => ({ primary, secondary, PRIMARY_PORT, SECONDARY_PORT }));
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  startFixtureServers().then(() => {
    console.log(`Fixtures serving on http://127.0.0.1:${PRIMARY_PORT}/ and http://127.0.0.1:${SECONDARY_PORT}/`);
  });
}
