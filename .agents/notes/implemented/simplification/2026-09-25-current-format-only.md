# Agent Note: Current product formats without compatibility machinery

Status: implemented

English | [中文](2026-09-25-current-format-only.zh.md)

## Problem

PaperMoon does not promise compatibility across product revisions. Format counters, historical-format rejection tests and the read-only path for older performances nevertheless required maintaining a history of data structures that the product does not support.

## Decision

Product databases, Playbook content, compiled artifacts, editor backups, writer configuration and performance metadata use their current structure without independent format version numbers. Readers retain application identities, structural validation and integrity checks. Historical readers, migrations, compatibility branches and historical-format test cases are outside the current product scope. [Development](../../../../docs/development.md#frozen-revision-data) owns the operating guidance.

This replaces the format-version handling described by the [Playbook naming decision](../architecture/2026-09-24-playbook-and-story-mode.md) and the read-only fallback in the [worldline decision](../architecture/2026-09-16-worldlines.md). An initialized performance requires a worldline root and selected path. There is no alternate read path for sessions without those records.

Draft sequences, writer edit sequences, history-selection counters and immutable content revisions remain part of normal product behavior. They detect concurrent changes or represent user work; they are not file format versions. DSH protocol fields, dependency versions and repository maintenance formats retain their own contracts. Tests still cover current-format persistence, refresh, interrupted execution and Fork.

## Alternatives considered

Keeping version counters merely to reject known historical values would preserve a compatibility matrix without providing a supported upgrade path. Resetting all counters to one would retain the same machinery. Removing structural validation together with the counters would also remove checks for malformed input and corrupted data, which current operation still needs.

## Consequences

When product data structures change, development starts with fresh data. Existing runtime files are not migrated or cleaned automatically. Cross-revision readability is not a delivery requirement, while the current behavior and data-integrity tests remain required. Chapter requirements still ensure that every implemented chapter can be completed from the beginning in the current product.
