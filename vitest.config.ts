import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: { alias: [
    { find: '@papermoon/story-storage/value', replacement: fileURLToPath(new URL('./plugins/story-storage/src/value.ts', import.meta.url)) },
    { find: /^@papermoon\/story-storage$/, replacement: fileURLToPath(new URL('./plugins/story-storage/src/index.ts', import.meta.url)) },
  ] },
  test: {
    include: ['tooling/tests/**/*.spec.ts', 'plugins/*/tests/**/*.spec.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
})
