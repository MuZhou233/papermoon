# Agent Note: Independent main-repository maintenance

Status: implemented

English | [中文](2026-09-11-independent-maintenance.zh.md)

## Problem

PaperMoon needs complete maintenance infrastructure without coupling each product iteration to DSH internal delivery rules.

## Decision

The main repository owns its engineering rules, bilingual documentation, adapted checkers and complete Agent Note lifecycle. Effective DSH patches use submodule rules; their decisions are not duplicated in parent Notes. Checks and CI are explicit, with no custom main hook installer.

## Alternatives considered

Blanket inheritance would make framework-internal policies govern unrelated main code. Calling private submodule checkers would couple maintenance upgrades to runtime upgrades. Deferring archive checks would leave existing decisions without enforced lifecycle protection.

## Consequences

The parent maintains a small independent checker codebase and its provenance. Hashes and structure are mechanical checks; editorial quality and complete consolidation remain reviewed judgments. A frozen archive protects established records against both content and manifest rewrites.
