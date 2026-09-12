import { it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
it('owns its component copies and records their upstream source without requiring DSH', () => {
  const root = join(process.cwd(), 'packages/ui'),
    manifest = JSON.parse(readFileSync(join(root, 'provenance.json'), 'utf8'))
  expect(manifest.commit).toMatch(/^[a-f0-9]{40}$/)
  expect(existsSync(join(root, manifest.license))).toBe(true)
  for (const file of manifest.files) {
    expect(existsSync(join(root, file.path))).toBe(true)
    expect(file.sha256).toMatch(/^[a-f0-9]{64}$/)
    expect(file.adjustments.length).toBeGreaterThan(0)
  }
  function scan(path: string) {
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      const file = join(path, entry.name)
      if (entry.isDirectory()) scan(file)
      else if (/\.[jt]sx?$/.test(file))
        expect(readFileSync(file, 'utf8')).not.toMatch(
          /(?:from|import)\s*['"](?:@deepseek-ai\/dsh-client-ui|[^'"]*\/dsh\/)/,
        )
    }
  }
  scan(join(root, 'src'))
})
