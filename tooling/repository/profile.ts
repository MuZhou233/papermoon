/** Install local bundle links once; DSH owns subsequent enable/disable choices. */
import { existsSync, mkdirSync, readFileSync, realpathSync, symlinkSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

export function preparePaperMoonProfile(root: string, home: string): void {
  const directory = join(home, 'profiles/papermoon')
  mkdirSync(directory, { recursive: true })
  const bundles = {
    '@papermoon/extensions': join(root, 'profiles/papermoon'),
    '@papermoon/story-mode': join(root, 'plugins/story-mode'),
  }
  const path = join(directory, 'package.json')
  if (!existsSync(path)) writeFileSync(path, JSON.stringify({
    name: 'papermoon-profile', private: true,
    dependencies: Object.fromEntries(Object.entries(bundles).map(([name, path]) => [name, 'link:' + path])),
    dsh: { profile: { bundles: ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app', ...Object.keys(bundles)] } },
  }, null, 2) + '\n')
  // Parse before creating links: an invalid user manifest must fail without repair.
  JSON.parse(readFileSync(path, 'utf8'))
  for (const [name, source] of Object.entries(bundles)) {
    const link = join(directory, 'node_modules', name)
    if (existsSync(link)) {
      if (realpathSync(link) !== realpathSync(source)) throw new Error(`PaperMoon bundle link points elsewhere: ${link}`)
    } else { mkdirSync(dirname(link), { recursive: true }); symlinkSync(source, link, 'dir') }
  }
  const patch = join(directory, 'cordis.patch.yml')
  if (!existsSync(patch)) writeFileSync(patch, '[]\n')
  const workspace = join(directory, 'pnpm-workspace.yaml')
  if (!existsSync(workspace)) writeFileSync(workspace, 'packages: []\n')
}
