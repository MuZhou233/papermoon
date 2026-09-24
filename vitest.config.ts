import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: { alias: [
    {find: /^@papermoon\/writers$/, replacement: fileURLToPath(new URL('./plugins/writers/src/model.ts', import.meta.url))},
    {find: /^@papermoon\/playbook-compiler$/, replacement: fileURLToPath(new URL("./plugins/playbook-compiler/src/index.ts", import.meta.url))},
    {find: /^@papermoon\/playbook-compiler\/(.*)$/, replacement: fileURLToPath(new URL("./plugins/playbook-compiler/src/", import.meta.url)) + "$1.ts"},
    {find: "@papermoon/playbook-tools/catalog", replacement: fileURLToPath(new URL("./plugins/playbook-tools/src/catalog.ts", import.meta.url))},
    {find: /^@papermoon\/playbook-tools$/, replacement: fileURLToPath(new URL("./plugins/playbook-tools/src/index.ts", import.meta.url))},
    {find: /^@papermoon\/playbook-core$/, replacement: fileURLToPath(new URL('./plugins/playbook-core/src/index.ts', import.meta.url))},
    {find: '@papermoon/playbook-core/repository', replacement: fileURLToPath(new URL('./plugins/playbook-core/src/repository.ts', import.meta.url))},
    {find: '@papermoon/ui', replacement: fileURLToPath(new URL('./packages/ui/src/index.ts', import.meta.url))},
    { find: '@papermoon/playbook-storage/value', replacement: fileURLToPath(new URL('./plugins/playbook-storage/src/value.ts', import.meta.url)) },
    { find: /^@papermoon\/playbook-storage$/, replacement: fileURLToPath(new URL('./plugins/playbook-storage/src/index.ts', import.meta.url)) },
  ] },
  test: {
    include: ['tooling/tests/**/*.spec.ts', 'plugins/*/tests/**/*.spec.ts', 'plugins/*/tests/**/*.spec.tsx', 'packages/*/tests/**/*.spec.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
})
