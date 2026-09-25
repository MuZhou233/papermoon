# Chapter 0, Section 2: View a conversation example

English | [中文](02-conversation-example.zh.md)

These requirements belong to [hello world](README.md) and follow the [shared interaction requirements](../README.md).

## Experience and UI

After the introduction subsection, show a prepared conversation containing the user message `hi` and the fixed reply specified below. Use the actual DSH conversation page to display both roles. Clearly label this as an example in the sidebar guidance so the user does not mistake it for a reply from their configured model.

Keep the example's input box visible but locked: users cannot type, paste or edit text in it, and sending is disabled. The example uses the [chapter's system prompt](README.md#conversation-context).

The Story Mode package supplies the example content. Displaying it does not send a model request or validate credentials. It is separate from the later exercise session and must not enter that session's conversation history or request context.

## Exact text

The example’s user message is:

```text
hi
```

The fixed assistant reply is:

```text
Hi! How can I help you today?
```

Both messages remain unchanged across interface languages. The example conversation and its trajectory use these same messages. The [chapter overview](README.md#chapter-text) owns the conversation title, and its [conversation context](README.md#conversation-context) owns the exact system prompt.

The sidebar guidance is:

> Example · This reply was written in advance, without calling a model. The input is locked.

The locked native input uses this placeholder:

> Read-only conversation

## Advancement

Provide Continue in the focused sidebar subsection. Showing the reply or waiting does not advance the step. The user's click completes this subsection and opens [the example trajectory step](03-example-trajectory.md).

## Acceptance scenarios

- The example displays `hi`, a fixed reply, distinct speaker roles and an explicit example label.
- The visible input stays locked and cannot submit messages through the send control or a keyboard shortcut. The example request uses the chapter's exact system prompt.
- Opening, refreshing or restoring this step sends no model request and does not add messages to the real exercise.
- Progress remains on the example until the user clicks Continue.
