# Agent Note: Writer definitions and scoped playbook tools

Status: implemented

English | [中文](2026-09-12-writer-definitions-and-tools.zh.md)

## Problem

Writer prompts need to be editable independently of playbooks and sessions. Playbook operations also need model-facing schemas and useful receipts without putting Agent policy inside the stable content core. Maintaining a separate UI tool list would let displayed capabilities diverge from registered tools.

## Decision

[Writer management](../../../../plugins/writers/README.md) owns independently stored definitions, literal system text and role-preserving initial messages. A code-owned minimal template initializes new definitions without creating a stored writer at startup. Creation and duplication require confirmation, and every stored writer is editable and deletable.

Prompts owns configurable message content; Tools owns separate declarations and remains read-only in this version. The pure context resolver drives the trajectory-style preview. Prompt names label the editor without entering the resolved messages. Tool help is delivered by an explicit call, not appended to initial messages.

Settings use complete-definition replacement with an observed sequence. Browser navigation preferences are separate from database save outcomes. The page preserves pending edits across navigation and requires an explicit save/discard decision before leaving. It does not create sessions or alter runtime prompts.

[Playbook tools](../../../../plugins/playbook-tools/README.md) own one catalog and executable adapters over the logic core. Program and text operations are separate batches. Callers supply the target playbook and isolated DSH scope; model arguments cannot redirect a tool to another playbook. The management plugin exposes settings and catalog routes. DSH continues to own tool execution, scope cleanup and result validation.

## Alternatives considered

Editing DSH preset composition files would expose plugin assembly rather than a focused writer definition. Storing prompts inside authored revisions would couple independent preferences to content history. A permanent read-only writer would mix a creation default with the user-managed list. Creating before the dialog is confirmed would leave unwanted records after cancellation. Global tool registration would expose playbook mutations to unrelated conversations. A single editing tool would support cross-domain batches but combine program and text parameter sets; action-per-tool registration would expand the tool catalog further.

## Consequences

Writer settings use a separate SQLite file and format; existing playbook formats remain unchanged. Management pages use DSH footer, main-panel and overlay extension points without patches. Main-owned client builds share the factory bundling function. The [tool writing standard](../../../../docs/development.md#tool-writing) keeps tool text focused on call requirements so it does not turn engineering details into creative instructions or checking routines. Revision lookup errors identify the model argument and supplied value at the tool layer; repository rules remain in the core. Help is not injected into prompts. [Writer sessions](2026-09-12-writer-sessions.md) own session activation, runtime context logging and observation policy.
