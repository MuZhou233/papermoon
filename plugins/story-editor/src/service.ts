/** Editor operations expose authored content, never compile or approve it. */
import type { StoryRepository } from '@papermoon/story-core/repository'
import { StoryError } from '@papermoon/story-core'
import { StorageError } from '@papermoon/story-storage'
import { schemas, type Input, type Method } from './protocol.ts'
import { snapshotDTO, toDTO, recordDTO } from './wire.ts'
export function handlers(repository: StoryRepository) {
  return {
    catalog: (p: Input<'catalog'>) => repository.queryScripts(p),
    projects: (p: Input<'projects'>) => repository.listProjects(p),
    createProject: (p: Input<'createProject'>) => repository.createProject(p),
    renameProject: (p: Input<'renameProject'>) =>
      repository.updateProject(p.projectId, { name: p.name }),
    deleteProject: (p: Input<'deleteProject'>) => {
      repository.deleteProject(p.projectId)
      return null
    },
    createScript: (p: Input<'createScript'>) => repository.createScript(p),
    renameScript: (p: Input<'renameScript'>) =>
      repository.updateScript(p.scriptId, { name: p.name }),
    deleteScript: (p: Input<'deleteScript'>) => {
      repository.deleteScript(p.scriptId)
      return null
    },
    script: (p: Input<'script'>) => {
      const script = repository.getScript(p.scriptId)
      return { script, project: repository.getProject(script.projectId) }
    },
    snapshot: (p: Input<'snapshot'>) =>
      snapshotDTO(repository.readSnapshot(p.ref)),
    save: (p: Input<'save'>) => snapshotDTO(repository.editDraft(p)),
    commit: (p: Input<'commit'>) => {
      const result = repository.commitRevision(p)
      return { ...result, content: toDTO(result.content) }
    },
    revision: (p: Input<'revision'>) => ({
      entry: repository.getHistoryEntry(p.scriptId, p.revisionId),
      snapshot: snapshotDTO(
        repository.readSnapshot({ kind: 'revision', revisionId: p.revisionId }),
      ),
    }),
    history: (p: Input<'history'>) =>
      repository.listRevisions(p.scriptId, { ...p, descending: true }),
    restore: (p: Input<'restore'>) => snapshotDTO(repository.restoreDraft(p)),
    copy: (p: Input<'copy'>) =>
      repository.copyScript({ ...p, publications: 'none' }),
    compare: (p: Input<'compare'>) => {
      const page = repository.compare(p.left, p.right, {
        ...p,
        after: p.after as
          | import('@papermoon/story-core').ComparisonCursor
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
  [M in Method]: ReturnType<ReturnType<typeof handlers>[M]>
}
export type RpcResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: { code: string; message: string; details: object } }
export function dispatcher(
  repository: StoryRepository,
  onError: (error: unknown) => void,
) {
  const run = handlers(repository)
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
      const call = run[method] as (input: typeof parsed.data) => unknown
      return { ok: true, value: call(parsed.data) }
    } catch (error) {
      if (error instanceof StoryError || error instanceof StorageError)
        return {
          ok: false,
          error: {
            code: error.code,
            message: error.message,
            details:
              error instanceof StoryError ? { location: error.location } : {},
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
