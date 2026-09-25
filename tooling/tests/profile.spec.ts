import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { expect, it } from 'vitest'
import { preparePaperMoonProfile } from '../repository/profile.ts'

it('uses native bundle selection and retains disabled Story Mode on subsequent launches', () => {
  const home = mkdtempSync(join(tmpdir(), 'paper-profile-'))
  try {
    preparePaperMoonProfile(resolve('.'), home)
    const path = join(home, 'profiles/papermoon/package.json')
    const manifest = JSON.parse(readFileSync(path, 'utf8'))
    expect(manifest.dsh.profile.bundles).toContain('@papermoon/story-mode')
    manifest.dsh.profile.bundles = manifest.dsh.profile.bundles.filter((name: string) => name !== '@papermoon/story-mode')
    writeFileSync(path, JSON.stringify(manifest))
    preparePaperMoonProfile(resolve('.'), home)
    expect(JSON.parse(readFileSync(path, 'utf8')).dsh.profile.bundles).not.toContain('@papermoon/story-mode')
    expect(JSON.parse(readFileSync(path, 'utf8')).dependencies).toHaveProperty('@papermoon/story-mode')
  } finally { rmSync(home, { recursive: true, force: true }) }
})
