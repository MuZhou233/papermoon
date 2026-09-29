# Agent Note: Story Mode layers

Status: implemented

English | [中文](2026-09-25-story-mode-layers.zh.md)

## Problem

Chapter-driven development needs reusable runtime mechanisms with clear ownership. Guidance, native conversation and trajectory inspection must remain consistent across product features while each chapter owns its teaching and progression.

## Decision

PaperMoon has platform, extension and Story Mode layers. DSH patches belong to the platform; extensions own reusable plugins; Story Mode owns chapter content and exclusive progression policy. Dependencies point downward and preserve directory ownership. [Architecture](../../../../docs/architecture.md) maintains the responsibility map, and the [naming decision](2026-09-24-playbook-and-story-mode.md) owns product terminology.

The native PaperMoon profile composes extension and switchable Story Mode bundles independently. DSH owns installation, enablement, reload and persistent user choices. The original Web profile retains its own configuration. Settings and runtime data remain outside managed source and are explicitly configured by their owner.

Native Session navigation owns headers, views, input and request history. General settings navigation, New Session interception, per-Session page leases, stable view anchors and displayed-view observation belong to reusable platform seams. Leases combine multiple owners and release only their own constraints. Explicit private-session references can expose native pages while staying outside workspace catalogs, search and cold adoption. The controller admits the owner's input and model choices; readonly exposure protects prepared records. Shared inspection projection remains useful to worldline inspection.

The text-conversation extension remains a reusable literal-prompt, tool-free Agent owner with model metadata and durable request inspection. Product layers determine when to use it. The current first chapter uses ordinary Playbook performances through the [save decision](2026-09-28-storyline-playbook-saves.md); the old chapter-specific example, attempt file and restart code are removed.

Anchored overlays belong to the guidance extension. They track actual DOM visibility, geometry, clipping and occlusion, and expose keyboard dismissal without simulating control activation. Stable source-event anchors in native ledger rows allow owners to locate a particular response; aggregate rows retain no misleading event identity. Native view selection and general request inspection continue to use the platform's own records.

[Contextual guidance](2026-09-29-story-mode-contextual-guidance.md) now follows Playbooks on the right while preserving left navigation. [Authoring policy](2026-09-29-plaintext-playbook-authoring.md) supplies capability checks, and the [effort decision](../simplification/2026-09-25-story-mode-effort-guidance.md) preserves user choice. Requirements own complete bilingual text independently of implementation.

## Alternatives considered

A launcher overlay would override plugin choices; native bundles let DSH own toggles and reload. Putting general conversation mechanisms in Story Mode would reverse dependencies. A parallel conversation or trajectory renderer would drift from native behavior. Embedding only conversation content or wrapping a full page would bypass ordinary navigation and header state.

Fabricated client Session bindings bypass lifecycle and history validation. Prepared readonly records require a valid Session and explicit ownership when that general capability is used. Real module records preserve request boundaries without a parallel transcript format. Native row anchors provide precise visibility without reconstructing history on the client.

Locking effort is rejected in its owning decision. Treating visits to settings as preparation would impose an action even when a valid model already exists; current availability and explicit selection provide meaningful gates. Basing progress on the latest response would make continued conversation move the learning target; a durable first qualifying reply preserves progress after later failures.

## Consequences

Reusable platform and extension capabilities remain independent of chapter removal. Story policy can unload while preserving saved content and sessions. Protected story operations wait for the provider to return. Main-repository Notes own patch rationale; direct contracts and tests travel with registered DSH patches.

Validation uses main tests, managed DSH source checks and deterministic hosted integration/browser tests. Temporary data exercises actual requests and native pages. Existing runtime files remain untouched under the current-format policy; historical tutorial behavior remains in Git.
