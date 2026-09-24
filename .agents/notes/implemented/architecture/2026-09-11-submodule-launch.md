# Agent Note: Pinned submodule and original launcher

Status: implemented

English | [中文](2026-09-11-submodule-launch.zh.md)

## Problem

PaperMoon must be able to reconstruct the application source while maintaining product plugins independently. Reconstructing source must preserve users’ runtime data.

## Decision

The parent Gitlink pins official DSH. Ordered patches reconstruct its managed source; the initial series is empty. The original built Web CLI runs with the parent as working directory and separate default data homes. Automated dependency and build commands use the supported CI installation path to avoid development hook configuration inside a submodule.

## Alternatives considered

Keeping product code in the framework tree would mix ownership and delivery obligations. A second application boot implementation would duplicate DSH behavior. Defaulting the workspace to the submodule would place user work in a resettable checkout.

## Consequences

Upgrades explicitly update the Gitlink and patch evidence. Initialization discards unexported managed source changes while preserving ignored configuration and parent data. Build and launch are separate. Main and submodule checks retain independent scope; an applied patch alone is not delivery evidence.

The [manual-editor decision](2026-09-12-manual-playbook-editor.md) adds product composition to root startup while retaining an original-Web command; the submodule and process-ownership decisions here still apply.

DSH checks retain setup’s CI package-manager environment. This keeps the submodule dependency layout stable when the parent is invoked interactively.

The [patch-maintenance decision](2026-09-18-patch-maintenance.md) defines responsibility-owned differences and when to consider promoting a patch to a plugin; this Note's pinned-source and runtime-data decisions remain in force.
