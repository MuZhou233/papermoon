# Writer sessions

English | [中文](README.zh.md)

## Use

Choose writer mode, a script workspace and a writer definition. Model and reasoning controls follow DSH settings. The first durably accepted input freezes the script, mode and complete writer snapshot, including when its model call fails or is canceled. Editing or deleting that definition does not change the accepted conversation. The frozen writer selector appears in the conversation header. Script workspace labels show only the script name; the target picker also shows the project name to distinguish scripts with the same name.

## Context and inspection

System text and ordered user/assistant messages are sent literally. Names remain inspection metadata. Initial messages appear as one expandable group in chat and individual role-bearing entries in the trajectory. Request reconstruction reads the log, never current writer settings. Explicit plugins can contribute logged context. The writer preset has no coding, filesystem, compaction or result-offload plugins.

## Ownership

The plugin owns resource workspace targets, authenticated configuration and Agent-local tools. Preparation uses session/configuration records; accepted input carries its snapshot in source.admission. Fork inherits the snapshot and authored message identities. Restored and forked Agents create fresh tool registrations and observations. Script IDs are resource references, never directory paths; process cwd comes from plugin configuration.

Multiple conversations and the manual editor may edit one script. Overwriting tools require the draft sequence and a fresh observation of the affected objects. Lists, searches, history reads and browser previews do not authorize edits. Explicit restoration and language deletion use declared replacement scopes and clear affected observations. Deleting a script retains conversation history but blocks inputs and tools. Removing workspace registration does not delete the script.

## Checks

Run `pnpm check`, `pnpm build:plugins`, `pnpm check:plugins:dsh` and `pnpm test:writer-sessions`. Integration uses isolated data, real DSH components and a deterministic model adapter. Generic DSH patches provide resource targets, admission, authored records and client slots; product rules stay in this plugin.
