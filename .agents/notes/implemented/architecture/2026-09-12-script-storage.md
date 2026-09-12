# Agent Note: Script ownership and immutable revision reuse

Status: implemented

English | [中文](2026-09-12-script-storage.zh.md)

## Problem

Personal creation can involve unrelated scripts or several competing copies within one project. Copies need independent current content and future history, while already committed revisions must remain unchanged. Code and multilingual copy need shared revision boundaries without making storage depend on either business representation.

## Decision

The [storage module](../../../../plugins/story-storage/README.md) owns projects, scripts, one mutable draft per script, shared immutable revisions, per-script history directories and publications attached to directory membership. Copying duplicates draft values and selected directory references; it reuses complete immutable revisions. Informational provenance never creates synchronization, merging or retention requirements.

Each top-level KV entry occupies a row. Draft submission copies values into revision rows and appends history in one transaction. Database-side comparison returns changed keys and both values under a consistent read, while text diff remains with consumers. Content is complete at every revision; there is no delta chain or deduplication between independent commits.

A main-owned SQLite database uses Node's built-in driver. The DSH storage facade offers individual-record atomic operations, which do not directly cover a revision, its values and history membership together. The core therefore owns these SQL transactions. A small Cordis adapter registers the service without importing DSH types into the core. Both service removal and connection release are yielded into one effect so dependent cleanup finishes before the database closes.

## Alternatives considered

Copying all historical values into every new script duplicates the largest immutable part of the data. Sharing revisions preserves independent editing without that cost.

Embedding all script content and history in one KV record could use the existing DSH facade, but every change would rewrite the aggregate. A full JSON value per revision is simpler than entry tables, but targeted draft edits and SQL-side value filtering benefit from explicit entry rows.

Promoting a draft directly into a revision would require a replacement draft or copy-on-write behavior. Separate mutable rows and immutable revision rows keep submission and continued editing explicit.

Content hashes, compression, delta storage and automatic merge algorithms add maintenance without a demonstrated need. Multiple project databases would complicate cross-project copies and atomic operations. WAL is unnecessary for the current single-connection service; DELETE journaling with EXTRA synchronization favors durable local writes.

## Consequences

New revisions copy complete current content; ordinary saves overwrite only draft entries. A copied history adds references rather than revision bodies. Deleting the last history reference allows revision reclamation, even when informational provenance still names it. Consumers must tolerate those historical targets being unavailable.

The schema has its own identity and version and rejects unsupported files. It contains no compiler, approval process, model/session binding or UI. The [manual editor](2026-09-12-manual-script-editor.md) mounts this service through product configuration; this storage integration requires no DSH storage changes. Public API changes follow main-repository standards, while actual Cordis compatibility is checked separately against built host artifacts. Main checks do not require the submodule.
