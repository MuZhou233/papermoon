# Agent Note: Prose review before committing

Status: implemented

English | [中文](2026-09-13-pre-commit-prose-review.zh.md)

## Problem

A bilingual document can pass pairing and structural checks while using awkward sentences or unclear subjects. A link to the writing guide makes it available, but does not establish when an Agent must apply it.

## Decision

The [pre-commit workflow](../../../../docs/testing.md#before-committing) requires the Agent to read the [writing guide](../../../skills/bilingual-syntax-style-guide/SKILL.md) and review changed prose in context before updating pairing records. The delivery and documentation skills lead to this review. The delivery report distinguishes the prose review from automated check results.

The guide retains its supplied wording and existing file format, as recorded in the [writing-skill decision](2026-09-12-verbatim-writing-skill.md).

## Alternatives considered

Keeping only the general writing reminder leaves review timing unspecified. A list of prohibited words cannot judge whether a sentence names the right actor or preserves technical meaning. A Git hook cannot establish that this review took place.

## Consequences

The Agent reviews changed prose in context and leaves unrelated documents outside the review. Changes without prose do not require this step. The review uses the existing delivery workflow and adds no automated style score or user approval step.
