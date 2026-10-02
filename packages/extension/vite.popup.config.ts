import { defineConfig } from 'vite';
// @ts-expect-error plain JS helper shared with the other build scripts
import { readProduct } from '../../tools/product.mjs';
import { copyFileSync, cpSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    lib: {
      entry: 'src/popup/popup.ts',
      formats: ['iife'],
      name: 'TSAPopup',
      fileName: () => 'popup.js',
    },
  },
  plugins: [
    {
      // Runs last in the build sequence — copies the remaining static files the manifest/popup
      // reference directly, once all three JS bundles already exist in dist/.
      name: 'copy-extension-static-files',
      closeBundle() {
        // Firefox is the primary target (FR3.1) — dist/manifest.json is the Firefox manifest.
        // The Chrome variant (FR8, best-effort) is a separate opt-in step: `npm run build:chrome`.
        // Single sources: name and summary from the repo's product.json, version from this
        // package's package.json. manifest.json carries neither.
        const product = readProduct();
        const { version } = JSON.parse(readFileSync(path.resolve(__dirname, 'package.json'), 'utf8'));
        const manifest = JSON.parse(readFileSync(path.resolve(__dirname, 'manifest.json'), 'utf8'));
        const full = {
          manifest_version: manifest.manifest_version,
          name: product.name,
          version,
          description: product.summary,
          homepage_url: product.homepage,
          ...manifest,
        };
        writeFileSync(path.resolve(__dirname, 'dist/manifest.json'), `${JSON.stringify(full, null, 2)}\n`);
        copyFileSync(
          path.resolve(__dirname, 'src/popup/popup.html'),
          path.resolve(__dirname, 'dist/popup.html'),
        );
        copyFileSync(
          path.resolve(__dirname, 'src/options/options.html'),
          path.resolve(__dirname, 'dist/options.html'),
        );
        cpSync(path.resolve(__dirname, 'icons'), path.resolve(__dirname, 'dist/icons'), {
          recursive: true,
          filter: (src) => !src.endsWith('.svg'),
        });
      },
    },
  ],
});
