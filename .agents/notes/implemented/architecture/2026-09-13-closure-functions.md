# Agent Note: Closure functions and durable moderator tools

Status: implemented

English | [中文](2026-09-13-closure-functions.zh.md)

## Problem

Starting messages cannot execute stateful decisions. Authors need ordinary functions whose parameters and return values remain recognizable when exposed as tools. State changes must survive interrupted result delivery without duplicate execution or hidden closure state.

## Decision

Registered factories receive a guarded candidate state and return named functions with explicit JSDoc. TypeScript parses declarations, Ajv validates JSON schemas, and the compiler freezes source, selected-language texts and tool metadata in artifact format 2. Factories cannot write state. Each call creates a new Worker and VM, checks frozen function identities and returns the function's JSON value directly. It does not regenerate JSDoc declarations.

A performance serializes calls and records each successful result and next state in one Session configuration event. The log is authoritative; a checksum chain and logged-call identity bind actions to their predecessors. Delivery waits for DSH's persistence checkpoint. Failed confirmation blocks the actor and marks delivery failure. Reopening recovers committed results through existing surface replacements while retaining old receipts for historical inspection. A fresh call ID alone is insufficient to deduplicate: the logged call sequence distinguishes separate requests.

The [compiler service](../../../../plugins/story-compiler/README.md) also supplies disposable simulation, using the same executor. Moderator tools use their authored names, arguments and results, without appended state or prompt text. A separate readonly UI exposes state and actions. The [performance plugin](../../../../plugins/performances/README.md) owns persistence and tool scopes; core storage remains independent of function syntax.

## Alternatives considered

Descriptor objects and platform-owned status/result envelopes would change ordinary function semantics. Inferring constraints from prose would add undocumented behavior. Long-lived closures would retain state absent from the log. Persisting state and receipts separately could expose a result whose state never committed. Replaying functions during restore could repeat side effects. The compiler's existing text-only artifact is insufficient for invocation, so this decision extends the [CommonJS design](2026-09-13-commonjs-opening-compiler.md) with frozen executable source rather than modifying accepted revisions.

## Consequences

Artifact and performance initialization formats require version 2; old versions fail without migration or recompilation. Story database format 3 and business KV format 1 remain unchanged. Submit-time compilation and immutable attachments retain the [frozen revision rules](2026-09-13-frozen-revisions-and-performances.md). Factories cannot change tool identity according to current state; persistent values belong in state. Throws roll back candidates, while business flags in returned JSON have no platform meaning.

Main tests cover compilation, simulation, invocation, persistence failure, receipt recovery and Fork. Real DSH and browser checks cover native declarations, original results, complete requests and readonly inspection. These checks establish engineering readiness; authored scripts and interaction quality still need experience feedback.

Same-file aliases include consecutive JSDoc blocks. Explicit string-key dictionaries compile to schema-valued additionalProperties; unrestricted object remains unsupported. The DSH adapter validates the same dictionary schema. The performance composition retains intermediate reply text in Compact display, so calling a function does not hide preceding narration. Reasoning and tool rows keep their disclosure controls.

[Worldlines](2026-09-16-worldlines.md) select the action ancestry and require receipt recovery before sealing a node. Sealed nodes cannot receive later repairs; missing evidence blocks continuation.
