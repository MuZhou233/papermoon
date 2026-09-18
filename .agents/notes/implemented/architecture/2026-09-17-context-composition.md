# Agent Note: Script-owned request composition

Status: implemented

English | [中文](2026-09-17-context-composition.zh.md)

## Problem

A complete worldline records experience, while a model request may need only selected history and prompts placed around it. Treating both as one append-only message list prevents script-defined windows and makes changing a request indistinguishable from changing history.

## Decision

The frozen script owns a synchronous composeContext function. Each admitted input evaluates it once against readonly parent state and history identities. The host expands selected original blocks, confirms persistence and reuses that base for tool continuations. Original responses and complete tool exchanges stay indivisible. Actual-request inspection reads durable references and authored text; it never executes the script again. The [API](../../../../plugins/story-compiler/api.md#context-composition) owns the detailed contract.

This extends the [worldline decision](2026-09-16-worldlines.md) without changing its nodes or selection rules. Artifact and performance initialization formats require version 3. Earlier data is preserved but unsupported; source must be submitted again to use composition. The database and business content formats stay unchanged.

## Alternatives considered

Editing the selected history to express a window would hide records from chat and trajectory. Reassembling after each tool call would move tail prompts and undermine the stable within-turn prefix. Sending complete historical bodies into the Worker would make small windows pay for discarded text. Independent runtime presets would prevent a script from owning its complete context.

## Consequences

Scripts can place ordinary user and assistant prompts around original references and set the complete system head. They cannot transform historical text, forge tool results or see another path. Invalid composition stops the request. Uncertain persistence blocks further execution. Recorded requests retain their original messages after reroll, branching and restoration. Summaries and memory generation remain outside this mechanism.
