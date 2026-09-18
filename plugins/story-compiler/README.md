# Script compiler and runtime

English | [中文](README.zh.md)

This package compiles a fixed [StoryContent](../story-core/README.md) into starting messages, state and function declarations. Programs use restricted CommonJS; the package uses ESM. The [script API](api.md) defines declarations, JSDoc and text lookup.

## Entries and ownership

| Entry | Public operations |
|---|---|
| @papermoon/story-compiler | compile, StoryCompiler, resolveOptions |
| @papermoon/story-compiler/runtime | loadArtifact, initialize |
| @papermoon/story-compiler/execution | StoryRuntime.invoke, compose, close |
| @papermoon/story-compiler/service | CompilationService, ArtifactStore |
| @papermoon/story-compiler/revisions | RevisionArtifacts, revisionCompilation |
| @papermoon/story-compiler/plugin | Cordis service papermoonStoryCompiler |

Compilation accepts content and explicit options. The service first reads one consistent draft snapshot, with its known sequence, and then starts asynchronous work. Source identity belongs to receipts, not program inputs. Edits during compilation cannot change that input. Storage and the logic core do not import the compiler.

The runtime entry validates frozen artifacts and returns independent initial contexts without loading Workers or executing source. The execution entry runs frozen modules and functions in Workers; it imports neither the compilation service nor the JSDoc parser. It does not read drafts, regenerate tool schemas or save progress. Performance sessions own state persistence.

## Execution and limits

Each compilation or invocation owns a new Worker, VM Context and module cache. Acorn checks restricted JavaScript, TypeScript parses explicit JSDoc during compilation, and vm.Script evaluates strict CommonJS wrappers. Invocation verifies factory and function identities against the frozen declarations. Only explicit state survives calls; module globals and closure locals start fresh.

Factories receive a guarded state reference. Property writes, nested writes, deletion and property-definition operations fail during factory construction. Function execution enables candidate changes. JSON Schema validation uses Ajv without coercion, default insertion or property removal. Invalid arguments, return values or candidate state fail before persistence. Unsupported state-schema keywords, asynchronous schemas or unresolved references fail compilation.

The outer deadline covers parsing, evaluation and normalization. VM calls also have a synchronous timeout. Completion, cancellation and failure terminate the Worker before resolving; close cancels and drains jobs. Contexts provide no host files, network, process, environment, clock, randomness or asynchronous scheduling. Dynamic code generation is disabled. These controls bound mistakes and resource use; [Node states that VM is not a security mechanism](https://nodejs.org/download/release/v24.3.0/docs/api/vm.html).

| Option under limits | Default |
|---|---|
| inputBytes | 8388608 |
| modules | 256 |
| outputBytes | 1048576 |
| executionMs | 1000 |
| totalMs | 10000 |
| concurrency | 2 |
| memoryMb | 128 |

Limits are positive safe integers. Entry and language resolve before evaluation; defaults are story.js and the content's default language. Each compiler or executor instance rejects excess concurrent jobs with busy and has no background queue. The standalone compile function shares one instance. Plugin configuration accepts directory, limits and attachmentBytes; author-facing interfaces select only entry and language. Performance calls use their frozen artifact's limits.

Diagnostics carry code, stage, message and available file, line, column, declaration field, text key or language. Module cycles include their reference chain. JSDoc errors identify the invalid annotation or alias declaration when available, otherwise the source function. Unknown positions remain absent. Complete artifacts, invocation state/results, diagnostics and simulation results obey output limits; performance persistence additionally checks the complete action record.

## Artifacts and persistence

Artifact format 3 freezes compiler/API identity, canonical source fingerprint, effective options, starting context, initial state/schema, function declarations, loaded modules, selected-language text and SHA-256 integrity data. It stores no function objects, closures, VM instances or bytecode. Loading rejects unsupported versions, invalid fields and damaged hashes without recompilation or repair. Hashes detect modification; they are not signatures.

CompilationService.compile evaluates a pinned draft and saves success before returning its artifact identity. find matches content, options and compiler identity without executing. read and initialize use artifact identity independently of the draft. ArtifactStore writes JSON with a temporary file and atomic no-overwrite link. Equal saves are idempotent; different results for one key fail. Failed attempts have no stored history. The store's default record limit is 16 MiB, configurable through its constructor. [Development](../../docs/development.md) owns data paths and cleanup.

The Cordis service depends on papermoonStoryCore. Consumer cleanup precedes service shutdown, which drains compilation and simulation before storage releases its connection. The Story database remains format 3 and business KV remains format 1. Artifact formats 1 and 2 are unsupported; existing files and revision attachments are not rewritten.

## Submission and frozen revisions

submit compiles every target from the same pinned draft. Omitted targets select story.js and the default language; explicit lists are nonempty and distinct. Order freezes with the revision, and its first result is the default performance target. allowCompilationFailure defaults to false. Every target must succeed to attach results. An explicitly allowed script failure commits source with an empty attachment list; it never skips compilation.

Cancellation, invalid options, unavailable services, Worker failures, storage failures and the outer deadline abort submission. Script syntax, load, declaration, translation and synchronous execution limits return diagnostics. The service checks source identity and aggregate attachmentBytes, then commits source, ordered artifact bodies and report in one SQLite transaction. A final sequence check rejects concurrent edits. A committed revision survives a lost response.

RevisionArtifacts reads frozen reports and attachments without compiling. Submitted artifacts cannot be added, changed or replaced. An explicit empty list differs from a missing body; missing or corrupt bodies fail. The standalone ArtifactStore holds draft checks only, so deleting it cannot remove historical artifacts.

## Simulation and verification

simulate pins a draft, compiles it without saving an artifact, then invokes functions in order on temporary state. Each step contains arguments, prior state and either the raw value with resulting state or diagnostics. A script error preserves the prior state and later calls continue; cancellation or service failure stops the operation. The whole simulation has an outer deadline and aggregate output limit. It saves neither draft content nor revisions or performance state.

Main tests use temporary data and deterministic source. pnpm check:compiler:built exercises emitted Workers and independent artifact loading under ordinary Node. pnpm check:plugins:dsh verifies real Cordis teardown and native function calls through DSH. Browser tests cover previews, tool history, readonly state, reload and narrow layouts. No check calls a real model or uses user data. The [closure decision](../../.agents/notes/implemented/architecture/2026-09-13-closure-functions.md) extends the [CommonJS decision](../../.agents/notes/implemented/architecture/2026-09-13-commonjs-opening-compiler.md).
