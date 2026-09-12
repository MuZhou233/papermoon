# Agent Note: Writer sessions and observed edits

Status: implemented

English | [中文](2026-09-12-writer-sessions.zh.md)

## Problem

Writer definitions need recoverable, inspectable conversations. Multiple Agents and manual editing can share a script. Directory-based workspace identity and shared read permissions cannot represent that ownership.

## Decision

The [session plugin](../../../../plugins/writer-sessions/README.md) owns script targets, preparation and admission-time freezing. Accepted input records the complete writer snapshot. Authored messages retain their actual roles and stable identities. Runtime observations check object content together with the draft sequence; storage and the logical core remain independent of session policy.

## Alternatives considered

Virtual script directories would conflate resource identity and process cwd. Concatenating initial messages would lose roles. Resolving current settings for every request would change historical context. Exclusive binding would prevent manual and multi-session editing. Persisting read permissions would grant restored Agents authority over content absent from their current observation lifecycle.

## Consequences

Script and writer database formats remain unchanged. Generic workspace and message capabilities are maintained as DSH patches. Resume, Fork and plugin remount create new tool scopes and require fresh reads. Configuration snapshots increase log size but preserve request inspection after writer definitions change or disappear.
