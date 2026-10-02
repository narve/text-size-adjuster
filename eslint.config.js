// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/dist-chrome/**',
      '**/node_modules/**',
      'docs-site/dist/**',
      'e2e/screenshots/**',
      'e2e/test-results/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // Plain Node scripts (fixture/docs-site tooling) — not type-checked by tsc, so they need
    // their runtime globals declared explicitly for no-undef rather than relying on @types/node.
    // Also covers browser globals: some of these scripts (docs-site/build.mjs) pass inline
    // callbacks to Playwright's page.evaluate()/waitForFunction(), which execute in the browser,
    // not Node — textually still part of the same file, so ESLint needs both sets of globals.
    files: ['**/*.mjs', '**/*.cjs'],
    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        URL: 'readonly',
        fetch: 'readonly',
        document: 'readonly',
        window: 'readonly',
        getComputedStyle: 'readonly',
      },
    },
  },
);
