# Agent Note: Closure functions and durable moderator tools

Status: implemented

English | [中文](2026-09-13-closure-functions.zh.md)

## Problem

Starting messages cannot execute stateful decisions. Authors need ordinary functions whose parameters and return values remain recognizable when exposed as tools. State changes must survive interrupted result delivery without duplicate execution or hidden closure state.

## Decision

Registered factories receive a guarded candidate state and return named functions with explicit JSDoc. TypeScript parses declarations, Ajv validates JSON schemas, and the compiler freezes source, selected-language texts and tool metadata in artifact format 2. Factories cannot write state. Each call creates a new Worker and VM, checks frozen function identities and returns the function's JSON value directly. It does not regenerate JSDoc declarations.

A performance serializes calls and records each successful result and next state in one Session configuration event. The log is authoritative; a checksum chain and logged-call identity bind actions to their predecessors. Delivery waits for DSH's persistence checkpoint. Failed confirmation blocks the actor and marks delivery failure. Reopening recovers committed results through existing surface replacements while retaining old receipts for historical inspection. A fresh call ID alone is insufficient to deduplicate: the logged call sequence distinguishes separate requests.

The [compiler service](../../../../plugins/story-compiler/README.md) also supplies disposable simulation, using the same executor. Moderator tools use their authored names, arguments and results, without appended state or prompt text. A separate readonly UI exposes state and actions. The [performance plugin](../../../../plugins/performances/README.md) owns persistence and tool scopes; core storage remains independent of function syntax.

DSH's shared schema supports inclusive anyOf alongside exact-one oneOf; both require at least two branches, permit annotations and reject sibling type constraints. Language renderers express both as unions while validation preserves their different acceptance rules. Schema-valued additionalProperties validates undeclared keys; named properties retain their own rules. Schema walking checks nested declarations and cycles. Pure dictionaries render with typed values, while mixed-object limits remain in the tools package contract.

Retained-outcome repair cites the failed receipt and at least one earlier retained event. It preserves message, call, source, turn, step and other identities, changing only result content and the error flag. The consumer validates retained application evidence; the Session validates references and identity without interpreting product state. The original receipt remains available to historical requests. Selected histories validate the repair on the chosen path, and sealed worldline nodes cannot receive later repairs.

Reply visibility uses effect-scoped preset registrations. Compact mode retains reply-bearing steps for registered presets while reasoning and tool disclosure remain unchanged. Streaming and restored views share the policy; ordinary presets retain the default behavior and Normal mode remains expanded.

## Alternatives considered

Mapping every union to oneOf would reject overlapping members. Unconstrained JSON would discard validation and type information; consumer-only validation would leave the registry unable to describe its actual schema. Flattening dictionaries would change tool data. Keeping an error flag after a proven success would misrepresent the outcome; reexecution could repeat effects, a second result could duplicate a call, and mutating the old receipt would destroy request evidence. A separate recovery event would duplicate replacement and provenance mechanisms. Global reply preferences would affect unrelated Sessions; disabling process folding would also expose reasoning and tool details; changing records would mix display policy with model history.

Descriptor objects and platform-owned status/result envelopes would change ordinary function semantics. Inferring constraints from prose would add undocumented behavior. Long-lived closures would retain state absent from the log. Persisting state and receipts separately could expose a result whose state never committed. Replaying functions during restore could repeat side effects. The compiler's existing text-only artifact is insufficient for invocation, so this decision extends the [CommonJS design](2026-09-13-commonjs-opening-compiler.md) with frozen executable source rather than modifying accepted revisions.

## Consequences

Existing oneOf and Boolean object-openness behavior remains unchanged. Unsupported schema keywords and invalid combinations fail at registration. Recovery cannot change identities or turn success into error, and it introduces no Session field, version, Loop phase or SDK wire type. Schema and rendering tests cover overlapping and unmatched unions, malformed branches, nested dictionaries, prototype-shaped keys and generated types; recorded Sessions preserve native declarations. Recovery tests check evidence, identities and historical retention. Component tests cover preset selection, streaming and restored replies, ordinary views and folded reasoning and tools.

Artifact and performance initialization formats require version 3; old versions fail without migration or recompilation. Story database format 3 and business KV format 1 remain unchanged. Submit-time compilation and immutable attachments retain the [frozen revision rules](2026-09-13-frozen-revisions-and-performances.md). Factories cannot change tool identity according to current state; persistent values belong in state. Throws roll back candidates, while business flags in returned JSON have no platform meaning.

Main tests cover compilation, simulation, invocation, persistence failure, receipt recovery and Fork. Real DSH and browser checks cover native declarations, original results, complete requests and readonly inspection. These checks establish engineering readiness; authored scripts and interaction quality still need experience feedback.

Same-file aliases include consecutive JSDoc blocks. Explicit string-key dictionaries compile to schema-valued additionalProperties; unrestricted object remains unsupported. The DSH adapter validates the same dictionary schema. The performance composition retains intermediate reply text in Compact display, so calling a function does not hide preceding narration. Reasoning and tool rows keep their disclosure controls.

[Worldlines](2026-09-16-worldlines.md) select the action ancestry and require receipt recovery before sealing a node. Sealed nodes cannot receive later repairs; missing evidence blocks continuation.
