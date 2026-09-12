/** Lossless JSON transport for business snapshots; no storage KV keys cross the interface. */
import type {
  StoryContent,
  StorySnapshot,
  TextEntry,
  ProgramFile,
  Language,
  Translation,
} from '@papermoon/story-core'
export interface ContentDTO {
  format: StoryContent['format']
  version: StoryContent['version']
  metadata: StoryContent['metadata']
  program: { metadata: StoryContent['metadata']; files: ProgramFile[] }
  texts: {
    metadata: StoryContent['metadata']
    defaultLanguage: string
    languages: Language[]
    entries: (Omit<TextEntry, 'translations'> & {
      translations: [string, Translation][]
    })[]
  }
}
export type SnapshotDTO =
  | (Omit<Extract<StorySnapshot, { kind: 'draft' }>, 'content'> & {
      content: ContentDTO
    })
  | (Omit<Extract<StorySnapshot, { kind: 'revision' }>, 'content'> & {
      content: ContentDTO
    })
export function toDTO(content: StoryContent): ContentDTO {
  return {
    ...content,
    program: { ...content.program, files: [...content.program.files.values()] },
    texts: {
      ...content.texts,
      languages: [...content.texts.languages.values()],
      entries: [...content.texts.entries.values()].map((e) => ({
        ...e,
        translations: [...e.translations],
      })),
    },
  }
}
export function fromDTO(content: ContentDTO): StoryContent {
  return {
    ...content,
    program: {
      ...content.program,
      files: new Map(content.program.files.map((f) => [f.path, f])),
    },
    texts: {
      ...content.texts,
      languages: new Map(content.texts.languages.map((l) => [l.id, l])),
      entries: new Map(
        content.texts.entries.map((e) => [
          e.key,
          { ...e, translations: new Map(e.translations) },
        ]),
      ),
    },
  }
}
export function snapshotDTO(snapshot: StorySnapshot): SnapshotDTO {
  return { ...snapshot, content: toDTO(snapshot.content) }
}

export function recordDTO(
  record: import('@papermoon/story-core').ContentRecord | null,
) {
  return record?.kind === 'text'
    ? {
        ...record,
        value: {
          ...record.value,
          translations: [...record.value.translations],
        },
      }
    : record
}
