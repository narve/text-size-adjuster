import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { EXTENSION_DIR } from './paths.js';

// web-ext's command-line entry point, in whichever node_modules the extension workspace resolves
// it from (its package.json only exports the library, so the path is built from that).
const requireFromExtension = createRequire(path.join(EXTENSION_DIR, 'package.json'));
const WEB_EXT_CLI = path.join(path.dirname(requireFromExtension.resolve('web-ext')), 'bin', 'web-ext.js');

/**
 * Runs the repo's own `web-ext` from the extension workspace. Started with Node directly rather
 * than through `npx`: on Windows `npx` is a .cmd file, which `execFileSync` can't start without a
 * shell.
 */
export function runWebExt(args, options = {}) {
  return execFileSync(process.execPath, [WEB_EXT_CLI, ...args], { cwd: EXTENSION_DIR, ...options });
}
