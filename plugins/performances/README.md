# Text performances

English | [中文](README.zh.md)

This plugin starts moderator conversations from a revision's frozen opening artifact. It depends on the [revision reader](../story-compiler/README.md), text runtime and [shared script workspaces](../story-workspaces/README.md). It imports no compiler execution entry or Worker. Starting a conversation makes no model request.

## Starting and continuing

The overview, revision page and performance mode use one start dialog. It selects the latest revision by ordinal unless a historical revision is specified. The first frozen target is the default. A newer revision with no artifacts disables starting; it does not select an older usable revision. The model catalog and defaults come from DSH.

Initialization records the script and revision identities, names, description, attachment key, complete artifact, original session identity and integrity hash. The stable session ID makes retries idempotent, including after source deletion. A pending or malformed initialization rejects input. Version, artifact and mode remain fixed; changing language or version requires another conversation.

Authored assistant text appears as the opening; authored user text appears as background. Names and producer labels stay outside message bodies. System text is inspectable. Empty messages and repeated roles are preserved. The first real user message starts the model. DSH logs the exact initial roles for request reconstruction without inventing model attempts or usage. Initialization and later authored-context records share a stable display identity for refresh, pagination and copying.

The moderator composition contains no script tools, coding instructions, automatic compaction or result-file clipping. Other explicitly mounted plugins use ordinary logged extension points. Fork and resume use the retained initialization, including after the source is deleted. A corrupt original attachment prevents new starts but does not invalidate an existing session's complete copy. A corrupt session copy fails; neither path recompiles or repairs data.

## Interfaces and lifecycle

The authenticated routes under /api/papermoon-performances expose scripts, models, choices, state and start. Performances offers the same internal operations. Registration, admission guards and per-Agent prompt contributions are effects. Closing the service waits for active initialization before disposing contributions. The shared workspace provider retains writer and moderator conversations together; source deletion preserves their history.

The browser uses PaperMoon UI and DSH theme variables. Source information belongs in the session header. Initialization is visible in trajectory separately from actual model requests; only the latter contribute model usage. The DSH patch supplies generic list and search presentation, without interpreting script data.

## Verification

Unit tests use temporary SQLite files and stop compilation before exercising artifact-only initialization. pnpm test:writer-sessions uses real DSH with a deterministic adapter to check the opening before the first request, exact roles, empty content, tool absence, reload, Fork, source deletion and narrow layouts. It owns and stops its temporary Web server. No check uses user data or real models.
