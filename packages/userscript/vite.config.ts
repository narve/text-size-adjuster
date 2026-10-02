import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
// @ts-expect-error plain JS helper shared with the other build scripts
import { readProduct } from '../../tools/product.js';
import monkey from 'vite-plugin-monkey';
// @ts-expect-error plain JS helper shared with the other build scripts
import { USERSCRIPT_FILENAME } from '../../tools/paths.js';

const product = readProduct();
const iconSvg = readFileSync(new URL('../extension/icons/icon.svg', import.meta.url), 'utf8');
const icon = `data:image/svg+xml;base64,${Buffer.from(iconSvg).toString('base64')}`;

export default defineConfig({
  plugins: [
    monkey({
      entry: 'src/main.ts',
      build: {
        fileName: USERSCRIPT_FILENAME,
      },
      userscript: {
        name: product.name,
        namespace: product.repository,
        version: product.version,
        description: product.summary,
        homepageURL: product.homepage,
        license: product.license,
        icon,
        match: ['*://*/*'],
        grant: ['GM.getValue', 'GM.setValue', 'GM_registerMenuCommand'],
        'run-at': 'document-idle',
        // The control belongs on the page, not inside every ad, video or comments frame on it.
        // Same-origin frames are still scaled, from the top page's engine (FR6.1).
        noframes: true,
      },
    }),
  ],
});
