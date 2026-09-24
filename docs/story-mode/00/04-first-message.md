# Chapter 0, Section 4: Send the first message

English | [中文](04-first-message.zh.md)

These requirements belong to [hello world](README.md) and follow the [shared interaction requirements](../README.md).

## Experience and UI

On first reaching this step in an attempt, create a fresh exercise session with no existing conversation history and the [chapter's system prompt](README.md#conversation-context). Do not reuse an ordinary conversation or insert the previous example. Resuming the attempt restores its exercise session instead of creating another one.

Guide the user to enter any nonempty text and send it. Show the model selector, text input, Send/Stop and the controls needed to display replies. Users can freely choose among available configured models. Do not offer tools, attachments, mode switching or effort switching. The interface follows DSH's visual style while real requests and session persistence use the general mechanisms.

## Model and effort constraints

Initially use the model selected in the first subsection, allowing the user to change it during the exercise. Lock only effort within the model selection controls, fixing it to the selected model's lowest available option. Recalculate this choice whenever the model changes instead of carrying over the previous model's effort. If disabling thinking is an available effort option, include it when choosing the lowest value. For models without effort configuration, omit the parameter, including any effort left from the previous selection.

Enforce this choice in the actual exercise request, not just in the displayed control. Changing models retains the chapter's system prompt. Apply model choices and effort constraints only to the chapter exercise; do not rewrite ordinary sessions or the global default model and effort selection.

## Advancement and recovery

Advance to [the exercise trajectory step](05-exercise-trajectory.md) only after the user's message receives a successful full model reply. Submitting a message or receiving part of a reply is insufficient. Failure, cancellation or interruption does not complete this step; preserve progress, show the request's outcome and allow the user to retry. Restoring the page does not automatically resend the request.

A successful reply completes this subsection, not the chapter; keep the same exercise session for the next step. Apply the shared progress and session visibility rules: the exercise is restored through Story Mode and stays out of the ordinary session list.

## Acceptance scenarios

- A new attempt starts with the chapter's exact system prompt and no ordinary-session or example messages in its history or request context. Resuming the same attempt retains its own messages.
- The user can submit any nonempty text and freely choose an available model. The model selector remains usable, with no effort switch.
- After switching models, actual requests retain the chapter's system prompt and use the new model's lowest supported effort, including disabled thinking when available; switching to a model without effort support removes the parameter.
- Model choices and the exercise's effort constraint leave ordinary sessions and global defaults unchanged.
- A successful full reply advances to trajectory inspection in the same session. Submission alone, a partial reply, failure, cancellation and interruption do not; retry remains available and refresh does not resend automatically.
- The chapter remains incomplete until the last subsection is completed, and exercise sessions do not appear in the ordinary list.
