# Chapter 0, Section 5: View the exercise trajectory

English | [中文](05-exercise-trajectory.zh.md)

These requirements belong to [hello world](README.md) and follow the [shared interaction requirements](../README.md).

## Experience and UI

After the first successful full reply, retain the current exercise conversation and guide the user with the shared anchored hint to select its native Trajectory tab. Advancing to this subsection never switches views automatically. Keep chapter progress and inspection guidance in the sidebar. Reuse the inspection interaction introduced by [the example trajectory](03-example-trajectory.md).

Fix this subsection’s inspection target to the first successful exchange in the current attempt. Guide the user to locate that user message, inspect the corresponding request’s input and model parameters, and compare the recorded output with that reply. Explain the recorded timing and usage where available. Display actual saved data; absent fields remain unavailable rather than being filled from the example. If the request records an effort, guide the user to find its actual value; otherwise, do not infer an effort level. Do not assume the user followed the recommendation.

Include the [chapter's system prompt](README.md#conversation-context) in this guidance. Read the model and effort recorded for the inspected request, even if the user has since changed the model selector.

Use the general trajectory reading and display mechanisms. Inspection is read-only: it does not resend a request, switch the execution history or change model settings. Opening the trajectory must not replace the exercise session or expose it in the ordinary session list.

The exercise stays open for further messages during this subsection and after chapter completion, following [the exercise’s continued-conversation rules](04-first-message.md#advancement-and-recovery). The native request state controls sending; chapter progress adds no input lock. Subsequent messages, their outcomes and later model selections do not replace the first successful exchange as the target or reset an already satisfied viewing condition.

## Exact text

Use this sidebar guidance:

> Select the Trajectory tab above the conversation. Find the first successful exchange in this exercise and inspect your message, the model used for the request, the system prompt, and the reply. If the request records an effort value, inspect that value too; do not infer an effort level when none is recorded. Timing shows how long the request took, and usage shows the recorded token counts. Only saved data is shown. You can keep chatting without changing the exchange this step asks you to inspect.

The overlay uses the [shared trajectory hint](../README.md#trajectory-overlay); chapter completion uses the [chapter overview’s text](README.md#chapter-text). Native record titles, fields and controls reuse DSH’s trajectory page. Messages, request parameters, timing and usage come from the saved first successful exchange, not from preset or inferred values.

## Advancement

Enable sidebar Continue only after the real trajectory for the first successful exchange in this attempt has opened and its content is displayed. The earlier example visit does not satisfy this condition. Missing or unreadable records keep this step incomplete and allow the user to retry loading them without resending the model request.

Clicking Continue completes this subsection and the chapter without closing the exercise conversation or stopping an ongoing request. Show the chapter’s completed state with actions to return to the chapter list or restart, while allowing further conversation. Refreshing or re-entering preserves the current attempt's progress and the same trajectory source.

## Acceptance scenarios

- After the real reply, the conversation stays visible. A hint or its dismissal cannot complete the step; the user opens the native trajectory to inspect it.
- The trajectory shows the current exercise's message, request and reply, including the chapter's exact system prompt and the request's actual model and applicable effort. A later model selection does not rewrite these recorded values. It does not substitute the example or another conversation.
- Record details show recorded timing and usage where available; missing values are not invented.
- Opening, refreshing and retrying trajectory loading make no model call and do not change the conversation or model settings.
- Only displaying the first successful exchange’s real trajectory enables Continue. Clicking it completes the chapter and exposes return and restart actions, without closing the conversation or stopping an ongoing request.
- Users can continue typing and sending during this step and after chapter completion. Later successes, failures, cancellations or interruptions do not change the target, revoke the viewing result or undo chapter progress.
- Refresh and re-entry preserve the same exercise and first successful exchange as the inspection source; request restoration never sends automatically.
