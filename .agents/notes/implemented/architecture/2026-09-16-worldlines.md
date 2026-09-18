# Agent Note: Immutable performance worldlines

Status: implemented

English | [中文](2026-09-16-worldlines.zh.md)

## Problem

A performance needs alternative outcomes without losing prior executions. Reusing the newest action in the raw log would mix sibling state; deleting messages would destroy request evidence. Context selection must also remain distinct from future prompt assembly.

## Decision

The [performance plugin](../../../../plugins/performances/README.md#worldlines) seals one input and its complete execution as a node in one Session. Root and child nodes are immutable. Separate selection records identify the active ancestor path, remembered candidate descendants and operation identity. Checksummed versioned facts use DSH's required history-selection event; no separate history database exists.

Actions inherit the selected parent's state and retain committed changes even when the final model response fails. Receipt recovery occurs before sealing. Unconfirmed persistence or missing receipts stop progress. Recovery seals interrupted work without executing functions. This narrows the recovery timing of [durable functions](2026-09-13-closure-functions.md), whose action and artifact rules remain in force.

DSH records explicit ordered raw-event ranges with consecutive history-selection versions. Session folds replacements within the selected read; ordinary Loop messages, prompt/header state and authored-prefix deduplication follow it. Historical requests resolve their original raw prefix, independently of later selections and request-local assembly. A wire projection carries selection outside paginated windows; Conversation filters before Chat and Trajectory consume records. Lifecycle, inbox, usage and model-selection intent remain chronological. Consumers own node grouping, operation deduplication and application-state restoration; admission may acknowledge an already-persisted operation without enqueueing again.

Current validation checks original records and selected replacement relationships before using a private same-coordinate view for the frozen released validator. The installed Session checks original surface placement and replacements, and the adapter checks system messages against open steps. Released generations and their request/tool lifecycle validation remain unchanged. User actions expose raw message coordinates; the user-input reexecution decision owns their submission identity and presentation.

## Alternatives considered

Filtering only model messages would leave prompt and UI history inconsistent. Changing frozen released validators would erase the meaning of accepted formats. Selecting history therefore changes neither original coordinates nor tool outcomes, and requires references to preceding records.

Hidden child Sessions would split one visible performance across independently managed histories. Rewriting JSONL would remove evidence. Message-only nodes would expose unfinished tool protocols as continuation points. A separate rewind button leaves users to coordinate history selection and resending themselves. Editing the sent message makes that intention explicit. Sharing chat controls with the worldline inspector would make historical-result browsing change execution position. The inspector therefore keeps one explicit switch action and leaves generation controls in chat. A mutable tree database would add another source of truth. The chosen complete-turn nodes support alternative outcomes while preserving raw execution coordinates.

## Consequences

The history-selection event is required but does not change structural Session format; unaware readers reject it. Shared tests cover invalid references, selected replacement evidence, raw-prefix reconstruction, admission, client selection and Session/SDK replay.

Chat follows runtime selection; trajectory inspects a chosen path or its saved composed context. Audit and usage remain chronological. Reroll and sent-message editing create siblings; another input branches from the selected point. Editing combines replacement input and generation in one operation, preserving the unsent composer draft. Reads and inspection do not change execution position. Existing performances without worldline records are read-only; no tree is inferred. Story and artifact formats remain unchanged.

Worldline reads expose stable ordered nodes independently of model messages. Actual request prefixes remain reconstructable after switching. Custom context windows and summaries can consume nodes later without redefining recorded history. Engineering checks cover state, requests, recovery, scope and browser interactions; experience feedback remains separate.
