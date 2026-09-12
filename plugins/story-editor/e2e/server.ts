/** A test-owned Web instance with independent credentials and product data. */
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
export async function startEditorServer() {
  const directory = mkdtempSync(join(tmpdir(), 'papermoon-editor-'))
  const child = spawn(
    process.execPath,
    [
      '--import',
      'tsx/esm',
      'tooling/repository/cli.ts',
      'start',
      '--port',
      '0',
      '--no-open',
    ],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        DSH_HOME: join(directory, 'dsh'),
        DSH_AGENTS_HOME: join(directory, 'agents'),
        PAPERMOON_DATA_DIR: join(directory, 'data'),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )
  let output = '',
    exited = false
  const done = new Promise<void>((resolve, reject) => {
    child.once('error', reject)
    child.once('close', () => {
      exited = true
      resolve()
    })
  })
  void done.catch(() => {})
  child.stdout.on('data', (data) => {
    output += String(data)
  })
  child.stderr.on('data', (data) => {
    output += String(data)
  })
  const stop = async () => {
    if (!exited) child.kill('SIGTERM')
    const timer = setTimeout(() => {
      if (!exited) child.kill('SIGKILL')
    }, 15000)
    try {
      await done
    } finally {
      clearTimeout(timer)
      rmSync(directory, { recursive: true, force: true })
    }
  }
  try {
    const deadline = Date.now() + 60000
    while (true) {
      const match = output.match(
        /dsh web: (http:\/\/127\.0\.0\.1:\d+\/\?token=[^\s]+)/,
      )
      if (match)
        return {
          url: match[1]!,
          stop,
          logs: () => output.replace(/token=[^\s]+/g, 'token=<redacted>'),
        }
      if (exited || Date.now() > deadline)
        throw new Error(
          output.replace(/token=[^\s]+/g, 'token=<redacted>').slice(-9000),
        )
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
  } catch (error) {
    await stop()
    throw error
  }
}
