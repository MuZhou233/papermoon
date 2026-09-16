# Performances

English | [中文](README.zh.md)

This plugin starts moderator conversations from complete frozen revision artifacts. It uses the [revision reader and executor](../story-compiler/README.md) and [shared script workspaces](../story-workspaces/README.md). Starting a performance initializes its context without compiling or requesting a model response.
## Starting and continuing

The overview, revision page and performance mode share one start dialog. It selects the greatest revision ordinal unless a historical revision is specified, then selects the first frozen target by default. A newer revision without artifacts disables starting rather than selecting an older one. Model choices and defaults come from DSH.

Initialization format 2 records source identities, names, description, attachment identity, the full artifact and a checksum. Stable session identity makes retries idempotent, including after source deletion. Pending or malformed initialization rejects input. Mode, revision and artifact remain fixed. Format 1 is unsupported and is not migrated or recompiled.

Authored assistant text appears as opening prose; authored user text appears as background. System text is inspectable. Names and producer labels do not enter message bodies. The first real user input starts the model. DSH logs the original roles, order and content without inventing model attempts or usage. Stable message identities prevent duplicate openings after reload or Fork.

## Function calls and durable state

Each performance starts with its own copy of initial state. Frozen function names, descriptions and parameter schemas register in its Agent scope and unload with that scope. Native DSH tools display arguments, raw results and ordinary errors. There is no default state-query tool, automatic state appendix or extra prompt. Authors expose the information they need through function return values or query functions.

Calls serialize within a performance. A call's identity is its logged tool-call sequence, with the original call ID and parsed arguments. Successful execution validates candidate state, return value and complete record size, then appends one papermoon.performance.action configuration record containing the call, result, resulting state and predecessor checksum. Session persistence must acknowledge the record before the result is returned. A repeated invocation of the same logged call returns its original result; a separate call can execute again.

Throws, cancellation, timeout and validation failure before append leave state unchanged. Cancellation after commit does not undo it. If persistence cannot confirm a commit, the actor stops further calls and records a delivery-failure marker before the host's error receipt. It does not claim rollback or rerun the function. Reload reads whichever complete records survived storage; it never rebuilds state by replaying functions.

Recovery replaces interrupted or cancelled tool receipts with their recorded committed results, using DSH's surface-replacement mechanism. A delivery-failure marker also identifies the plugin's persistence error without matching error prose. The old receipt remains in the immutable log; earlier requests remain reconstructable. Other tool-policy failures are preserved. Recovery itself requires persistence confirmation. An active actor with unconfirmed persistence remains blocked until its runtime actor is reloaded from storage.

Fork inherits the selected log prefix's state and then advances independently. Deleting source content does not affect sessions holding their own artifact. A corrupt source attachment prevents new starts; a damaged session artifact or action chain prevents continuing. Neither is repaired or recompiled.

## Interfaces and inspection

Authenticated routes under /api/papermoon-performances expose scripts, models, choices, state and start. Performances provides the same internal operations. Session configuration holds initialization, committed actions and failed-delivery markers; these records do not automatically enter model history. Model history contains authored messages and the ordinary tool receipts.

The header source menu offers readonly current state and action inspection. Committed actions also appear in trajectory. Compiler and revision previews show initial state and generated function declarations. The UI uses PaperMoon components and DSH theme variables; parameters and returns retain the standard DSH tool presentation.

State inspection follows the current session’s action events, refreshes when a commit arrives or history reloads, and releases its subscription when the session changes or the plugin unloads.

The composition contains no coding guidance, automatic compaction or result-file clipping. Explicitly mounted plugins retain their ordinary logged contributions. Closing cancels and drains function calls, unregisters tools and releases prompt contributions. Shared script workspaces retain writer and moderator conversations together.

## Verification

Temporary-database tests cover raw returns, thrown failures, serial commits, deduplication, interrupted receipts, failed persistence, damaged history and independent Fork state. Real DSH integration closes the compiler before starting, checks native requests and scoped tools, acknowledges records and verifies cleanup. Browser cases cover declarations, tool history, state inspection, refresh, source deletion and narrow layouts. Test servers use isolated data and are stopped; no check calls a real model.

Moderator replies remain visible in Compact conversation display, including replies preceding a function call. Reasoning and tool details remain in the expandable process group. This profile setting does not change ordinary DSH conversation display or model requests.

## Worldlines

One Session retains an immutable tree of completed executions. Its root references frozen initialization; each subsequent node holds one admitted input and all model steps, tool actions and the final outcome. Failed, cancelled and interrupted executions also become nodes. The worldline view pages nodes in creation order, separately from the current path and inspected node. Selecting a node or a historical result in this view changes only the inspected node. Only “Switch to here” changes execution position, selecting that exact node. The worldline view does not offer reroll. Current-position badges, highlighted inspection rows and the primary switch button distinguish browsing from activation. Background updates preserve the node being inspected.

Continue from here selects exactly one node; the next send creates its child. Reroll reuses the original input from its parent and creates a sibling. Editing a sent user message starts a new sibling execution from its parent with the revised input. The original node and its descendants remain unchanged; attachments are retained. Historical-result switching in chat remembers the last selected descendant of that candidate. Editing and reroll preserve the unsent composer draft. Reused user input retains its logged provenance and user-bubble presentation.

Operation IDs deduplicate durable intentions, while selection versions reject stale windows. Sending and switching share Agent maintenance with admission. During generation, the composer remains editable but rejects sending, queueing and steering. Pending execution appears as a status, not a mutable tree node. Completion waits for tool receipt recovery and persistence before sealing the node and selecting it in one record. Unfinished restored executions seal as interrupted; functions never replay. Accepted input that never entered a model step is retained as sourced context and shown with an interruption indicator, without a fabricated reply. Missing receipts or uncertain persistence block further operations.

The required history/selected event carries versioned PaperMoon node and selection facts. Chat, trajectory, prompt reconstruction and action state read the selected ancestry plus the live execution. Raw logs and usage retain every execution. Existing performances without worldline facts remain readable but cannot continue. No historical tree is inferred; story content, artifacts and revision attachments retain their formats.

The tree route pages immutable summaries by offset and limit (at most 100); node returns a full node, sibling summaries, ancestor records and state. Sibling summaries include results outside the active path. Operation accepts select, candidate, edit or reroll with an operationId and expectedVersion; edit also requires the replacement text. State includes the current path and nodes needed by its action controls. Reads do not change the selection. These routes share the existing authenticated API.

Worldline history, context assembly and actual requests have separate identities. The default request uses the complete selected history. Recorded request prefixes reconstruct their original inputs even after later switches. Windowing, summaries and custom assembly are outside this implementation. [The decision](../../.agents/notes/implemented/architecture/2026-09-16-worldlines.md) records the ownership and alternatives.
