# Playbook storage

English | [中文](README.zh.md)

This module stores projects, playbooks, mutable drafts, shared immutable revisions and publication records. It supplies a Node-only API and a Cordis service plugin. The PaperMoon extension bundle mounts this service alongside the [manual editor](../playbook-editor/README.md); original Web does not.

## Ownership and content

A project contains independent playbooks. Each playbook owns one draft and an ordered history directory. Directory entries reference immutable revisions; copying history copies these references, not revision bodies. Publication records belong to a playbook and a revision in that playbook's directory. They contain no approval workflow or compiled artifact.

Content is a map from strings to JSON values. Draft and revision entries occupy separate SQLite tables, with one row per top-level key. Objects inside a value remain JSON. The module does not interpret keys as paths, code, languages or copy. Consumers own those conventions and their business formats.

JSON objects use deterministic member ordering. Array order and string content are preserved; negative zero serializes as zero. Missing keys differ from present null values. Undefined, non-finite numbers, cyclic objects, accessors, sparse arrays and objects with custom prototypes are rejected. Keys and directly stored text must be well-formed Unicode strings without NUL, which the current Node SQLite text reader truncates. NUL inside JSON values remains supported. Reads return detached values, so mutating a returned object does not edit storage.

## Drafts and revisions

A new draft starts at sequence zero. Every accepted write batch advances its sequence once, including an empty batch. Changes within a batch run in order. Writes, restoration and commits require the expected sequence; a mismatch rejects the whole operation. Project and playbook metadata updates replace supplied fields without a draft sequence check. Names must contain non-whitespace text and need not be unique. createPlaybook accepts initialContent and draftMetadata, storing them with the new playbook at sequence zero. writeDraft can replace draft metadata atomically with values.

Saving changes only the draft. A commit copies all draft entries into a new revision inside the database, appends its history ordinal, updates the draft's informational base revision and advances its sequence. The draft remains editable. Every independent commit creates a distinct revision, even with identical content or an empty description. Revision metadata, description, source identity and values have no update API. Directory entries also have immutable metadata, supplied as historyMetadata when committing. Draft metadata remains on the draft and is not converted to revision metadata.

Restoration replaces the entire draft from any retained revision. It preserves history and draft metadata and does not create a revision. Base revisions, copied-playbook origins and extra revision references are informational: they do not add history or prevent deletion. These references may outlive their targets.

## Copy, publication and deletion

Copy requests explicitly select a source playbook, a draft sequence or historical revision, a target project, a name, and history/publication scopes. Draft sources carry the complete history when requested; revision sources carry the directory prefix through that revision. Content-only copies have empty history. New drafts start at sequence zero. A draft source carries its draft metadata; a revision source starts with empty draft metadata. draftMetadata can override either result. The new playbook uses the supplied metadata, or copies the source metadata when none is supplied.

Copied history retains the same immutable revision IDs, ordinals and directory-entry metadata. Future appends use independent directories. Publication copying requires history copying and includes only publications for retained directory entries. Copies have new publication IDs and preserve the original registration time and metadata. Copying does not modify the source or create a revision.

Publications may be registered more than once for the same playbook revision. Only membership is checked. There is no publish approval, revocation or default-version policy.

Deleting a playbook removes its draft, history references and publications. Deleting a project cascades through its playbooks. Unreferenced revisions and their entries are removed in the same transaction; another playbook's history keeps its shared revisions alive. There is no individual history deletion API, automatic history trimming or content deduplication between independently created revisions.

## API and pagination

The [public types](src/types.ts) describe requests and results; [PlaybookStorage](src/storage.ts) implements synchronous operations. Failures use [StorageError](src/error.ts) codes: invalid-input, not-found, conflict, busy, closed, format-mismatch, corrupt and database-error. A call returns after its transaction commits. Calls after close fail; close itself is idempotent.

| Operation group | Methods |
|---|---|
| Lifecycle | constructor, close |
| Projects | createProject, getProject, listProjects, updateProject, deleteProject |
| Playbooks | createPlaybook, getPlaybook, listPlaybooks, queryPlaybooks, updateScript, copyPlaybook, deletePlaybook |
| Drafts | getDraft, writeDraft, restoreDraft |
| Revisions | commitRevision, getRevision, getHistoryEntry, listRevisions |
| Publications | createPublication, getPublication, listPublications |
| Content | readContent, readSnapshot, readEntry, listEntries, compare |

Lists default to 100 items and accept limits from 1 to 1000. Project, playbook and publication lists use stable ID order; history uses ascending ordinals by default, or descending ordinals with descending enabled. The after cursor follows the selected order. Metadata pages exclude revision bodies. Catalog pages are not frozen across separate calls: concurrent catalog changes may affect later pages.

queryPlaybooks filters across projects or within one project, using literal SQLite name matching. Results include the project name and latest ordinal without loading bodies. getHistoryEntry returns a retained revision’s playbook-local ordinal and directory metadata; an unrelated revision is rejected.

readSnapshot returns owner attributes and all values in one read transaction, with a draft or revision discriminant. It does not combine separately observed owner metadata and values.

Content references identify a revision or a draft, optionally pinned to a sequence. Content results return resolved references. Pass those references into subsequent pages and detail reads to reject changes to the compared draft. Continuing a key or comparison page requires a pinned sequence for every draft reference. Key pages use SQLite BINARY ordering, an exclusive after key, an inclusive lower bound and an exclusive upper bound. A next cursor is returned only when more results exist.

Comparison reads both sides in one transaction and returns added, removed or modified entries with explicit presence and before/after values. Equal values are filtered in SQL. The query may scan all relevant entries; it does not promise work proportional only to the number of changes. Text line diff, recursive business interpretation and display belong to consumers.

```ts
import { PlaybookStorage } from './src/index.ts'

export function createExample(path: string) {
  const storage = new PlaybookStorage({ path })
  try {
    const project = storage.createProject({ name: 'Example' })
    const playbook = storage.createPlaybook({ projectId: project.id, name: 'Draft' })
    const draft = storage.writeDraft({
      playbookId: playbook.id,
      expectedSequence: 0,
      changes: [{ kind: 'set', key: 'opening', value: { en: 'Hello' } }],
    })
    return storage.commitRevision({
      playbookId: playbook.id,
      expectedSequence: draft.sequence,
      description: 'Initial content',
    })
  } finally {
    storage.close()
  }
}
```

## Database and plugin

One database contains all projects for a storage instance. The constructor and plugin Config require path, a filesystem path resolved relative to the process working directory. Place it in the runtime data directory, for example `.papermoon/playbook.sqlite`, outside the managed DSH checkout. Memory databases are not supported; tests use temporary files. Missing directories/files are created with owner-only modes where supported; existing permissions are preserved.

The module uses Node's built-in SQLite connection with DELETE journaling, EXTRA synchronization, foreign keys enabled, zero busy timeout and no automatic vacuum. Busy operations fail immediately. Transactions do not await model calls or external work. Deleted pages may be reused without shrinking the file. Cache and page settings remain at SQLite defaults.

A dedicated application ID identifies the database. An empty database receives the schema atomically. Existing databases must match the identity and declared schema and pass integrity checks. Foreign schemas and damaged files fail validation without replacement or repair. Data is not shared with DSH's session database. Backups must use a consistent database backup method or copy the file after all connections close.

The built package exports `@papermoon/playbook-storage`, `@papermoon/playbook-storage/plugin` and `@papermoon/playbook-storage/value`. The value entry exports the deterministic encodeJson function and JSON types without loading Node built-ins; business modules can reuse its value rules without opening storage. The plugin registers papermoonPlaybookStorage through the host's provide/effect APIs. Its generator effect owns both disposers, unregistering and waiting for dependent consumers before closing the connection. Failed registration also releases the connection. A minimal structural host interface keeps DSH types outside the core; the separate integration check validates it against real Cordis declarations and runtime.

## Build and verification

From the repository root, run `pnpm build:plugins` to emit the package's lib directory. It has no runtime dependencies beyond Node. `pnpm typecheck`, `pnpm lint` and `pnpm test` cover source and unit tests without DSH. `pnpm check:plugins:dsh` additionally requires built plugin and DSH artifacts; it checks host type compatibility, imports the emitted plugin and verifies dependent cleanup and remounting with real Cordis. It does not start Web or call a model.

The [storage decision](../../.agents/notes/implemented/architecture/2026-09-12-playbook-storage.md) records the alternatives and ownership choices. Main and integration checks follow the [testing guide](../../docs/testing.md).

## Immutable attachments

CommitInput accepts generic attachments and attachmentMetadata. Each attachment has a key, JSON value and metadata. The immutable manifest retains order and checksums; readRevisionAttachment verifies the body against it. The storage module does not interpret compilation states or artifact formats. Source, revision, manifest, bodies, history entry and draft position commit together. History queries return summaries without bodies. Copying history shares attachments, and deleting the last directory reference reclaims them. There is no append, replace or standalone delete API for attachments.
