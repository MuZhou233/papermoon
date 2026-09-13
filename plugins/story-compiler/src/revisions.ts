/** Read frozen revision outputs without importing the compiler or its Worker. */
import type { StoryRepository } from '@papermoon/story-core/repository'
import type { ScriptId, RevisionId } from '@papermoon/story-core'
import { ArtifactError, canonical, loadArtifact, initialize } from './runtime.ts'
import type { Diagnostic, Artifact } from './types.ts'
export interface RevisionCompilation {
  format: 'papermoon.compilation'
  version: 1
  status: 'success' | 'failed'
  sourceHash: string
  targets: { entry: string; language: string; diagnostics: Diagnostic[]; attachmentKey?: string }[]
}
function validDiagnostic(raw: unknown): raw is Diagnostic {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false
  const d = raw as Record<string, unknown>
  if (Object.keys(d).some(key => !['code', 'stage', 'message', 'location', 'chain'].includes(key)) || typeof d.code !== 'string' || typeof d.message !== 'string' || !['input', 'parse', 'load', 'evaluate', 'declaration', 'execution'].includes(String(d.stage))) return false
  if (d.chain !== undefined && (!Array.isArray(d.chain) || d.chain.some(item => typeof item !== 'string'))) return false
  if (d.location !== undefined) {
    if (!d.location || typeof d.location !== 'object' || Array.isArray(d.location)) return false
    for (const [key, value] of Object.entries(d.location)) {
      if (['line', 'column'].includes(key)) { if (!Number.isSafeInteger(value) || Number(value) < 1) return false }
      else if (!['path', 'field', 'key', 'language'].includes(key) || typeof value !== 'string') return false
    }
  }
  return true
}
export function revisionCompilation(repository: StoryRepository, scriptId: ScriptId, revisionId: RevisionId): RevisionCompilation | null {
  const revision = repository.getHistoryEntry(scriptId, revisionId).revision
  const raw = revision.attachments.metadata.compilation
  if (raw === undefined) return null
  const result = raw as unknown as RevisionCompilation
  if (!result || result.format !== 'papermoon.compilation' || result.version !== 1 ||
      !['success', 'failed'].includes(result.status) || !/^[a-f0-9]{64}$/.test(result.sourceHash) || !Array.isArray(result.targets) || !result.targets.length)
    throw new ArtifactError('invalid-artifact', 'invalid revision compilation manifest')
  const keys = new Set<string>()
  for (const [index, target] of result.targets.entries()) {
    if (!target || typeof target.entry !== 'string' || typeof target.language !== 'string' || !Array.isArray(target.diagnostics) || !target.diagnostics.every(validDiagnostic) || keys.has(JSON.stringify([target.entry, target.language])))
      throw new ArtifactError('invalid-artifact', 'invalid revision compilation target')
    keys.add(JSON.stringify([target.entry, target.language]))
    if (result.status === 'success' && (target.attachmentKey !== `opening/${index}` || revision.attachments.items[index]?.key !== target.attachmentKey))
      throw new ArtifactError('invalid-artifact', 'revision compilation attachment manifest is incomplete')
    if (result.status === 'failed' && target.attachmentKey !== undefined) throw new ArtifactError('invalid-artifact', 'failed compilation contains an artifact reference')
  }
  if (revision.attachments.items.length !== (result.status === 'success' ? result.targets.length : 0))
    throw new ArtifactError('invalid-artifact', 'revision compilation attachment count differs')
  return result
}
export class RevisionArtifacts {
  constructor(private readonly repository: StoryRepository) {}
  describe(scriptId: ScriptId, revisionId: RevisionId) { return revisionCompilation(this.repository, scriptId, revisionId) }
  read(scriptId: ScriptId, revisionId: RevisionId, key: string): Artifact {
    const report = this.describe(scriptId, revisionId)
    const target = report?.targets.find(item => item.attachmentKey === key)
    if (!report || report.status !== 'success' || !target) throw new ArtifactError('artifact-not-found', 'revision has no selected compiled artifact')
    const stored = this.repository.readRevisionAttachment(revisionId, key)
    const artifact = loadArtifact(canonical(stored.value))
    if (artifact.sourceHash !== report.sourceHash || artifact.options.entry !== target.entry || artifact.options.language !== target.language || artifact.id !== stored.metadata.artifactId)
      throw new ArtifactError('invalid-artifact', 'revision artifact differs from its frozen manifest')
    return artifact
  }
  preview(scriptId: ScriptId, revisionId: RevisionId, key: string) { return initialize(this.read(scriptId, revisionId, key)) }
}
