# Chapter 0, Section 4: Send the first message

English | [中文](04-first-message.zh.md)

These requirements belong to [hello world](README.md) and follow the [shared interaction requirements](../README.md).

## Experience and UI

On first reaching this step in an attempt, create a fresh exercise session with no existing conversation history and the [chapter's system prompt](README.md#conversation-context). Do not reuse an ordinary conversation or insert the previous example. Resuming the attempt restores its exercise session instead of creating another one.

Guide the user to enter any nonempty text and send it. Show the model selector, supported effort controls, text input, Send/Stop and the controls needed to display replies. Users can freely choose among available configured models and their supported effort options. Do not offer tools, attachments or mode switching. Use the actual DSH conversation page and its native composer, model controls and message rendering. Real requests and session persistence use the general mechanisms.

## Model selection and effort guidance

Initially retain a valid current model selection. If no valid selection exists, the user chooses a configured model through the native selector before sending; the first subsection’s readiness check does not choose one. Allow the user to change the model and any supported effort during the exercise. Show guidance in the focused sidebar subsection according to the current model's capabilities and effective effort, including an explicit model default when applicable:

- If the model supports `off`, hide the guidance only when the effective effort is confirmed to be `off`; otherwise, recommend selecting `off`. An omitted parameter alone does not establish that thinking is off.
- If the model does not support `off`, always recommend using its lowest effort, even if the user has already selected that option. Do not infer or verify which option is lowest.

Update the guidance when the model or effort changes. It is advisory: it does not lock controls, select an effort automatically, override request parameters or block sending or chapter advancement. For models without effort configuration, keep the guidance, explain that no adjustable effort is available, and provide no effort control or parameter; do not carry over the previous model's effort.

Changing models retains the chapter's system prompt. Apply model and effort choices only to the chapter exercise; do not rewrite ordinary sessions or the global default model and effort selection.

## Exact text

The native exercise input uses this placeholder:

> Message

Use this sidebar guidance:

> Send any non-empty text. You can choose the model and effort. The first complete reply advances to the next step, and you can keep chatting.

| Effort condition | Exact text |
|---|---|
| Supports off, but off is not confirmed | For this exercise, choose off to turn thinking off. |
| Does not support off | For this exercise, use the lowest available effort. |
| No adjustable effort | For this exercise, use the lowest available effort. This model has no adjustable effort setting. |

For a request that did not complete, use:

> The last request did not complete. You can retry; opening this page does not resend it.

Model names and effort options come from DSH model metadata and native controls. User messages, model replies and underlying request errors come from the actual exercise; they are not preset chapter text. The [chapter overview](README.md#chapter-text) owns the exercise title, and its [conversation context](README.md#conversation-context) owns the system prompt.

## Advancement and recovery

Advance to [the exercise trajectory step](05-exercise-trajectory.md) only after a user message receives the attempt’s first successful full model reply. Submitting a message or receiving part of a reply is insufficient. Failure, cancellation or interruption does not complete this step; preserve progress, show the request's outcome and allow the user to retry. Restoring the page does not automatically resend the request.

The first successful reply completes this subsection and fixes the next step’s inspection target. Keep the same exercise session and the current native view; do not switch to the trajectory automatically. Neither advancing to the fifth subsection nor completing the chapter locks the input or prevents sending. Users can continue editing and sending in the native conversation view, subject to ordinary native request-state controls.

Model and effort selection remain available. The chapter system prompt and its restrictions on tools, attachments and mode switching continue to apply while the chapter is active. Later successes, failures, cancellations or interruptions neither replace the first successful exchange as the inspection target nor undo progress or a satisfied viewing condition. Restoring the page never resends a request automatically.

Chapter completion does not close the exercise conversation. Leaving, re-entering, restarting and disabling Story Mode follow the shared lifecycle requirements. The exercise is restored through Story Mode and stays out of the ordinary session list.

## Acceptance scenarios

- A new attempt starts with the chapter's exact system prompt and no ordinary-session or example messages in its history or request context. Resuming the same attempt retains its own messages.
- The user can submit any nonempty text and freely choose an available model and any effort it supports. Without a valid current selection, the native selector requires the user to choose a configured model before sending; the introduction does not choose one automatically.
- For a model supporting `off`, selecting another effort shows the recommendation and selecting `off` hides it. An explicit model default of `off` also satisfies this check; an omitted parameter without that default does not.
- For a model without `off`, the lowest-effort recommendation remains visible regardless of the selected effort. For a model without effort configuration, it also explains that no adjustable effort is available.
- Switching models or effort updates the guidance without automatically selecting a recommended value. Requests retain the chapter's system prompt and follow the user's selection; switching to a model without effort support removes the parameter.
- Sending with the recommendation visible is allowed, and a successful full reply still advances. Model and effort choices leave ordinary sessions and global defaults unchanged.
- The first successful full reply advances to trajectory inspection in the same session while retaining the current native view. Submission alone, a partial reply, failure, cancellation and interruption do not; retry remains available and refresh does not resend automatically.
- The input and sending remain available after that reply, in the trajectory subsection and after chapter completion, subject to native request-state controls. Model and effort selection remain free, with the same prompt and chapter restrictions.
- Further successes or failures do not replace the first successful trajectory target, reset a satisfied viewing condition or undo progress. Refresh and re-entry preserve the conversation and these results without resending.
- The chapter remains incomplete until the last subsection is completed, and exercise sessions do not appear in the ordinary list.
