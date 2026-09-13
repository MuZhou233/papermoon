import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: { alias: [
    {find: /^@papermoon\/story-compiler$/, replacement: fileURLToPath(new URL("./plugins/story-compiler/src/index.ts", import.meta.url))},
    {find: /^@papermoon\/story-compiler\/(.*)$/, replacement: fileURLToPath(new URL("./plugins/story-compiler/src/", import.meta.url)) + "$1.ts"},
    {find: "@papermoon/story-tools/catalog", replacement: fileURLToPath(new URL("./plugins/story-tools/src/catalog.ts", import.meta.url))},
    {find: /^@papermoon\/story-tools$/, replacement: fileURLToPath(new URL("./plugins/story-tools/src/index.ts", import.meta.url))},
    {find: /^@papermoon\/story-core$/, replacement: fileURLToPath(new URL('./plugins/story-core/src/index.ts', import.meta.url))},
    {find: '@papermoon/story-core/repository', replacement: fileURLToPath(new URL('./plugins/story-core/src/repository.ts', import.meta.url))},
    {find: '@papermoon/ui', replacement: fileURLToPath(new URL('./packages/ui/src/index.ts', import.meta.url))},
    { find: '@papermoon/story-storage/value', replacement: fileURLToPath(new URL('./plugins/story-storage/src/value.ts', import.meta.url)) },
    { find: /^@papermoon\/story-storage$/, replacement: fileURLToPath(new URL('./plugins/story-storage/src/index.ts', import.meta.url)) },
  ] },
  test: {
    include: ['tooling/tests/**/*.spec.ts', 'plugins/*/tests/**/*.spec.ts', 'plugins/*/tests/**/*.spec.tsx', 'packages/*/tests/**/*.spec.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
})
