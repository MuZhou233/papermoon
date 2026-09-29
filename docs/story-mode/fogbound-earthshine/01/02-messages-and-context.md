# 1.2 Messages and Context

English | [中文](02-messages-and-context.zh.md)

This section belongs to [Your First Character](README.md). It builds on input and reply to introduce messages, roles and context, then exposes ordered opening messages in the [general editor and writer tools](../../../playbook-authoring.md).

## Steps and interface

| Step | Action | Visible result |
|---|---|---|
| 1 | Read the teaching text, then the opening example with role labels. | The right panel explains messages and context before showing roles and order; the opening editor is available in the center. |
| 2 | Add or edit messages, change roles and order, or leave the list empty. | Each message shows a role control, body editing, highlighting and save state. |
| 3 | Save the current opening settings and continue. | Persist this section's completion, enter 1.3 and make system-prompt editing available. |

This stage permits only opening-message reads and writes. Writers receive read, add, delete, body-edit, role-change and reorder capabilities with the same scope as manual editing. Use the shared Markdown/XML highlighting, search, undo/redo and save-state experience, with Markdown selected by default. New messages default to the assistant role and can be changed to user; adjacent messages may have the same role. An empty list is valid. Pending edits and conflicts follow the general editor rules.

## Teaching

The following passages are the complete text for the right-side guide under the [text authority rule](../../README.md#text-authority).

> Conversation applications organize exchanges as ordered messages. Each message has a body and a role label. The user role usually carries input from the user's side, while the assistant role usually carries the model's response. Role labels and message order together establish each passage's place in the exchange.

> After a reply is generated, an application can supply the preceding messages alongside a new input. The input available for a particular generation forms its context. Earlier messages can supply information already mentioned, the sequence of events and an ongoing topic, connecting a new reply to the preceding exchange.

> Opening messages use this mechanism to arrange an initial exchange in advance. In a Playbook, the creator writes these messages, which enter the performance with their saved roles and order. An assistant opening can demonstrate a response, while a user opening can establish a situation or purpose. An actual model reply is produced when a new request in the performance completes.

> In character performance, user-side messages can present the player's actions, questions and additional background. Assistant-side messages can present character dialogue and scene descriptions. Connected messages can also demonstrate the intended narrative rhythm. Message roles describe the function of content in the conversation, while the text conveys the identities of the fictional participants.

> An opening can be arranged around the space intended for further interaction. A fuller opening can supply more situational and relational background, a brief opening can hand the exchange to the player sooner, and an empty opening can leave the first words to the player. Roles, bodies and order can work together to support these choices.

## Example and analysis

After the teaching text, display the [opening-message table](README.md#opening-messages), preserving both bodies, roles and order. Follow it with this analysis:

> The user message establishes the visitor's action, and the assistant message supplies the keeper's response. Together, they form a scene that later exchanges can build on. The identities in the text convey the story's participants, while the user and assistant roles establish their messages' positions in the conversation.

## Operation guidance

Use the following text near the editor and in its location hint:

> Write the opening, adjust its roles and order, then save and continue. You can also save an empty opening.

Empty-list text:

> No opening messages. You can add one or keep the opening empty.

## Advancement

Saving or explicitly saving the unchanged empty list satisfies the opening-settings condition; a writer's saved result also qualifies. Continue remains a separate user action. Do not require a message, a particular role, a body length or a specific ordering as a chapter condition.

Saving, changing a role or reordering does not call the performance model. Messages remain authored content with their exact roles and order. The [fifth section](05-reasoning-effort-and-first-performance.md#startup-and-completion) owns the first real performance reply.

## Acceptance scenarios

- Continue after saving an empty list or messages through the editor or a writer. Saving alone does not advance the section.
- Add, delete and edit messages, change roles and reorder them while retaining bodies and pending text. Consecutive identical roles remain valid.
- Preserve the exact text through Markdown/XML switches, save/reload and incomplete markup. Save errors or conflicts retain local work and do not complete the section.
- Refresh after saving and retain the list exactly. Displaying an authored assistant message does not advance the chapter or create model usage.
- Writers and users access only opening messages. Reject direct and indirect reads or writes to the system prompt and other unopened content, including through status, help, history and metadata entry points.
