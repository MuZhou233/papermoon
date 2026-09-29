# Agent Note: Story Mode effort selection

Status: implemented

English | [中文](2026-09-25-story-mode-effort-guidance.zh.md)

## Problem

The former minimum-effort rule required inferring an order across models and enforcing it in requests. Different models expose different options and behavior, while the chapter's goal is to let users explore their own character.

## Decision

The [first-character lesson](../../../../docs/story-mode/fogbound-earthshine/01/05-reasoning-effort-and-first-performance.md) explains reasoning effort and lets users choose any supported option. Models with no adjustable effort remain usable. The chapter reads native model capabilities and validates supported selections; the current performance owns the choice and global defaults remain unchanged. The [layering decision](../architecture/2026-09-25-story-mode-layers.md) owns integration.

## Alternatives considered

A minimum lock would require additional ordering and enforcement. Automatic selection would change the user's preference. Explaining the possible effects while allowing supported choices makes the lesson's model behavior observable without adding a particular effort level to completion conditions.

## Consequences

Tests cover supported and unavailable choices and the no-adjustable-effort path. The first durable complete body reply and successful chapter submission determine completion. Current requirements own the complete bilingual explanation and exact UI wording; retired advice and chapter-specific tests remain in Git.
