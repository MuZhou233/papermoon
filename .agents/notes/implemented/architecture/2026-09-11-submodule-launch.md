# Agent Note: Pinned submodule and original launcher

Status: implemented

English | [中文](2026-09-11-submodule-launch.zh.md)

## Problem

A reproducible application base must coexist with independently maintained product plugins and preserve user runtime data during source reconstruction.

## Decision

The parent Gitlink pins official DSH. Ordered patches reconstruct its managed source; the initial series is empty. The original built Web CLI runs with the parent as working directory and separate default data homes. Automated dependency and build commands use the supported CI installation path to avoid development hook configuration inside a submodule.

## Alternatives considered

Keeping product code in the framework tree would mix ownership and delivery obligations. A second application boot implementation would duplicate DSH behavior. Defaulting the workspace to the submodule would place user work in a resettable checkout.

## Consequences

Upgrades explicitly update the Gitlink and patch evidence. Initialization discards unexported managed source changes while preserving ignored configuration and parent data. Build and launch are separate. Main and submodule checks retain independent scope; an applied patch alone is not delivery evidence.
