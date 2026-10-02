import { defineConfig, type Plugin } from 'vite';
// @ts-expect-error plain JS helper shared with the other build scripts
import { readProduct } from '../../tools/product.js';
import { EXTENSION_DIR, EXTENSION_DIST, readJson, writeJson } from '../../tools/paths.js';
import { cpSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

// One IIFE bundle per script, selected by `--mode` (see package.json "build"). Rollup's IIFE
// format doesn't support multiple inputs in one build (each output must be fully
// self-contained, no shared chunk), and that's what we want anyway: content script, background,
// options and popup run in genuinely separate contexts. The first entry empties dist/, the last
// copies the static files.
const ENTRIES = {
  content: { entry: 'src/content-script.ts', name: 'TSAContent', fileName: 'content.js' },
  background: { entry: 'src/background.ts', name: 'TSABackground', fileName: 'background.js' },
  options: { entry: 'src/options/options.ts', name: 'TSAOptions', fileName: 'options.js' },
  popup: { entry: 'src/popup/popup.ts', name: 'TSAPopup', fileName: 'popup.js' },
};
type EntryName = keyof typeof ENTRIES;
const ORDER = Object.keys(ENTRIES) as EntryName[];

/** HTML pages copied into dist/, with {{name}} replaced by the product name. */
const PAGES = ['src/popup/popup.html', 'src/options/options.html'];

function copyStaticFiles(): Plugin {
  return {
    name: 'copy-extension-static-files',
    closeBundle() {
      // Firefox is the primary target (FR3.1) — dist/manifest.json is the Firefox manifest.
      // The Chrome variant (FR8, best-effort) is a separate opt-in step: `npm run build:chrome`.
      // Single sources: name, summary and homepage from the repo's product.json, version from
      // this package's package.json. manifest.json carries none of them.
      const product = readProduct();
      const { version } = readJson(path.join(EXTENSION_DIR, 'package.json')) as { version: string };
      const manifest = readJson(path.join(EXTENSION_DIR, 'manifest.json')) as Record<
        string,
        unknown
      > & {
        action: Record<string, unknown>;
      };
      writeJson(path.join(EXTENSION_DIST, 'manifest.json'), {
        manifest_version: manifest.manifest_version,
        name: product.name,
        version,
        description: product.summary,
        homepage_url: product.homepage,
        ...manifest,
        action: { default_title: product.name, ...manifest.action },
      });
      for (const page of PAGES) {
        const html = readFileSync(path.join(EXTENSION_DIR, page), 'utf8').replaceAll(
          '{{name}}',
          product.name,
        );
        writeFileSync(path.join(EXTENSION_DIST, path.basename(page)), html);
      }
      cpSync(path.join(EXTENSION_DIR, 'icons'), path.join(EXTENSION_DIST, 'icons'), {
        recursive: true,
        filter: (src) => !src.endsWith('.svg'),
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  if (!(mode in ENTRIES)) {
    throw new Error(`Unknown build mode "${mode}"; expected one of: ${ORDER.join(', ')}.`);
  }
  const { entry, name, fileName } = ENTRIES[mode as EntryName];
  return {
    build: {
      outDir: 'dist',
      emptyOutDir: mode === ORDER[0],
      lib: { entry, formats: ['iife'], name, fileName: () => fileName },
    },
    plugins: mode === ORDER[ORDER.length - 1] ? [copyStaticFiles()] : [],
  };
});
