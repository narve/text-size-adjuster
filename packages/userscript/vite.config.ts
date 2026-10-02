import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import monkey from 'vite-plugin-monkey';

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
        name: 'Text Size Adjuster',
        namespace: 'https://github.com/narve/text-size-adjuster',
        description:
          'Ad-hoc, per-page text scaling that preserves size ratios instead of zooming the whole layout.',
        license: 'MIT',
        icon,
        match: ['*://*/*'],
        grant: ['GM.getValue', 'GM.setValue', 'GM_registerMenuCommand'],
        'run-at': 'document-idle',
      },
    }),
  ],
});
