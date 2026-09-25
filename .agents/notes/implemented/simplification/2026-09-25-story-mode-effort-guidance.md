# Agent Note: Story Mode effort guidance

Status: implemented

English | [中文](2026-09-25-story-mode-effort-guidance.zh.md)

## Problem

Chapter 0 previously required locking effort to the selected model's lowest option. That requirement called for determining a minimum across model capabilities and enforcing it in requests. The revised experience leaves effort selection to the user and supplies guidance instead.

## Decision

The [fourth subsection](../../../../docs/story-mode/00/04-first-message.md#model-selection-and-effort-guidance) now owns advisory effort guidance. This replaces the effort constraint recorded in the [Story Mode decision](../architecture/2026-09-24-playbook-and-story-mode.md), while preserving free model selection and isolation from ordinary sessions and global defaults. This Note owns the reason for replacing the lock; the [layering decision](../architecture/2026-09-25-story-mode-layers.md) records the runtime integration.

The chapter reads model capabilities and the effective selection through general mechanisms. It no longer requires a lowest-effort inference API, locked effort controls or request overrides. The chapter owns when to show its recommendation; the trajectory displays the request's actual values.

## Alternatives considered

Keeping the lock would ensure that every exercise used the lowest supported effort, but would retain the enforcement and minimum-selection work removed by the revised requirement. Automatically choosing the recommended value would still change the user's selection. A recommendation lets the user decide without making that choice a condition of sending or completion.

## Consequences

Requirements and acceptance scenarios cover guidance appearing and disappearing, model and effort changes, and successful completion without following the recommendation. The example input remains locked, and both conversations retain their shared system prompt.
