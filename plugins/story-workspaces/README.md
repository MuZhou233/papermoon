# Shared script workspaces

English | [中文](README.zh.md)

The papermoon-script provider groups [writer](../writer-sessions/README.md) and [performance](../performances/README.md) sessions by stable script identity. It resolves the script name separately from the configured absolute process cwd. Script IDs never become filesystem paths.

StoryWorkspaces registers consumer-owned session readers, checks membership from live or persisted records, lists script choices and refreshes workspace titles. A consumer must register through an effect and remove its reader during teardown. The plugin owns the single provider registration; session plugins own their preparation and frozen configuration.

Removing a workspace registration does not remove the script. A deleted script cannot supply a new target, but retained session records still identify their workspace. Each session consumer decides whether it can continue without the source. The default composition mounts storage and core before this provider, then mounts the two consumers.
