/** One target provider serves every PaperMoon playbook session purpose. */
import { isAbsolute } from 'node:path'
import type { PlaybookId } from '@papermoon/playbook-core'
import type { PlaybookRepository } from '@papermoon/playbook-core/repository'
import type { Host, SessionLog, Workspace } from './host.ts'
export const TARGET_PROVIDER = 'papermoon-playbook'
export const name = 'papermoon-playbook-workspaces'
export const inject = ['papermoonPlaybookCore', 'workspaceRegistry', 'sessionController', 'agents']
export class PlaybookWorkspaces {
  private readonly consumers = new Map<string, (session: SessionLog) => string | undefined>()
  constructor(private readonly host: Host, private readonly core: PlaybookRepository, readonly cwd: string) {}
  register(name: string, target: (session: SessionLog) => string | undefined) {
    if (this.consumers.has(name)) throw new Error('playbook workspace consumer already registered: ' + name)
    this.consumers.set(name, target)
    return () => { this.consumers.delete(name) }
  }
  async accepts(key: string, sessionId: string) {
    const live = this.host.agents.get(sessionId), saved = live ? undefined : await this.host.sessionController.inspect(sessionId)
    const session = live?.session ?? { header: saved!.meta, snapshotEvents: () => saved!.events }
    return [...this.consumers.values()].some(target => target(session) === key)
  }
  target(playbookId: string) { return this.core.getPlaybook(playbookId as PlaybookId) }
  async playbooks() {
    const rows: { playbookId: string; playbookName: string; projectName: string; projectId: string }[] = []
    let after: string | undefined
    do {
      const page = this.core.queryPlaybooks({ limit: 1000, ...(after ? { after } : {}) })
      rows.push(...page.items.map(playbook => ({ playbookId: playbook.id, playbookName: playbook.name, projectName: playbook.projectName, projectId: playbook.projectId })))
      after = page.next
    } while (after)
    return rows
  }
  async refreshTitle(workspace: Workspace) {
    if (workspace.target?.provider !== TARGET_PROVIDER) return
    let playbook
    try { playbook = this.target(workspace.target.key) }
    catch (error) { if (error && typeof error === 'object' && 'code' in error && error.code === 'not-found') return; throw error }
    if (workspace.title !== playbook.name) await workspace.setTitle(playbook.name)
  }
  async workspace(playbookId: string) {
    this.target(playbookId)
    const workspace = await this.host.workspaceRegistry.createResource({ provider: TARGET_PROVIDER, key: playbookId })
    await this.refreshTitle(workspace)
    return workspace
  }
}
export async function apply(ctx: Host, config: { cwd: string }) {
  if (!isAbsolute(config.cwd)) throw new Error('playbook workspace cwd must be absolute')
  const service = new PlaybookWorkspaces(ctx, ctx.get('papermoonPlaybookCore') as PlaybookRepository, config.cwd)
  ctx.effect(function* () {
    yield ctx.provide('papermoonPlaybookWorkspaces', service)
    yield ctx.workspaceRegistry.registerResourceProvider(TARGET_PROVIDER, {
      async resolve(key) {
        try { return { title: service.target(key).name, cwd: config.cwd } }
        catch (error) { if (error && typeof error === 'object' && 'code' in error && error.code === 'not-found') return undefined; throw error }
      },
      accepts: (key, sessionId) => service.accepts(key, sessionId),
    })
  }, 'papermoon.playbook-workspaces')
  for (const workspace of ctx.workspaceRegistry.list()) await service.refreshTitle(workspace)
}
