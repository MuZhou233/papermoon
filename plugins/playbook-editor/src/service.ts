/** Authenticated editor operations keep saves, commits and explicit compilation separate. */
import type { PlaybookRepository } from '@papermoon/playbook-core/repository'
import type { CompilationService } from '@papermoon/playbook-compiler/service'
import { RevisionArtifacts } from '@papermoon/playbook-compiler/revisions'
import { ArtifactError } from '@papermoon/playbook-compiler/runtime'
import { PlaybookError } from '@papermoon/playbook-core'
import { StorageError } from '@papermoon/playbook-storage'
import { schemas, type Input, type Method } from './protocol.ts'
import { snapshotDTO, recordDTO } from './wire.ts'
export function handlers(repository: PlaybookRepository, compiler?: CompilationService) {
  const compilation = () => { if (!compiler) throw new ArtifactError('unavailable', 'compiler service is not installed'); return compiler }
  const frozen = new RevisionArtifacts(repository)
  return {
    revisionCompilation: (p: Input<'revisionCompilation'>) => frozen.describe(p.playbookId, p.revisionId),
    revisionArtifact: (p: Input<'revisionArtifact'>) => ({ artifact: frozen.read(p.playbookId, p.revisionId, p.key), context: frozen.preview(p.playbookId, p.revisionId, p.key) }),
    compile: (p: Input<'compile'>, signal?: AbortSignal) => compilation().compile({ playbookId: p.playbookId, ref: p.ref }, { ...(p.entry === undefined ? {} : { entry: p.entry }), ...(p.language === undefined ? {} : { language: p.language }) }, signal),
    compiled: (p: Input<'compiled'>) => compilation().find({ playbookId: p.playbookId, ref: p.ref }, { ...(p.entry === undefined ? {} : { entry: p.entry }), ...(p.language === undefined ? {} : { language: p.language }) }),
    catalog: (p: Input<'catalog'>) => repository.queryPlaybooks(p),
    projects: (p: Input<'projects'>) => repository.listProjects(p),
    createProject: (p: Input<'createProject'>) => repository.createProject(p),
    renameProject: (p: Input<'renameProject'>) =>
      repository.updateProject(p.projectId, { name: p.name }),
    deleteProject: (p: Input<'deleteProject'>) => {
      repository.deleteProject(p.projectId)
      return null
    },
    createPlaybook: (p: Input<'createPlaybook'>) => repository.createPlaybook(p),
    renamePlaybook: (p: Input<'renamePlaybook'>) =>
      repository.updateScript(p.playbookId, { name: p.name }),
    deletePlaybook: (p: Input<'deletePlaybook'>) => {
      repository.deletePlaybook(p.playbookId)
      return null
    },
    playbook: (p: Input<'playbook'>) => {
      const playbook = repository.getPlaybook(p.playbookId)
      return { playbook, project: repository.getProject(playbook.projectId) }
    },
    snapshot: (p: Input<'snapshot'>) =>
      snapshotDTO(repository.readSnapshot(p.ref)),
    save: (p: Input<'save'>) => snapshotDTO(repository.editDraft(p)),
    commit: (p: Input<'commit'>, signal?: AbortSignal) => compilation().submit(p, signal),
    revision: (p: Input<'revision'>) => ({
      entry: repository.getHistoryEntry(p.playbookId, p.revisionId),
      snapshot: snapshotDTO(
        repository.readSnapshot({ kind: 'revision', revisionId: p.revisionId }),
      ),
    }),
    history: (p: Input<'history'>) =>
      repository.listRevisions(p.playbookId, { ...p, descending: true }),
    restore: (p: Input<'restore'>) => snapshotDTO(repository.restoreDraft(p)),
    copy: (p: Input<'copy'>) =>
      repository.copyPlaybook({ ...p, publications: 'none' }),
    compare: (p: Input<'compare'>) => {
      const page = repository.compare(p.left, p.right, {
        ...p,
        after: p.after as
          | import('@papermoon/playbook-core').ComparisonCursor
          | undefined,
      })
      return {
        ...page,
        items: page.items.map((item) => ({
          ...item,
          before: recordDTO(item.before),
          after: recordDTO(item.after),
        })),
      }
    },
  }
}
export type Results = {
  [M in Method]: Awaited<ReturnType<ReturnType<typeof handlers>[M]>>
}
export type RpcResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: { code: string; message: string; details: object } }
export function dispatcher(
  repository: PlaybookRepository,
  onError: (error: unknown) => void,
  compiler?: CompilationService,
) {
  const run = handlers(repository, compiler)
  return async (
    endpoint: string,
    payload: unknown,
    signal: AbortSignal,
  ): Promise<RpcResult<unknown>> => {
    if (signal.aborted)
      return {
        ok: false,
        error: { code: 'cancelled', message: 'request cancelled', details: {} },
      }
    if (!Object.hasOwn(schemas, endpoint))
      return {
        ok: false,
        error: {
          code: 'not-found',
          message: 'unknown editor operation',
          details: {},
        },
      }
    const method = endpoint as Method,
      parsed = schemas[method].safeParse(payload)
    if (!parsed.success)
      return {
        ok: false,
        error: {
          code: 'invalid-input',
          message: 'invalid editor request',
          details: {
            issues: parsed.error.issues.map((i) => ({
              path: i.path.map(String),
              message: i.message,
            })),
          },
        },
      }
    try {
      // The key and validated input come from the same closed schema table.
      const call = run[method] as (input: typeof parsed.data, signal: AbortSignal) => unknown
      return { ok: true, value: await call(parsed.data, signal) }
    } catch (error) {
      if (error instanceof PlaybookError || error instanceof StorageError || error instanceof ArtifactError)
        return {
          ok: false,
          error: {
            code: error.code,
            message: error.message,
            details:
              error instanceof PlaybookError ? { location: error.location } : {},
          },
        }
      onError(error)
      return {
        ok: false,
        error: {
          code: 'internal',
          message: 'editor operation failed',
          details: {},
        },
      }
    }
  }
}
