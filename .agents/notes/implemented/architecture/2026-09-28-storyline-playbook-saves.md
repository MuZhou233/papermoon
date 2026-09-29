# Agent Note: Storyline saves in Playbooks

Status: implemented

English | [中文](2026-09-28-storyline-playbook-saves.zh.md)

## Problem

Independent stories need a save identity that owns both authored content and learning progress. An installation-level attempt cannot represent several saves, and separate progress persistence would make chapter completion depend on coordinating two authorities.

## Decision

Each story save is a Playbook with an immutable storyline binding and protected progress in its draft metadata. [Shared requirements](../../../../docs/story-mode/design.md) own behavior; [Fogbound Earthshine](../../../../docs/story-mode/fogbound-earthshine/README.md) begins with Your First Character. Saves appear in both story and ordinary catalogs. The [authoring decision](2026-09-29-plaintext-playbook-authoring.md) supplies shared authorization; the [guide decision](2026-09-29-story-mode-contextual-guidance.md) supplies contextual presentation. These decisions retain the naming and downward dependencies of the [earlier architecture](2026-09-25-story-mode-layers.md).

Startup freezes saved content and compilation in an ordinary untagged revision. Protected progress reserves its actual performance Session so retries resume the same execution. Model choices and conversation records stay in their owning modules. A durable completed turn containing model body text qualifies the chapter; authored openings, partial output, reasoning-only output and failed turns do not qualify.

Storage can commit from the retained startup revision. Its transaction writes a chapter revision, unique Playbook/storyline/chapter tag and updated progress together, retaining newer draft values. Repeated completion or retry returns the existing tagged result. Failed submission keeps the chapter incomplete and reuses the saved successful response on retry.

Chapter attachments freeze the bilingual teaching and examples and reference the successful worldline path with inclusive record boundaries. Review reads those values and bounded logs independently of execution; it preserves the active draft, progress and performance selection. Missing records remain explicit. The first chapter retains continued conversation and exposes the second chapter's unavailable state.

## Alternatives considered

A separate story file or database would add a second authority. Copying full session logs or model configuration into Playbooks would duplicate module storage; references preserve ownership without promising standalone exports. Taking the latest draft at completion would tag unperformed edits, while restoring the startup draft would discard later work.

In-place restart and chapter restoration would change the save being reviewed. Independent new saves provide fresh starts, and read-only review preserves current state. Interactive replay would require another execution identity and model requests beyond the selected review behavior.

Hiding story saves from ordinary Playbook features would prevent staged teaching of those features. Unrestricted ordinary operations would bypass the stage. Shared policy permits each feature at its authored stage. Keeping retired chapter requirements, code or copy fixtures would maintain obsolete behavior; current-format replacement leaves historical material to Git.

## Consequences

Playbook storage is the sole authority for progress and chapter identity. Policy absence pauses protected operations. Startup and chapter submission have different snapshots, which preserves both performed content and work in progress. Existing runtime files remain untouched under the [current-format policy](../../../../docs/development.md#frozen-revision-data).

Storage tests exercise transaction rollback and unique-tag retries. Story tests cover isolated saves, guarded routes, restart recovery, concurrent completion and retry from a saved success. The deterministic browser chapter verifies actual request order, later draft retention, bounded review and completed progress after refresh. Package contracts own the concrete APIs; requirements continue to own exact bilingual copy.
