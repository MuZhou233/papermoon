/** Bound playbook tools. No Session, filesystem access, or UI dependency is required. */
import {
  type ContentOperation,
  type ContentRef,
  type JsonValue,
  type PlaybookId,
  type RevisionId,
  type ComparisonCursor,
  type PlaybookContent,
  type DraftSnapshot,
} from '@papermoon/playbook-core'
import type { PlaybookRepository } from '@papermoon/playbook-core/repository'
import type { CompilationService } from '@papermoon/playbook-compiler/service'
import { StorageError } from '@papermoon/playbook-storage'
import { PlaybookObservations, type DraftToolOperation } from './observations.ts'
export { PlaybookObservations } from './observations.ts'
import { schemas, toolCatalog, help, type ToolName } from './catalog.ts'
export { toolCatalog } from './catalog.ts'
export class PlaybookToolError extends Error {
  constructor(
    readonly code: string,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
  }
}
/** Maps and optional object fields become lossless JSON; authored records retain their own identities. */
function json(value: unknown): JsonValue {
  if (value instanceof Map)
    return [...value].map(([key, item]) => [key, json(item)])
  if (Array.isArray(value)) return value.map(json)
  if (value !== null && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .map(([key, item]) => [key, json(item)]),
    )
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    typeof value === 'number'
  )
    return value
  throw new PlaybookToolError('invalid-result', 'tool result is not JSON')
}
export function createPlaybookTools(
  repository: PlaybookRepository,
  playbookId: PlaybookId,
  observations?: PlaybookObservations,
  compiler?: CompilationService,
) {
  function retained(id: string, parameter: string): RevisionId {
    try {
      repository.getHistoryEntry(playbookId, id as RevisionId)
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'not-found')
        throw new PlaybookToolError(
          'not-found',
          `${parameter}: ${JSON.stringify(id)} is not a revision ID retained in the bound playbook. This parameter accepts revision IDs, not file paths.`,
          { cause: error },
        )
      throw error
    }
    return id as RevisionId
  }
  function reference(
    ref?:
      | { kind: 'draft'; sequence?: number }
      | { kind: 'revision'; revisionId: string },
    parameter = 'ref',
  ): ContentRef {
    return ref?.kind === 'revision'
      ? { kind: 'revision', revisionId: retained(ref.revisionId, `${parameter}.revisionId`) }
      : {
          kind: 'draft',
          playbookId,
          ...(ref?.sequence === undefined ? {} : { sequence: ref.sequence }),
        }
  }
  /** Recalculate from a pinned snapshot; only a rejected CAS can repeat this synchronous save. */
  function edit(
    operations: readonly DraftToolOperation[],
    signal: AbortSignal,
    resolve: (content: PlaybookContent) => readonly ContentOperation[],
  ): DraftSnapshot {
    for (let attempt = 1; ; attempt++) {
      signal.throwIfAborted()
      const before = repository.readSnapshot({ kind: 'draft', playbookId })
      for (const operation of operations) {
        if (operation.kind === 'delete-language' && operation.expectedSequence !== before.draft.sequence)
          throw new PlaybookToolError('conflict', `delete-language expectedSequence ${operation.expectedSequence} differs from current draft sequence ${before.draft.sequence}; no changes were saved`)
      }
      const observed = observations?.prepare(before.content, operations)
      const changes = resolve(before.content)
      signal.throwIfAborted()
      let saved: DraftSnapshot
      try {
        saved = repository.editDraft({ playbookId, expectedSequence: before.draft.sequence, operations: changes })
      } catch (error) {
        if (!(error instanceof StorageError) || error.code !== 'conflict') throw error
        if (attempt === 3)
          throw new PlaybookToolError('write-contention', 'The draft changed during three save attempts; this edit was not saved.', { cause: error })
        continue
      }
      // This snapshot belongs to the committed sequence, even if another writer has since advanced it.
      observed?.(saved.content)
      return saved
    }
  }
  function run(name: ToolName, raw: unknown, signal: AbortSignal): unknown {
    repository.getPlaybook(playbookId)
    // Each arm parses its own declaration, keeping input inference tied to the catalog.
    switch (name) {
      case 'playbook_simulate': {
        const a = schemas[name].parse(raw)
        if (!compiler) throw new PlaybookToolError('unavailable', 'compiler service is not installed')
        const snapshot = repository.readSnapshot({ kind: 'draft', playbookId })
        return compiler.simulate({ playbookId, ref: { kind: 'draft', sequence: snapshot.draft.sequence } }, a.calls as { name: string; args: import('@papermoon/playbook-core').JsonObject }[],
          { ...(a.entry === undefined ? {} : { entry: a.entry }), ...(a.language === undefined ? {} : { language: a.language }) }, signal)
      }
      case 'playbook_compile': {
        const a = schemas[name].parse(raw)
        if (!compiler) throw new PlaybookToolError('unavailable', 'compiler service is not installed')
        return compiler.compile({ playbookId, ref: a.ref },
          { ...(a.entry === undefined ? {} : { entry: a.entry }), ...(a.language === undefined ? {} : { language: a.language }) }, signal)
      }
      case 'playbook_status': {
        schemas[name].parse(raw)
        const snapshot = repository.readSnapshot({ kind: 'draft', playbookId })
        observations?.status(snapshot.content)
        return {
          playbook: repository.getPlaybook(playbookId),
          draft: snapshot.draft,
          languages: [...snapshot.content.texts.languages.values()],
          defaultLanguage: snapshot.content.texts.defaultLanguage,
          settings: {
            contentMetadata: snapshot.content.metadata,
            programMetadata: snapshot.content.program.metadata,
            catalogMetadata: snapshot.content.texts.metadata,
          },
          programFiles: snapshot.content.program.files.size,
          textEntries: snapshot.content.texts.entries.size,
        }
      }
      case 'playbook_program_list': {
        const a = schemas[name].parse(raw)
        const result = repository.listFiles(reference(a.ref), a)
        return {
          ...result,
          items: result.items.map(({ path, metadata }) => ({ path, metadata })),
        }
      }
      case 'playbook_program_read': {
        const a = schemas[name].parse(raw)
        const result = repository.readFile(reference(a.ref), a.path)
        if (a.ref?.kind !== 'revision') observations?.file(result.file)
        return result
      }
      case 'playbook_program_search': {
        const a = schemas[name].parse(raw)
        return repository.searchProgram(reference(a.ref), a.query, a)
      }
      case 'playbook_text_list': {
        const a = schemas[name].parse(raw)
        const result =
          a.missingLanguage === undefined
            ? repository.listTexts(reference(a.ref), a)
            : repository.listMissingTranslations(
                reference(a.ref),
                a.missingLanguage,
                a,
              )
        return {
          ...result,
          items: result.items.map(
            ({ key, description, metadata, translations }) => ({
              key,
              description,
              metadata,
              languages: [...translations.keys()],
            }),
          ),
        }
      }
      case 'playbook_text_read': {
        const a = schemas[name].parse(raw)
        if (a.language === undefined) {
          const result = repository.readText(reference(a.ref), a.key)
          if (a.ref?.kind !== 'revision') observations?.text(result.entry)
          return result
        }
        const result = repository.lookupTranslation(reference(a.ref), a.key, a.language)
        if (a.ref?.kind !== 'revision') {
          if (result.result.kind === 'found') observations?.translation(a.key, a.language, result.result.translation)
          else if (result.result.reason === 'translation') observations?.translation(a.key, a.language, undefined)
        }
        return result
      }
      case 'playbook_text_search': {
        const a = schemas[name].parse(raw)
        return repository.searchTexts(reference(a.ref), a, a)
      }
      case 'playbook_program_edit': {
        const a = schemas[name].parse(raw)
        const result = edit(a.operations, signal, initial => {
          const files = new Map(
            [...initial.program.files].map(([path, file]) => [path, file.source]),
          )
          const operations: ContentOperation[] = []
          for (const operation of a.operations) {
            let next: ContentOperation
            if (operation.kind === 'replace-text') {
              const source = files.get(operation.path)
              if (source === undefined)
                throw new PlaybookToolError(
                  'not-found',
                  `program file does not exist: ${operation.path}`,
                )
              const position = source.indexOf(operation.oldText)
              if (
                position < 0 ||
                source.indexOf(operation.oldText, position + 1) >= 0
              )
                throw new PlaybookToolError(
                  'match-count',
                  `oldText must match exactly once: ${operation.path}`,
                )
              next = {
                kind: 'replace-file',
                path: operation.path,
                source:
                  source.slice(0, position) +
                  operation.newText +
                  source.slice(position + operation.oldText.length),
              }
            } else next = operation as ContentOperation
            if (next.kind === 'create-file' || next.kind === 'replace-file')
              files.set(next.path, next.source)
            else if (next.kind === 'delete-file') files.delete(next.path)
            else if (next.kind === 'rename-file') {
              const source = files.get(next.path)
              if (source !== undefined) {
                files.delete(next.path)
                files.set(next.to, source)
              }
            }
            operations.push(next)
          }
          return operations
        })
        return {
          sequence: result.draft.sequence,
          affected: a.operations.map((operation) =>
            'path' in operation
              ? {
                  path: operation.path,
                  ...('to' in operation ? { to: operation.to } : {}),
                }
              : { target: operation.target },
          ),
        }
      }
      case 'playbook_text_edit': {
        const a = schemas[name].parse(raw)
        const result = edit(a.operations, signal, () => a.operations.map(operation => {
          if (operation.kind === 'delete-language') return { kind: operation.kind, language: operation.language }
          return operation as ContentOperation
        }))
        return {
          sequence: result.draft.sequence,
          affected: a.operations.map((operation) => ({
            kind: operation.kind,
            ...('key' in operation ? { key: operation.key } : {}),
            ...('language' in operation
              ? { language: operation.language }
              : {}),
            ...('target' in operation ? { target: operation.target } : {}),
          })),
        }
      }
      case 'playbook_history': {
        const a = schemas[name].parse(raw)
        return a.revisionId === undefined
          ? repository.listRevisions(playbookId, a)
          : {
              entry: repository.getHistoryEntry(
                playbookId,
                retained(a.revisionId, 'revisionId'),
              ),
              revision: repository.getRevision(a.revisionId as RevisionId),
            }
      }
      case 'playbook_commit': {
        const a = schemas[name].parse(raw)
        if (!compiler) throw new PlaybookToolError('unavailable', 'compiler service is not installed')
        return compiler.submit({
          ...a,
          playbookId,
          metadata: a.metadata as
            | import('@papermoon/playbook-core').JsonObject
            | undefined,
          historyMetadata: a.entryMetadata as
            | import('@papermoon/playbook-core').JsonObject
            | undefined,
          references: a.references?.map((id, index) => retained(id, `references[${index}]`)),
        }, signal)
      }
      case 'playbook_diff': {
        const a = schemas[name].parse(raw)
        return repository.compare(reference(a.left, 'left'), reference(a.right, 'right'), {
          ...a,
          after: a.after as ComparisonCursor | undefined,
        })
      }
      case 'playbook_restore': {
        const a = schemas[name].parse(raw),
          result = repository.restoreDraft({
            ...a,
            playbookId,
            revisionId: retained(a.revisionId, 'revisionId'),
          })
        observations?.clear(a.selection)
        return { draft: result.draft, selection: a.selection }
      }
      case 'playbook_help': {
        const a = schemas[name].parse(raw),
          topic = a.topic ?? 'overview'
        return { topic, text: help[topic] }
      }
    }
  }
  const readRequirements: Partial<Record<ToolName, string>> = {
    playbook_program_edit: ' Read existing files with playbook_program_read before changing them. Read program metadata with playbook_status before replacing it. Edits fail if an observed object has changed.',
    playbook_text_edit: ' Read entries or translations with playbook_text_read before replacing, renaming or deleting those objects. Read catalog metadata, language metadata and the default language with playbook_status before replacing those values. Edits fail if an observed object has changed.',
  }
  return toolCatalog().filter(descriptor => !['playbook_compile', 'playbook_commit', 'playbook_simulate'].includes(descriptor.name) || compiler !== undefined).map((descriptor) => ({
    ...descriptor,
    description: descriptor.description + (observations ? readRequirements[descriptor.name] ?? '' : ''),
    output: {
      ...descriptor.output,
      render: (_args: unknown, value: unknown) => [
        { type: 'text' as const, text: JSON.stringify(value) },
      ],
    },
    isConcurrencySafe: () => descriptor.readonly,
    async execute(
      args: unknown,
      exec: { signal: AbortSignal },
    ): Promise<JsonValue> {
      exec.signal.throwIfAborted()
      try {
        return json(await run(descriptor.name, args, exec.signal))
      } catch (error) {
        if (error instanceof Error && 'code' in error)
          throw new PlaybookToolError(
            String(error.code),
            `${String(error.code)}: ${error.message}`,
            { cause: error },
          )
        throw error
      }
    },
  }))
}
