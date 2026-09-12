/** Temporary Web acceptance through the actual parent launcher; never calls a model. */
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { JSDOM } from 'jsdom'
import { repositoryRoot } from '../repository/cli.ts'

export async function smoke(root: string): Promise<void> {
  const temp = mkdtempSync(join(tmpdir(), 'papermoon-web-'))
  const child = spawn(process.execPath, ['--import', 'tsx/esm', 'tooling/repository/cli.ts', 'start-dsh', '--port', '0', '--no-open'], {
    cwd: root,
    env: { ...process.env, DSH_HOME: join(temp, 'dsh'), DSH_AGENTS_HOME: join(temp, 'agents') },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let output = ''
  let exited = false
  const done = new Promise<number | null>((resolveDone, reject) => {
    child.once('error', reject)
    child.once('close', code => { exited = true; resolveDone(code) })
  })
  // Observe rejection immediately while readiness is pending.
  void done.catch(() => {})
  child.stdout.on('data', data => { output += String(data) })
  child.stderr.on('data', data => { output += String(data) })
  let origin: string | undefined
  try {
    const deadline = Date.now() + 60_000
    let match: RegExpMatchArray | null = null
    while (!(match = output.match(/dsh web: (http:\/\/127\.0\.0\.1:\d+\/\?token=[^\s]+)/))) {
      if (exited || Date.now() >= deadline) throw new Error(`Web did not become ready:\n${output.replace(/token=[^\s]+/g, 'token=<redacted>').slice(-6000)}`)
      await new Promise(resolveWait => setTimeout(resolveWait, 25))
    }
    const address = new URL(match[1]!)
    origin = address.origin
    const exchange = await fetch(address, { redirect: 'manual', signal: AbortSignal.timeout(10_000) })
    assert.equal(exchange.status, 303)
    const cookie = exchange.headers.get('set-cookie')?.split(';')[0]
    assert.ok(cookie, 'authentication must issue a cookie')
    const response = await fetch(origin, { headers: { cookie }, signal: AbortSignal.timeout(10_000) })
    assert.equal(response.status, 200)
    const dom = new JSDOM(await response.text(), { url: origin })
    const script = dom.window.document.querySelector<HTMLScriptElement>('script[type="module"][src]')
    assert.ok(script, 'Web HTML must reference a built module')
    assert.equal(new URL(script.src).origin, origin)
    const asset = await fetch(script.src, { headers: { cookie }, signal: AbortSignal.timeout(10_000) })
    assert.equal(asset.status, 200)
    assert.ok((await asset.arrayBuffer()).byteLength > 0)
    assert.ok(existsSync(join(temp, 'dsh/profiles/web/package.json')), 'profile must be initialized in the temporary home')
    dom.window.close()
  } finally {
    if (!exited) child.kill('SIGTERM')
    const timeout = setTimeout(() => { if (!exited) child.kill('SIGKILL') }, 15_000)
    try { await done } finally { clearTimeout(timeout); rmSync(temp, { recursive: true, force: true }) }
  }
  assert.equal(await done, 0, 'normal termination must preserve the DSH exit status')
  if (origin) await assert.rejects(fetch(origin, { signal: AbortSignal.timeout(1500) }))
  console.log('PaperMoon Web smoke: authenticated HTML, built asset, isolated profile and shutdown passed')
}

if (process.argv[1] && import.meta.filename === resolve(process.argv[1])) {
  smoke(repositoryRoot).catch(error => { console.error(String(error)); process.exitCode = 1 })
}
