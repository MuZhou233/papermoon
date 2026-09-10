import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tooling/tests/**/*.spec.ts', 'plugins/*/tests/**/*.spec.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
})
