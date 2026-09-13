# Agent Note: Object-scoped tool edits over snapshot transactions

Status: implemented

English | [中文](2026-09-13-object-scoped-edits.zh.md)

## Problem

Program and text tools share a mutable draft. Requiring the model to supply its complete sequence makes an unrelated edit invalidate another pending operation. Separate languages of one text entry also occupy the same KV value, so checking only individual database keys would still reject useful concurrent edits.

## Decision

[Local tools](../../../../plugins/story-tools/README.md#session-observations) compare affected objects with the session's original observations, then apply their operations to a fresh complete snapshot. The core validates the resulting structure. Existing storage transactions check the snapshot sequence before saving its KV changes. A rejected sequence check permits recalculation with the same intent and observations, with a maximum of three attempts. This partially replaces the model-supplied edit sequence described by the [writer-session decision](2026-09-12-writer-sessions.md); session ownership and observation lifetime remain unchanged.

Database contents remain authoritative. Candidates acquire a persisted identity only after commit. Receipts and observation updates use that committed snapshot, even when a later writer has already advanced the draft. Internal reads grant no authority over other objects. A removed observed translation conflicts until a new read establishes its absence. Default-language changes use a separate observed value.

Commits and restoration retain explicit complete-draft sequence checks. Language deletion carries its sequence on the operation, since its scope includes every translation in that language. No model request, compilation or external I/O runs inside these transactions. Only rejected sequence checks repeat; busy connections, other failures and already committed operations do not.

## Alternatives considered

Removing storage sequence checks would allow old candidates to overwrite newer data. Replacing the expected sequence without recalculating content has the same defect. Per-KV conditional writes would still couple translations and shared settings, while moving business-field checks into SQL would make the storage module depend on authoring rules. Holding a write transaction across business callbacks would lengthen lock ownership and change the storage interface. Exclusive script binding would prevent the intended shared editing workflow.

## Consequences

Local tool calls no longer accept a batch expectedSequence. Existing manual-editor calls and storage APIs keep their sequence semantics. No database format or DSH patch changes are required. In-memory observations remain disposable and are rebuilt through explicit reads after resume or remount.

Tests use separate SQLite connections to insert competing writes between calculation and persistence. They cover independent files and translations, same-object rejection, rollback, bounded retries, cancellation and receipts from earlier committed snapshots. Real DSH checks cover isolated tool scopes and two independent editing calls produced in one model response. The tools do not automatically merge competing changes to the same observed object or replay a call whose receipt was lost after commit.
