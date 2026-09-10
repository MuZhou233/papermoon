/** Explicit read-only gates and a separate bilingual recording operation. */
import { resolve } from 'node:path'
import { checkDocs } from './docs.ts'
import { checkNotes } from './notes.ts'
import { recordPair } from './pairing.ts'

export async function main(args: string[], root = process.cwd()): Promise<void> {
  const [command, ...rest] = args
  if (command === 'record') {
    if (!rest.length) throw new Error('usage: pnpm docs:record <English.md> [...]')
    for (const path of rest) recordPair(root, path)
    return
  }
  if (rest.length) throw new Error('check commands take no positional arguments; use PAPERMOON_ARCHIVE_BASE_REF for a trusted Git baseline')
  const errors = command === 'docs' ? await checkDocs(root)
    : command === 'notes' ? checkNotes(root, process.env.PAPERMOON_ARCHIVE_BASE_REF)
    : (() => { throw new Error('usage: check <docs|notes|record>') })()
  if (errors.length) throw new Error(errors.join('\n'))
  console.log(`PaperMoon ${command}: passed`)
}

if (process.argv[1] && import.meta.filename === resolve(process.argv[1])) {
  main(process.argv.slice(2)).catch(error => { console.error(String(error)); process.exitCode = 1 })
}
