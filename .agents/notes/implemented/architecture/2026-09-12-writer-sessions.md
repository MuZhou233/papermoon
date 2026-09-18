# Agent Note: Writer sessions and observed edits

Status: implemented

English | [中文](2026-09-12-writer-sessions.zh.md)

## Problem

Writer definitions need recoverable, inspectable conversations. Multiple Agents and manual editing can share a script. Directory-based workspace identity and shared read permissions cannot represent that ownership.

## Decision

The [session plugin](../../../../plugins/writer-sessions/README.md) owns script targets, preparation and admission-time freezing. Accepted input records the complete writer snapshot. Authored messages retain their actual roles and stable identities. Runtime observations check returned object content; storage and the logical core remain independent of session policy. The [object-scoped edit decision](2026-09-13-object-scoped-edits.md) defines local conflict handling and keeps sequence checks inside persistence.

The DSH workspace extension gives resources stable target identities independent of process cwd. Providers resolve targets and validate durable membership; directory targets retain canonical-path validation and old registry formats are rejected. Creation and admission hooks run before acceptance, while preset selection validates before recomposition and reconciles associations after durable selection under idle exclusion.

Authored user and assistant context retains producer metadata and message identities without inventing model attempts. It is committed after system messages and before accepted inputs. Ordinary injected context remains an independent user message naming its producer, durable on inbox insertion and recorded unchanged on admission; it gains no prompt prefix or request envelope. Chat may retain an authored node independently of process disclosure.

## Alternatives considered

Treating resources as directories would couple grouping to filesystem access. Fake assistant attempts would distort usage and request reconstruction; wrapping every authored role as a user message would change model semantics. Resolving the latest configuration would lose historical provenance. A plugin-owned loop would duplicate queue, cancellation and persistence behavior.

Virtual script directories would conflate resource identity and process cwd. Concatenating initial messages would lose roles. Resolving current settings for every request would change historical context. Exclusive binding would prevent manual and multi-session editing. Persisting read permissions would grant restored Agents authority over content absent from their current observation lifecycle.

## Consequences

The shared hooks contain no PaperMoon data policy. Deleting a resource affects availability without changing retained transcript identity; ordinary directory navigation still works. Required context events reject unaware readers. Current event validation runs before the frozen released relationship checker: a private user-role view preserves coordinates for that check and is neither persisted nor returned. Original roles and admission metadata survive restoration; invalid roles, metadata or surface references fail before this view is used. Focused workspace, admission, Session and replay tests cover these shared obligations.

Script and writer database formats remain unchanged. Generic workspace and message capabilities are maintained as DSH patches. Resume, Fork and plugin remount create new tool scopes and require fresh reads. Configuration snapshots increase log size but preserve request inspection after writer definitions change or disappear.
