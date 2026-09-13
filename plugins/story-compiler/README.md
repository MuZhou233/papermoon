# Script compiler and opening runtime

English | [中文](README.zh.md)

This package compiles a fixed [StoryContent](../story-core/README.md) snapshot into literal starting messages. Programs use restricted CommonJS; the package itself uses ESM. The [script API](api.md) defines declarations and text lookup. No model, world state, runtime action or performance session is created.

## Entries and ownership

| Entry | Public operations |
|---|---|
| @papermoon/story-compiler | compile(content, options, signal), StoryCompiler, resolveOptions |
| @papermoon/story-compiler/runtime | loadArtifact(serialized), initialize(artifact) |
| @papermoon/story-compiler/service | CompilationService, ArtifactStore |
| @papermoon/story-compiler/revisions | RevisionArtifacts, revisionCompilation |
| @papermoon/story-compiler/plugin | Cordis service papermoonStoryCompiler |

The compiler receives content and explicit options, with no database or filesystem access to authored inputs. The service reads a consistent repository snapshot before starting asynchronous work. Only draft requests are compiled, and they require a known sequence. Historical artifacts are read by their frozen attachment keys. Source identity stays in the receipt and does not enter program evaluation. Editing during compilation cannot change its captured input.

The runtime imports neither the compiler Worker nor the authored repository. It validates the artifact and returns a detached context on each initialization. Changing one returned context cannot affect another. It never executes source, fetches text, calls a model or stores progress.

## Execution and limits

Every job owns a Worker, VM Context and module cache. Acorn checks loaded sources; vm.Script evaluates synchronous strict-mode wrappers and validates the declaration inside the same VM. The outer deadline covers parsing, evaluation and normalization. VM execution also has a synchronous timeout. Completion, failure and cancellation terminate the Worker before resolving. Closing the service cancels pending jobs and waits for them.

Only the entry and its actual dependencies are parsed. Contexts expose no host files, network, process, environment, clock, random source or asynchronous scheduler. Dynamic code generation is disabled. The Context has its own microtask queue. memoryMb caps the Worker's V8 old generation. These controls limit mistakes and resource use; [Node explicitly states that VM is not a security mechanism](https://nodejs.org/download/release/v24.3.0/docs/api/vm.html). Do not treat this as complete isolation for hostile source.

| Option under limits | Default |
|---|---|
| inputBytes | 8388608 |
| modules | 256 |
| outputBytes | 1048576 |
| executionMs | 1000 |
| totalMs | 10000 |
| concurrency | 2 |
| memoryMb | 128 |

All limits are positive safe integers. Options resolve the entry to story.js and language to the content default before evaluation. Explicit languages must be registered. A compiler instance rejects excess concurrent jobs with busy; it does not queue them. The standalone compile function uses one shared instance. The Cordis adapter accepts directory and optional limits configuration. User and model interfaces expose only entry and language; deployment limits belong to plugin configuration.

Diagnostics carry code, stage, message and available file, line, column, declaration field, text key or language. Unknown declaration fields identify the actual member and list the supported fields. ESM syntax diagnostics state the CommonJS requirement. Syntax positions refer to authored files, without wrapper line numbers in the message. Module cycles include the reference chain. Unknown source positions remain absent. Cancellation, resource failure and Worker failure return no successful artifact.

## Artifacts and persistence

Artifacts contain the format and compiler identity, canonical content fingerprint, resolved options, literal context and SHA-256 integrity data. They contain no executable source, closure, VM object or bytecode. Runtime loading rejects unsupported formats, malformed fields and mismatched hashes without repairing or recompiling them. Integrity hashes detect modification; they are not signatures.

CompilationService.compile always evaluates its captured input. Successful results are persisted before a usable identity is returned. CompilationService.find looks up an existing result by canonical content, effective options and compiler identity; it does not compile. read and initialize work by artifact ID without consulting the original draft. Saving or compiling never submits a revision or changes a publication record.

ArtifactStore writes complete JSON through a temporary file and an atomic no-overwrite link. Equal saves are idempotent; a different result for the same key raises artifact-conflict. Failed persistence rejects the operation. Records have no per-attempt history and do not store failed diagnostics. The standalone store defaults to a 16 MiB record limit, configurable through its constructor. [Development](../../docs/development.md) owns the product directory and cleanup procedure.

The plugin depends on papermoonStoryCore and provides papermoonStoryCompiler as an effect. Dependent cleanup runs before the service closes; the storage provider then releases its connection. Revision attachments use storage format 3; business content and opening artifact formats remain unchanged.

## Verification

Main tests use temporary databases and deterministic sources. pnpm check:compiler:built runs the emitted Worker and a separate runtime process under ordinary Node. pnpm check:plugins:dsh verifies real Cordis cleanup, tool scopes and a deterministic model's compiler receipt. pnpm test:editor covers explicit compilation, source and text diagnostics, exact-language preview, stale results and refresh recovery. No test calls a real model or uses user runtime data.

The [decision](../../.agents/notes/implemented/architecture/2026-09-13-commonjs-opening-compiler.md) records CommonJS, frozen text and independent artifact storage.

## Submission and frozen revisions

CompilationService.submit compiles every target from the same pinned draft. An omitted targets list resolves to story.js and the draft default language; explicit lists must be nonempty and distinct. Their order freezes with the revision, and the first result is the performance default. allowCompilationFailure defaults to false. All targets must succeed to attach results. A script error returns diagnostics without a revision unless that option is explicitly true; an allowed failure commits source with an empty attachment list. Permission to fail never skips compilation.

Cancellation, invalid options, busy or closed services, Worker failures, storage failures and the outer deadline abort submission. Script syntax, load, declaration, translation and synchronous execution limits are diagnostic failures. The service checks source fingerprints and the aggregate attachmentBytes limit (default 16 MiB), then commits source, ordered artifact bodies and report in the existing SQLite transaction. The final draft sequence check rejects edits made during compilation. A committed revision remains committed if its response is lost.

RevisionArtifacts reads the frozen report and full attachment, validates integrity and initializes its text without compiler execution. Compiled artifacts cannot be added to or replaced in a submitted revision. An explicit empty list differs from a missing referenced body; missing or corrupt bodies fail rather than compile again. The standalone ArtifactStore holds only draft checks. Deleting its files cannot remove a revision's attached artifacts.
