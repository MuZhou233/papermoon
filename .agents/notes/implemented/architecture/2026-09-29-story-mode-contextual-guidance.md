# Agent Note: Story guidance in the Playbook context

Status: implemented

English | [中文](2026-09-29-story-mode-contextual-guidance.zh.md)

## Problem

A story save spans editing, writer conversations and performances. Replacing left navigation with a chapter list hides the routes between those activities. Longer teaching needs a stable reading surface beside the work, including on an editor page with no Session.

## Decision

The [shared requirements](../../../../docs/story-mode/README.md#shared-interaction) place full teaching and examples in the right Story Guide. Left navigation and central tools keep their normal responsibilities. The [save decision](2026-09-28-storyline-playbook-saves.md) owns progress, and the [authoring decision](2026-09-29-plaintext-playbook-authoring.md) owns permissions. Visibility changes presentation only.

The registered DSH sidebar patch adds page contexts beside real Session contexts, sharing tabs, dock rendering, width and fullscreen layout. PaperMoon resolves the active editor or associated writer/performance to its Playbook. Passive tab registration preserves the selected tool and expansion. Creation leaves the sidebar collapsed with a hint pointing to the native expand button, letting the user open the guide. Explicit continuation of an existing save opens the guide. Unseen updates produce a notice beside expansion or an unread tab marker, cleared after current content is displayed. Reading and acknowledgement preferences stay separate from progress. Generation checks isolate delayed replies after save switches.

Short [anchored hints](../../../../plugins/ui-guidance/README.md) point at real controls while the full lesson stays in the guide. Hints support dismissal, keyboard operation and redisplay. Narrow screens close the fullscreen guide before locating external controls and retain a return entrance and reading position. Native session pages own conversation, input, model controls and trajectory.

The entrance and guide use DSH theme tokens and shared controls, with a compact header and footer that leave scrollable space for long lessons. Examples reuse the `PromptTrace` trajectory rows and literal details; display labels preserve each section’s terminology sequence. New capabilities show a Newly unlocked tag beside central controls and emphasize the corresponding editor area until the related result is saved or performance starts. These cues derive from existing save state.

Five sections follow conceptual prerequisites: input/reply, messages/context, system instructions, content placement/model differences and reasoning/performance. Teaching develops concepts and suggestions independently; examples and analysis follow it. The same lighthouse-keeper material acquires role labels, system instructions and placement variations. Openings unlock before system text to match this sequence. Comparison remains optional practice.

The text-authority rule keeps complete bilingual copy in requirements. Technical inspiration for model formats remains the [Hugging Face chat-template guide](https://huggingface.co/docs/transformers/chat_templating) and [Gemma format guide](https://ai.google.dev/gemma/docs/core/prompt-structure). These support the engineering distinction between role semantics and model input formats; teaching introduces the concepts progressively and treats unusual content placement as a possible creative choice whose effects can be compared.

## Alternatives considered

Left-side replacement would hide ordinary navigation. A central lesson page would require leaving the work to read. Complete lessons in hints would attach long text to moving controls. A second right column would compete with existing tools. One shared guide surface plus short hints supports reading alongside operations.

Automatic opening after creation would immediately occupy editor space. A hint at the expand button identifies the entrance and lets users decide when to read. Automatic reopening on progress would interrupt writing and replace a selected tool. A reminder preserves user choices. Fake Sessions would give Playbook guidance an unrelated execution identity; keeping progress in a panel would create another authority. Page contexts and display preferences preserve those boundaries.

The former three-entry teaching structure scattered prerequisite concepts; adding one introduction would retain that problem. Five conceptual sections align explanation and practice. Forward references to examples would make exposition depend on later text. Extracting hints from paragraph positions would couple prose revisions to control guidance. Separate hint text and examples following teaching keep those responsibilities clear.

Leaving copy to runtime implementation would reopen product-writing decisions and permit drift. Requirements remain the source for teaching, examples, controls and states.

## Consequences

The sidebar's direct package contracts and tests travel in its registered patch. Model admission belongs to the session-controller patch. The client-runtime assembly helper recognizes the package that owns its bundle before resolving dependencies, allowing actual host tests to load the self-owned webapp bundle; its regression joins the registered checks. Main-repository Notes own these patch decisions.

Sidebar tests verify independent surfaces, passive registration, selected-tool retention and layout behavior. The deterministic chapter browser verifies creation hints and manual opening, keyboard selection of trajectory examples, capability cues and their completion conditions, session-free editing, cross-page context, save isolation, collapsed reminders, keyboard dismissal and fullscreen return. Product copy is checked against active requirements. Hidden or collapsed guidance leaves authorization and completion conditions unchanged.

The host bundle reads writer-session ownership through the writer schema, so Story Mode declares `@papermoon/writers` as a runtime dependency. Build verification checks retained external imports against the emitting plugin’s manifest. A regression exercises imports introduced by bundled sibling sources; this check remains effective even when a stale local workspace link would let an import succeed.
