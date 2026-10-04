import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from '../../tools/paths.js';

// addons.mozilla.org API credentials, from the repo's gitignored `private.env` or from the
// environment (e.g. CI secrets). Where to get them and what to call them is in the developer
// guide's "Publishing" section. Never print them.

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

/** The issuer and secret; exits with a hint if either is missing. */
export function amoCredentials() {
  const fileValues = readPrivateEnv();
  const issuer = process.env.AMO_JWT_ISSUER ?? fileValues.firefox_jwt_issuer;
  const secret = process.env.AMO_JWT_SECRET ?? fileValues.firefox_jwt_secret ?? fileValues.firefox_auth_key;
  const missing = [];
  if (!issuer) missing.push('JWT issuer (firefox_jwt_issuer / AMO_JWT_ISSUER)');
  if (!secret) missing.push('JWT secret (firefox_auth_key / AMO_JWT_SECRET)');
  if (missing.length > 0) {
    console.error(
      `Missing AMO credentials: ${missing.join(' and ')}.\n` +
        'Add them to private.env in the repo root, from https://addons.mozilla.org/developers/addon/api/key/',
    );
    process.exit(1);
  }
  return { issuer, secret };
}

/**
 * An `Authorization` header value for one AMO API request: a JWT signed with the secret (HS256),
 * valid for a minute, as https://addons-server.readthedocs.io/en/latest/topics/api/auth.html asks.
 */
export function amoAuthHeader({ issuer, secret }) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({
    iss: issuer,
    jti: crypto.randomUUID(),
    iat: now,
    exp: now + 60,
  })}`;
  const signature = crypto.createHmac('sha256', secret).update(unsigned).digest('base64url');
  return `JWT ${unsigned}.${signature}`;
}
