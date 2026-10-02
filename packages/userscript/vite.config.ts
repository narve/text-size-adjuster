import { defineConfig } from 'vite';
import monkey from 'vite-plugin-monkey';

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
        match: ['*://*/*'],
        grant: ['GM.getValue', 'GM.setValue', 'GM_registerMenuCommand'],
        'run-at': 'document-idle',
      },
    }),
  ],
});
