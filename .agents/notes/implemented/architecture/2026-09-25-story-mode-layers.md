# Agent Note: Story Mode layers and chapter zero

Status: implemented

English | [中文](2026-09-25-story-mode-layers.zh.md)

## Problem

Chapter-driven development must guide the real product experience without accumulating general runtime mechanisms inside a chapter plugin. Chapter 0 also needs a fixed example that can use the same trajectory interactions as a real conversation, while remaining outside the real exercise history.

## Decision

Adopt three responsibility layers: platform, extensions and Story Mode. Every DSH patch belongs to the platform. Extensions own reusable functionality as plugins; Story Mode owns only chapter content and exclusive experience rules. Dependencies point downward without relocating existing directories. [Architecture](../../../../docs/architecture.md) owns the maintained map.

The text-conversation extension composes DSH Agents with a complete literal prompt, no inherited runtime context and no tools. It provides model metadata, selection and durable request inspection, without a client page. The consuming Story Mode plugin owns Agent lifetime, progress and step admission. Sessions without a workspace root stay out of ordinary list, search and cold adoption. Their owner may expose a live Agent to native Session controls; explicit client addresses retain it without a catalog entry. This closes its previous live/cold visibility inconsistency without adding a product session format or disguising practices as subagents.

The platform adds settings navigation with mounted-section acknowledgement, an effect-owned New Session interceptor, per-Session native page constraints, displayed-view observation and stable view-tab anchors. Upstream only exposes Trajectory through a global developer setting and cannot constrain one native page for an owning plugin. Temporary owner leases fill that gap for chapter examples and practices without changing global preferences. Header and body use the same Session-specific view roster and ordinary selection store. Existing slot priority supports sidebar replacement without a patch. The reusable anchored overlay belongs to the UI guidance extension; Story Mode owns its target, wording and advancement condition.

The launcher uses native DSH bundles in a dedicated PaperMoon profile. The extension bundle stays independent of the switchable Story Mode bundle; disabling Story Mode keeps its installed card available, drains its practice Agent and preserves progress. User bundle choices survive launch and HMR. The former Web profile remains untouched for the original-Web command; no configuration or data is copied automatically.

This implements the boundary established by the [Playbook and Story Mode decision](2026-09-24-playbook-and-story-mode.md). The [effort-guidance decision](../simplification/2026-09-25-story-mode-effort-guidance.md) remains authoritative: advice observes model capability and selection, never locks or overrides a request. The [chapter documents](../../../../docs/story-mode/README.md) own interaction requirements and do not track delivery status.

Example and practice Sessions enter the default page through `uiWorkspace.openSession`; Story Mode never supplies a parallel SessionProvider, computes the page phase or forces a view. Chapter activity survives settings and view navigation. Only entering, changing the target Session or explicitly requesting New Session performs navigation. The chapter list and main-area introduction remain chapter-owned; operational guidance, configuration feedback and Continue live in the focused sidebar subsection.

Upstream main-page discovery reads retained Session metadata. Explicit private addresses therefore publish reference metadata in the Client's `byId` lookup while remaining absent from ordinary `ids`, Host list, search and cold adoption. This preserves default mounting and browser-title behavior without disguising practices as subagents. The native header also reads its own title projection. The controller enforces example immutability and consumer prompt admission; private model selection never changes defaults. Page leases hide tools and file intake and interpret slash/reference input literally. Releasing one lease preserves other owners' constraints.

The fixed example uses a separate, valid, readonly DSH Session seed with zero timestamps and no usage, created and restored without inference. Chat and trajectory read the same prompt and messages; none enter the practice Session. The earlier text-conversation page and standalone readonly trajectory factory have been removed. General explicit inspection projection remains because worldline inspection consumes it.

Both trajectory steps keep the current conversation. A reusable overlay highlights the native tab, waits for a visible target and follows geometry changes without clicking or moving focus. Escape dismisses it, and sidebar guidance can restore it. Inspection requires both a ready native view and the target reply's visible ledger row; background projection, entering the step and showing/dismissing the hint do not. Native view selection persists across refresh. Chapter exit and plugin teardown release hints, constraints and the selected private page.

The introduction now reads current configuration rather than persisting a settings-visit flag or a selected route in chapter progress. Any configured model permits manual advancement. Configuration read failures remain retryable, and the introduction does not make inference requests. New practice creation pins only a valid existing selection; otherwise the native selector owns the user's choice. This avoids silently choosing another model when the default is absent or invalid.

The first completed practice turn fixes the inspection target independently of the Agent's latest request. Page constraints keep the practice writable during inspection and after completion; native execution state controls sending and stopping. Later failures leave completed progress intact. Progress stores the first successful turn and inspection acknowledgement, while DSH stores selection and conversation history. Obsolete progress fields are removed without migration or rewriting saved attempts.

Ready-view observation alone cannot identify which exchange a user has seen after continuing a conversation. The trajectory patch therefore adds a source-event sequence attribute to individual native ledger rows, omitting aggregate summary rows. The guidance extension observes actual DOM visibility, including clipping and occlusion, while Story Mode supplies the target Session and first reply sequence. Both trajectory subsections consume this anchor. This small platform extension avoids a parallel trajectory renderer or client-side history reconstruction. Browser regression covers a later reply visible at the native ledger tail before the first reply is scrolled into view.

Host and Client share requirement-owned copy. Story RPC errors identify localized messages by key; unrelated failures keep their underlying text. Unit checks compare owned strings and the fixed example against both languages' requirements. Native placeholders introduced for chapter constraints also have explicit requirement text. This enforces the existing text-authority decision without moving requirement authorship into implementation.

## Alternatives considered

Keeping the product composition as a launcher overlay would place it above user plugin choices. Native bundle composition gives DSH ownership of toggles and reload. Placing all conversation logic in Story Mode would make reusable mechanisms depend on chapter policy. Duplicating conversation or trajectory rendering would drift from DSH. Embedding only `conversation.content`, or wrapping a full page in another chapter page, also bypasses normal navigation and shared header state. Native navigation with scoped restrictions preserves the experience users are learning. A fabricated client Session binding would bypass lifecycle and history validation. A valid prepared Session with explicit readonly ownership keeps those guarantees while sidebar guidance distinguishes sample records from real execution.

Locking effort was rejected in the separate guidance decision. The example remains hardcoded; only the real exercise uses the model. Existing DSH persistence and request-boundary records avoid a parallel product transcript format and migration machinery.

## Consequences

Story Mode can be removed without removing the text-conversation extension. Its saved attempts bind progress to one practice session and reject stale actions after restart. Restart allocates a fresh practice and retains previous session files. The platform stays free of chapter names and content, and previously implemented chapters must remain completable after later changes.

Validation uses main unit tests, actual managed DSH builds and deterministic integration/browser tests. No copied source tree or paid model request stands in for the hosted implementation. Settings from the former Web profile are not silently imported into the PaperMoon profile; users configure it through the normal settings UI.
