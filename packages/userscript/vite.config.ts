import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
// @ts-expect-error plain JS helper shared with the other build scripts
import { readProduct } from '../../tools/product.mjs';
import monkey from 'vite-plugin-monkey';

const product = readProduct();
const iconSvg = readFileSync(new URL('../extension/icons/icon.svg', import.meta.url), 'utf8');
const icon = `data:image/svg+xml;base64,${Buffer.from(iconSvg).toString('base64')}`;

export default defineConfig({
  plugins: [
    monkey({
      entry: 'src/main.ts',
      build: {
        fileName: 'text-size-adjuster.user.js',
      },
      userscript: {
        name: product.name,
        namespace: 'https://github.com/narve/text-size-adjuster',
        description: product.summary,
        homepageURL: product.homepage,
        license: 'MIT',
        icon,
        match: ['*://*/*'],
        grant: ['GM.getValue', 'GM.setValue', 'GM_registerMenuCommand'],
        'run-at': 'document-idle',
      },
    }),
  ],
});
