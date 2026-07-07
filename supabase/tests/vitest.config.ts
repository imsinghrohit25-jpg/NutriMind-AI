import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 30_000,
    // Sequential: RLS tests create/clean up auth users; parallel runs collide
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
  },
});
