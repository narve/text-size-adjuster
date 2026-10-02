import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const BUNDLES = path.resolve(ROOT, '..', 'packages', 'userscript', 'dist');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

// Two listeners on different ports = two different origins (scheme+host+port all have to
// match for same-origin), which is what the iframe-cross-origin fixture needs: its parent is
// served from PRIMARY_PORT and its child iframe points at SECONDARY_PORT.
const PRIMARY_PORT = Number(process.env.TSA_FIXTURES_PORT ?? 4310);
const SECONDARY_PORT = Number(process.env.TSA_FIXTURES_SECONDARY_PORT ?? 4311);

function createServer() {
  return http.createServer((req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
    // Built bundles (e.g. the userscript/embed) for tests that load them via a real <script src>.
    if (urlPath.startsWith('/__bundles/')) {
      const bundlePath = path.join(BUNDLES, urlPath.slice('/__bundles/'.length));
      if (!bundlePath.startsWith(BUNDLES)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }
      fs.readFile(bundlePath, (err, data) => {
        if (err) {
          res.writeHead(404);
          res.end('Not found');
          return;
        }
        res.writeHead(200, { 'Content-Type': MIME['.js'] });
        res.end(data);
      });
      return;
    }
    let filePath = path.join(ROOT, urlPath);
    if (urlPath.endsWith('/')) filePath = path.join(filePath, 'index.html');
    if (!filePath.startsWith(ROOT)) {
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
      const ext = path.extname(filePath);
      res.writeHead(200, { 'Content-Type': MIME[ext] ?? 'application/octet-stream' });
      res.end(data);
    });
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
