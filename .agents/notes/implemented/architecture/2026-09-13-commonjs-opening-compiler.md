# Agent Note: CommonJS compilation and frozen opening contexts

Status: implemented

English | [中文](2026-09-13-commonjs-opening-compiler.zh.md)

## Problem

Authored programs and multilingual text need a shared compilation path for manual editing and writer tools. Initial contexts provide a small executable language to validate compilation, saved outputs and runtime ownership before adding game mechanisms. The module system is a durable author-facing choice, so it must not depend on experimental native ESM VM APIs.

## Decision

The [compiler](../../../../plugins/story-compiler/README.md) evaluates restricted synchronous CommonJS with vm.Script. Relative explicit .js dependencies and one virtual API are the entire module surface. Acorn checks loaded sources without transpilation. It parses ESM constructs for a platform-specific rejection before evaluation. Declaration diagnostics name the unsupported member rather than the internal validation object. Each compilation owns its Worker, Context and module cache, with separate execution and outer deadlines, cancellation and concurrency limits.

Compilation resolves starting text in one exact language. The [closure-function decision](2026-09-13-closure-functions.md) extends artifacts with executable source and state; this note retains the CommonJS, text-initialization and independent-store decisions. The [runtime](../../../../plugins/story-compiler/src/runtime.ts) validates that artifact and returns independent initial contexts without evaluating programs. Names remain management data. The compiler adds no role instructions or message prefixes and does not enforce literary or translation-completeness rules outside text actually read.

The service reads fixed repository snapshots and saves successful artifacts through an independent JSON adapter before returning their identities. Content, effective options and compiler identity determine the key. Existing keys cannot be overwritten with different results. Saved artifacts remain usable after source editing or removal. Revision submission uses [immutable attachments](2026-09-13-frozen-revisions-and-performances.md); the independent store serves draft checks.

Explicit editor and tool compilation share the service. The editor initializes saved artifacts for its preview and marks results from changed inputs as stale. Tool compilation leaves observation rights unchanged. No publication or approval condition is added. The [manual-editor decision](2026-09-12-manual-script-editor.md) continues to own editing and local buffers.

## Alternatives considered

Native ESM would offer standard module semantics but couple the authored language to experimental VM module interfaces. Bundling or transpilation would add resolution and location-mapping behavior that the initial text compiler did not need. Re-evaluating source during initialization would make preview and runtime depend on compiler execution after an artifact had been accepted. Keeping only in-memory results would prevent restart recovery. Storing artifacts in revision bodies would mix mutable derived formats with immutable authored content.

## Consequences

The language excludes asynchronous execution and host I/O. Runtime functions and their artifact format are owned by the closure-function decision. Worker and VM controls limit resource use without promising complete hostile-code isolation. Successful artifacts accumulate until explicitly cleared; they have integrity hashes, not signatures. Built-worker checks use plain Node, actual Cordis tests cover cleanup, and deterministic model/browser tests cover receipts and previews without real model calls. Engineering readiness remains separate from creative-use feedback.
