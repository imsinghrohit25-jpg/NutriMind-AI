import { defineConfig, configDefaults } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    setupFiles: ['./vitest.setup.ts'],
    // Vitest 4 shrank its own default exclude to just node_modules/.git — explicitly re-exclude
    // dist/** so a local `tsc build` output (gitignored, never committed) is never picked up as
    // a duplicate set of test files.
    exclude: [...configDefaults.exclude, '**/dist/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'lcov'],
      exclude: ['dist/**', '**/__tests__/**', 'vitest.config.ts'],
    },
    testTimeout: 10_000,
  },
  resolve: {
    alias: {
      '@nutrimind/shared': new URL('../../packages/shared/src/index.ts', import.meta.url).pathname,
    },
  },
});
