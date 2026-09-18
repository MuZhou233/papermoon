# Agent Note: User-authored worldline reexecution

Status: implemented

English | [中文](2026-09-18-user-input-reexecution.zh.md)

## Problem

Reroll and sent-message editing express a user's decision to run another response. Plugin-source records obscure that authorship and require separate fixes in chat, trajectory and input summaries.

## Decision

The [performance plugin](../../../../plugins/performances/README.md#worldlines) submits these operations as fresh user inputs through shared Host admission. Worldline records preserve rerollOf or editedFrom; the new message does not inherit the old request identity or upload receipts. Parent selection and input acceptance form one durable operation after validation.

Interrupted inputs keep their user source without a fabricated model turn. Existing nodes and logs remain unchanged; a new execution from an old node uses the current submission semantics. [Worldline ownership](2026-09-16-worldlines.md) and its immutable state model remain in force.

## Alternatives considered

Keeping plugin sources and adding presentation exceptions would require every new history consumer to recognize repeated user input. Relabeling only the message without sharing admission would leave validation behavior dependent on the UI entry used.

## Consequences

Normal sending, reroll and edited resubmission share input handling; their selected parent and provenance distinguish them. An operation retry does not become another user turn. Explicitly mounted input-processing plugins run for a fresh submission, while model retries retain the already assembled context. Tests compare actual requests and verify state, identity, interruption and removal of presentation overrides.
