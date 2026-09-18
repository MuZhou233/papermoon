# Agent Note: Independent main-repository maintenance

Status: implemented

English | [中文](2026-09-11-independent-maintenance.zh.md)

## Problem

PaperMoon needs a complete set of maintenance tools and rules. Product work in the main repository should not have to follow DSH’s internal delivery requirements.

## Decision

The main repository owns its engineering rules, bilingual documentation, adapted checkers and complete Agent Note lifecycle. Effective DSH patches retain its code and runtime constraints; the [patch-maintenance decision](../architecture/2026-09-18-patch-maintenance.md) defines documentation, decision ownership and delivery scope. Checks and CI are explicit, with no custom main hook installer.

## Alternatives considered

Inheriting all DSH rules would apply its internal policies to unrelated main-repository code. Calling private submodule checkers would tie maintenance-tool upgrades to runtime upgrades. Deferring archive checks would allow sealed decisions to be changed without detection.

## Consequences

The parent maintains a small independent checker codebase and its provenance. Hashes and structure are mechanical checks; editorial quality and complete consolidation remain reviewed judgments. A frozen archive protects established records against both content and manifest rewrites.
