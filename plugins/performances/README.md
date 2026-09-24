# Performances

English | [中文](README.zh.md)

This plugin starts moderator conversations from complete frozen revision artifacts. It uses the [revision reader and executor](../playbook-compiler/README.md) and [shared playbook workspaces](../playbook-workspaces/README.md). Starting a performance initializes its context without compiling or requesting a model response.
## Starting and continuing

The overview, revision page and performance mode share one start dialog. It selects the greatest revision ordinal unless a historical revision is specified, then selects the first frozen target by default. A newer revision without artifacts disables starting rather than selecting an older one. Model choices and defaults come from DSH.

Initialization records source identities, names, description, attachment identity, the full artifact and a checksum. Stable session identity makes retries idempotent, including after source deletion. Pending or malformed initialization rejects input. Mode, revision and artifact remain fixed.

Authored assistant text appears as opening prose; authored user text appears as background. System text is inspectable. Names and producer labels do not enter message bodies. The first real user input starts the model. DSH logs the original roles, order and content without inventing model attempts or usage. Stable message identities prevent duplicate openings after reload or Fork.

## Function calls and durable state

Each performance starts with its own copy of initial state. Frozen function names, descriptions and parameter schemas register in its Agent scope and unload with that scope. Native DSH tools display arguments, raw results and ordinary errors. There is no default state-query tool, automatic state appendix or extra prompt. Authors expose the information they need through function return values or query functions.

Calls serialize within a performance. A call's identity is its logged tool-call sequence, with the original call ID and parsed arguments. Successful execution validates candidate state, return value and complete record size, then appends one papermoon.performance.action configuration record containing the call, result, resulting state and predecessor checksum. Session persistence must acknowledge the record before the result is returned. A repeated invocation of the same logged call returns its original result; a separate call can execute again.

Throws, cancellation, timeout and validation failure before append leave state unchanged. Cancellation after commit does not undo it. If persistence cannot confirm a commit, the actor stops further calls and records a delivery-failure marker before the host's error receipt. It does not claim rollback or rerun the function. Reload reads whichever complete records survived storage; it never rebuilds state by replaying functions.

Recovery replaces interrupted or cancelled tool receipts with their recorded committed results, using DSH's surface-replacement mechanism. A delivery-failure marker also identifies the plugin's persistence error without matching error prose. The old receipt remains in the immutable log; earlier requests remain reconstructable. Other tool-policy failures are preserved. Recovery itself requires persistence confirmation. An active actor with unconfirmed persistence remains blocked until its runtime actor is reloaded from storage.

Fork inherits the selected log prefix's state and then advances independently. Deleting source content does not affect sessions holding their own artifact. A corrupt source attachment prevents new starts; a damaged session artifact or action chain prevents continuing. Neither is repaired or recompiled.

## Interfaces and inspection

Authenticated routes under /api/papermoon-performances expose playbooks, models, choices, state and start. Performances provides the same internal operations. Session configuration holds initialization, committed actions and failed-delivery markers; these records do not automatically enter model history. Model history contains authored messages and the ordinary tool receipts.

The header source menu offers readonly current state and action inspection. Committed actions also appear in trajectory. Compiler and revision previews show initial state and generated function declarations. The UI uses PaperMoon components and DSH theme variables; parameters and returns retain the standard DSH tool presentation.

State inspection follows the current session’s action events, refreshes when a commit arrives or history reloads, and releases its subscription when the session changes or the plugin unloads.

The composition contains no coding guidance, automatic compaction or result-file clipping. Explicitly mounted plugins retain their ordinary logged contributions. Closing cancels and drains function calls, unregisters tools and releases prompt contributions. Shared playbook workspaces retain writer and moderator conversations together.

## Verification

Temporary-database tests cover raw returns, thrown failures, serial commits, deduplication, interrupted receipts, failed persistence, damaged history and independent Fork state. Real DSH integration closes the compiler before starting, checks native requests and scoped tools, acknowledges records and verifies cleanup. Browser cases cover declarations, tool history, state inspection, refresh, source deletion and narrow layouts. Test servers use isolated data and are stopped; no check calls a real model.

Moderator replies remain visible in Compact conversation display, including replies preceding a function call. Reasoning and tool details remain in the expandable process group. This profile setting does not change ordinary DSH conversation display or model requests.

## Worldlines

One Session retains an immutable tree of completed executions. Its root references frozen initialization; each subsequent node holds one admitted input and all model steps, tool actions and the final outcome. Failed, cancelled and interrupted executions also become nodes. The Trajectory tab places a compact worldline tree beside the complete DSH ledger. The tree pages nodes in creation order, separately from the current path and inspected node. Selecting a node or a historical result in this view changes only the inspected node. Only “Switch to here” changes execution position, selecting that exact node. The worldline view does not offer reroll. Current-position badges, highlighted inspection rows and the primary switch button distinguish browsing from activation. Background updates preserve the node being inspected.

Continue from here selects exactly one node; the next send creates its child. Reroll reuses the original input from its parent and creates a sibling. Editing a sent user message starts a new sibling execution from its parent with the revised input. The original node and its descendants remain unchanged; attachments are retained. Historical-result switching in chat remembers the last selected descendant of that candidate. Editing and reroll preserve the unsent composer draft. Normal sending, reroll and sent-message editing submit user-authored input through the same DSH admission pipeline. Each execution has a fresh message and request identity; worldline records retain its source node. Reroll restores the parent before context assembly and does not reuse old upload receipts. Validation finishes before the worldline persists acceptance. An interrupted input retains its user identity even when no DSH turn started.

Operation IDs deduplicate durable intentions, while selection versions reject stale windows. Sending and switching share Agent maintenance with admission. During generation, the composer remains editable but rejects sending, queueing and steering. Pending execution appears as a status, not a mutable tree node. Completion waits for tool receipt recovery and persistence before sealing the node and selecting it in one record. Unfinished restored executions seal as interrupted; functions never replay. Accepted input that never entered a model step retains its user source in a context/message record and appears with an interruption indicator, without a fabricated reply. Missing receipts or uncertain persistence block further operations.

The required history/selected event carries PaperMoon node and selection facts. Chat, prompt reconstruction and action state read the selected ancestry plus the live execution; trajectory reads its separate inspection position. Raw logs and usage retain every execution. Each initialized performance has a worldline root; reads and actions require its selected path.

The tree route pages immutable summaries by offset and limit (at most 100); node returns a full node, sibling summaries, ancestor records and state. Sibling summaries include results outside the active path. Operation accepts select, candidate, edit or reroll with an operationId and expectedVersion; edit also requires the replacement text. State includes the current path and nodes needed by its action controls. Reads do not change the selection. These routes share the existing authenticated API.

Worldline history, context assembly and actual requests have separate identities. The default composition uses complete selected history; playbooks can supply their own composition. Recorded requests reconstruct their original inputs after later switches. Summarization is not provided. [The decision](../../.agents/notes/implemented/architecture/2026-09-16-worldlines.md) records the ownership and alternatives.

## Actual context

Each worldline execution fixes its parent state and input before composing context. The [playbook API](../playbook-compiler/api.md#context-composition) controls reference order and authored prompts. Request-local records preserve the plan, artifact and run identities, state position, source hashes and ordered references. Continuations cite the first record plus their execution-message references. Persistence must confirm the record before model dispatch. Uncertain persistence blocks sending and switching until the actor is reopened from durable data.

Trajectory has Original context and Rewritten context modes. Original context shows frozen opening messages followed by the ancestor path through the inspected node. Rewritten context shows that execution’s saved base once, in composition order, followed by every model step, tool result and outcome in that execution. Historical references retain their source identities and do not add timing or usage. Record details retain request inspection, attachments, reasoning, tools and copy controls. A source link changes inspection only.

A floor counts depth from the root: the first input is floor 1, and siblings share a floor. DSH turns keep their real chronological numbers. An accepted input interrupted before turn/start has a floor but no invented turn. Multiple DSH turns or conflicting request ownership inside one execution fail inspection. The root represents initial context and has neither number.

The frozen artifact determines mode availability. Custom composition defaults to Rewritten context; other performances and the root use Original context. Session-local navigation remembers inspection position, mode and collapsed tree state. The tree animates its width and preserves row geometry when selection changes; reduced-motion preferences disable transitions. Running executions have a separate live entry; sealing retains its execution identity. Later updates do not select a different inspected node. Chat keeps player messages, moderator replies and compact reply actions. Reroll and continuation use icon buttons; historical results have previous/next controls and a numbered menu. Composed context appears only in Trajectory, not as an extra Chat entry.

Authenticated inspection reads one node or pending execution with mode, limit and a snapshot-bound cursor. Pages retain the same log endpoint even if the Session advances. The request route reads a precise saved request by seq, including off-path requests. Reads neither execute composeContext nor select history. The [inspection decision](../../.agents/notes/implemented/architecture/2026-09-18-dual-trajectory.md) records the separation between inspection order, source identity and runtime position.
