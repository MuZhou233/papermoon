# Shared playbook workspaces

English | [中文](README.zh.md)

The papermoon-playbook provider groups [writer](../writer-sessions/README.md) and [performance](../performances/README.md) sessions by stable playbook identity. It resolves the playbook name separately from the configured absolute process cwd. Playbook IDs never become filesystem paths.

PlaybookWorkspaces registers consumer-owned session readers, checks membership from live or persisted records, lists playbook choices and refreshes workspace titles. A consumer must register through an effect and remove its reader during teardown. The plugin owns the single provider registration; session plugins own their preparation and frozen configuration.

Removing a workspace registration does not remove the playbook. A deleted playbook cannot supply a new target, but retained session records still identify their workspace. Each session consumer decides whether it can continue without the source. The default composition mounts storage and core before this provider, then mounts the two consumers.
