/** A saved baseline plus ordered local edits; database sequence remains authoritative. */
import {
  applyOperations,
  encodeContent,
  type PlaybookContent,
} from '@papermoon/playbook-core'
import { fromDTO, type SnapshotDTO } from '../wire.ts'
import type { EditableOperation } from '../protocol.ts'
import type { Api } from './api.ts'
import type { Backup, Backups } from './buffers.ts'
import { encodeJson } from '@papermoon/playbook-storage/value'
const identity = (content: PlaybookContent) =>
  encodeJson(Object.fromEntries(encodeContent(content)))
type DraftDTO = Extract<SnapshotDTO, { kind: 'draft' }>
export interface DraftState {
  base: DraftDTO
  content: PlaybookContent
  operations: EditableOperation[]
  saving: boolean
  error: unknown
  backupError: unknown
  conflict?: DraftDTO
}
export class DraftEditor {
  private listeners = new Set<() => void>()
  private state: DraftState
  private writing: Promise<void> = Promise.resolve()
  readonly id = crypto.randomUUID()
  constructor(
    base: DraftDTO,
    private api: Api,
    private backups: Backups,
  ) {
    this.state = {
      base,
      content: fromDTO(base.content),
      operations: [],
      saving: false,
      error: null,
      backupError: null,
    }
  }
  flush = () => this.writing
  getSnapshot = () => this.state
  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
  private set(patch: Partial<DraftState>) {
    this.state = { ...this.state, ...patch }
    for (const listener of this.listeners) listener()
  }
  private persist() {
    const { base, operations } = this.state
    const backup: Backup = {
      id: this.id,
      playbookId: base.draft.playbookId,
      updatedAt: Date.now(),
      base,
      operations: [...operations],
    }
    this.writing = this.writing
      .then(() =>
        operations.length
          ? this.backups.put(backup)
          : this.backups.remove(this.id),
      )
      .then(() => {
        if (this.state.backupError) this.set({ backupError: null })
      })
      .catch((error) => {
        this.set({ backupError: error })
      })
  }
  edit(operations: EditableOperation[]) {
    const content = applyOperations(this.state.content, operations)
    let pending = [...this.state.operations]
    // Coalesce only adjacent scalar writes when no request owns the prefix.
    for (const next of operations) {
      const last = pending.at(-1)
      if (
        !this.state.saving &&
        last &&
        next.kind === last.kind &&
        JSON.stringify({
          ...last,
          ...(last.kind === 'replace-file'
            ? { source: null }
            : last.kind === 'set-translation'
              ? { text: null }
              : last.kind === 'set-description'
                ? { description: null }
                : {}),
        }) ===
          JSON.stringify({
            ...next,
            ...(next.kind === 'replace-file'
              ? { source: null }
              : next.kind === 'set-translation'
                ? { text: null }
                : next.kind === 'set-description'
                  ? { description: null }
                  : {}),
          }) &&
        ['replace-file', 'set-translation', 'set-description'].includes(
          next.kind,
        )
      )
        pending.pop()
      pending.push(next)
    }
    this.set({ content, operations: pending, error: null })
    this.persist()
  }
  recover(backup: Backup) {
    const content = applyOperations(
      fromDTO(backup.base.content),
      backup.operations,
    )
    const conflict =
      this.state.base.draft.sequence !== backup.base.draft.sequence
        ? this.state.base
        : undefined
    this.set({
      base: backup.base,
      content,
      operations: [...backup.operations],
      conflict,
      error: null,
    })
    this.persist()
  }
  async refresh() {
    const result = await this.api.call('snapshot', {
      ref: { kind: 'draft', playbookId: this.state.base.draft.playbookId },
    })
    if (result.kind !== 'draft') throw new Error('expected draft')
    if (
      this.state.saving ||
      result.draft.sequence <
        Math.max(
          this.state.base.draft.sequence,
          this.state.conflict?.draft.sequence ?? 0,
        )
    )
      return
    if (this.state.operations.length) {
      if (result.draft.sequence !== this.state.base.draft.sequence)
        this.set({ conflict: result })
    } else {
      this.set({
        base: result,
        content: fromDTO(result.content),
        conflict: undefined,
        error: null,
      })
    }
  }
  async save() {
    if (this.state.saving || this.state.conflict)
      throw new Error('draft is busy or conflicted')
    const sent = this.state.operations.slice(),
      before = this.state.base
    if (!sent.length) return
    this.set({ saving: true, error: null })
    const accept = (result: DraftDTO) => {
      const remaining = this.state.operations.slice(sent.length)
      this.set({
        base: result,
        operations: remaining,
        content: applyOperations(fromDTO(result.content), remaining),
        saving: false,
        conflict: undefined,
      })
      this.persist()
    }
    try {
      const result = await this.api.call('save', {
        playbookId: before.draft.playbookId,
        expectedSequence: before.draft.sequence,
        operations: sent,
      })
      if (result.kind !== 'draft') throw new Error('expected draft')
      accept(result)
    } catch (error) {
      // A lost response can hide a committed save; read it before enabling a retry.
      try {
        const latest = await this.api.call('snapshot', {
          ref: { kind: 'draft', playbookId: before.draft.playbookId },
        })
        if (latest.kind === 'draft') {
          const expected = identity(
            applyOperations(fromDTO(before.content), sent),
          )
          if (
            latest.draft.sequence === before.draft.sequence + 1 &&
            identity(fromDTO(latest.content)) === expected
          ) {
            accept(latest)
            return
          }
          this.set({
            conflict:
              latest.draft.sequence !== before.draft.sequence
                ? latest
                : undefined,
          })
        }
      } catch {
        /* The original failure remains visible when reconciliation cannot reach the server. */
      }
      this.set({ saving: false, error })
      throw error
    }
  }
  /** Only explicit discard/reload adopts the server while local edits exist. */
  discard(latest: DraftDTO) {
    this.set({
      base: latest,
      content: fromDTO(latest.content),
      operations: [],
      error: null,
      conflict: undefined,
    })
    this.persist()
  }
}
