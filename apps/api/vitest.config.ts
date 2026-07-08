import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    setupFiles: ['./vitest.setup.ts'],
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
