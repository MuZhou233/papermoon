/** One target provider serves every PaperMoon script session purpose. */
import { isAbsolute } from 'node:path'
import type { ScriptId } from '@papermoon/story-core'
import type { StoryRepository } from '@papermoon/story-core/repository'
import type { Host, SessionLog, Workspace } from './host.ts'
export const TARGET_PROVIDER = 'papermoon-script'
export const name = 'papermoon-story-workspaces'
export const inject = ['papermoonStoryCore', 'workspaceRegistry', 'sessionController', 'agents']
export class StoryWorkspaces {
  private readonly consumers = new Map<string, (session: SessionLog) => string | undefined>()
  constructor(private readonly host: Host, private readonly core: StoryRepository, readonly cwd: string) {}
  register(name: string, target: (session: SessionLog) => string | undefined) {
    if (this.consumers.has(name)) throw new Error('script workspace consumer already registered: ' + name)
    this.consumers.set(name, target)
    return () => { this.consumers.delete(name) }
  }
  async accepts(key: string, sessionId: string) {
    const live = this.host.agents.get(sessionId), saved = live ? undefined : await this.host.sessionController.inspect(sessionId)
    const session = live?.session ?? { header: saved!.meta, snapshotEvents: () => saved!.events }
    return [...this.consumers.values()].some(target => target(session) === key)
  }
  target(scriptId: string) { return this.core.getScript(scriptId as ScriptId) }
  async scripts() {
    const rows: { scriptId: string; scriptName: string; projectName: string; projectId: string }[] = []
    let after: string | undefined
    do {
      const page = this.core.queryScripts({ limit: 1000, ...(after ? { after } : {}) })
      rows.push(...page.items.map(script => ({ scriptId: script.id, scriptName: script.name, projectName: script.projectName, projectId: script.projectId })))
      after = page.next
    } while (after)
    return rows
  }
  async refreshTitle(workspace: Workspace) {
    if (workspace.target?.provider !== TARGET_PROVIDER) return
    let script
    try { script = this.target(workspace.target.key) }
    catch (error) { if (error && typeof error === 'object' && 'code' in error && error.code === 'not-found') return; throw error }
    if (workspace.title !== script.name) await workspace.setTitle(script.name)
  }
  async workspace(scriptId: string) {
    this.target(scriptId)
    const workspace = await this.host.workspaceRegistry.createResource({ provider: TARGET_PROVIDER, key: scriptId })
    await this.refreshTitle(workspace)
    return workspace
  }
}
export async function apply(ctx: Host, config: { cwd: string }) {
  if (!isAbsolute(config.cwd)) throw new Error('script workspace cwd must be absolute')
  const service = new StoryWorkspaces(ctx, ctx.get('papermoonStoryCore') as StoryRepository, config.cwd)
  ctx.effect(function* () {
    yield ctx.provide('papermoonStoryWorkspaces', service)
    yield ctx.workspaceRegistry.registerResourceProvider(TARGET_PROVIDER, {
      async resolve(key) {
        try { return { title: service.target(key).name, cwd: config.cwd } }
        catch (error) { if (error && typeof error === 'object' && 'code' in error && error.code === 'not-found') return undefined; throw error }
      },
      accepts: (key, sessionId) => service.accepts(key, sessionId),
    })
  }, 'papermoon.script-workspaces')
  for (const workspace of ctx.workspaceRegistry.list()) await service.refreshTitle(workspace)
}
