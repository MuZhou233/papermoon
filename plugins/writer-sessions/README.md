# Writer sessions

English | [中文](README.zh.md)

## Use

Choose writer mode, a playbook workspace and a writer definition. Model and reasoning controls follow DSH settings. The first durably accepted input freezes the playbook, mode and complete writer snapshot, including when its model call fails or is canceled. Editing or deleting that definition does not change the accepted conversation. The frozen writer selector appears in the conversation header. Playbook workspace labels show only the playbook name; the target picker also shows the project name to distinguish playbooks with the same name.

## Context and inspection

System text and ordered user/assistant messages are sent literally. Names remain inspection metadata. Initial messages appear as one expandable group in chat and individual role-bearing entries in the trajectory. Request reconstruction reads the log, never current writer settings. Explicit plugins can contribute logged context. The writer preset has no coding, filesystem, compaction or result-offload plugins.

## Ownership

The plugin owns authenticated configuration and Agent-local tools. Preparation uses session/configuration records; accepted input carries its snapshot in source.admission. Fork inherits the snapshot and authored message identities. Restored and forked Agents create fresh tool registrations and observations. Playbook IDs are resource references, never directory paths; process cwd comes from plugin configuration.

Multiple conversations and the manual editor may edit one playbook. Local editing tools require fresh observations of the affected objects, without a model-supplied draft sequence. Independent file and translation edits can save across sessions. Commits, restoration and language deletion retain explicit snapshot checks; the [tool documentation](../playbook-tools/README.md#session-observations) defines those checks and save retries. Lists, searches, history reads and browser previews do not authorize edits. Explicit restoration and language deletion use declared replacement scopes and clear affected observations. Deleting a playbook retains conversation history but blocks inputs and tools. Removing workspace registration does not delete the playbook.

## Checks

Run `pnpm check`, `pnpm build:plugins`, `pnpm check:plugins:dsh` and `pnpm test:writer-sessions`. Integration uses isolated data, real DSH components and a deterministic model adapter. Generic DSH patches provide resource targets, admission, authored records and client slots; product rules stay in this plugin.

The profile explicitly injects the [compiler service](../playbook-compiler/README.md) into session-local tool construction. Compilation uses the bound playbook and records its complete receipt through DSH tools, without changing initial prompts or read observations.

The [shared playbook workspace provider](../playbook-workspaces/README.md) owns resource registration and groups writer and [performance](../performances/README.md) sessions together. Writer preparation and fixed context remain owned here. Writer and moderator presets do not replace each other’s configuration or scope contributions.

The profile declares the writer preset through DSH’s preset registry. Client preparation and input blocking belong to the mounted Session binding; changing another Session’s mode does not change them. The preset picker follows DSH’s Coding Tools setting.
