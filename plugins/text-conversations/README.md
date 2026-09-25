# Text conversations

English | [中文](README.zh.md)

This extension provides tool-free, plugin-owned conversations through DSH Agents. It has no chapter definitions or progress policy and remains available when Story Mode is disabled.

## Host service

`textConversations.models()` reads model metadata and configured credential availability without making an inference request. `validate()` checks a selected route and removes effort for models that do not expose it. It never selects a lowest effort.

`open(owner, input)` creates or resumes a DSH Agent under the consuming plugin's traced Agent registry. The caller owns the session ID, literal system prompt, selected model and durable references. A complete scoped prompt suppresses inherited runtime context, and an empty scoped tool allowlist keeps tools out of the request. Selection affects this Agent only. Callers must serialize their own actions and dispose the returned handle when its purpose ends; DSH owner teardown also stops and drains it.

Sessions have no workspace root. The ordinary DSH session controller excludes them from list, search and cold adoption; the owning plugin restores them through this service. The optional `native` policy explicitly exposes a live Agent to native history and prompt/model controls, with optional prompt admission and host-enforced readonly access. Private model changes never update global defaults. An optional `seed` supplies prepared Session records when creating an Agent; it does not invoke a model. DSH remains responsible for session encoding, persistence and interrupted-turn recovery. Request boundary records use DSH's existing protocol to inspect the history at dispatch time without copying or rewriting messages.

## Native navigation

This extension has no client page. Consumers open exposed Sessions through `uiWorkspace.openSession({ kind: 'session', sessionId })`, which uses the default Conversation page, header, tabs and Session binding. An optional `title` pins the initial title in the Session log; the native header can read it without ordinary list membership.

Consumers acquire `uiConversation.pages.constrain(sessionId, policy)` for temporary text-only or readonly presentation and release it with their own lifecycle. Native model/effort controls remain freely selectable unless readonly; the Host remains responsible for request admission. This separates general text execution from each consumer's page policy.

Native callers may omit `choice` when there is no valid current selection. Creation then records no replacement selection; the native model control owns subsequent choices. `defaultSelection()` reads the existing global choice without validating or changing it. `view().choice` reports the Session's latest selection or request configuration, falling back to the current default when no local selection exists. `view().successfulTurn` identifies the first completed turn, so later requests cannot move a consumer's initial success reference. It does not imply that the latest request succeeded.

## Verification

`node plugins/text-conversations/integration/runtime.mjs` runs against built DSH services in the managed checkout with a deterministic adapter and temporary persistence. It checks exact requests, historical inspection, effort, isolation, cancellation and restoration.
