# Chapter 0, Section 5: View the exercise trajectory

English | [中文](05-exercise-trajectory.zh.md)

These requirements belong to [hello world](README.md) and follow the [shared interaction requirements](../README.md).

## Experience and UI

After the successful reply, guide the user to open the same exercise session's Trajectory. Provide a direct entry to the exchange that completed the previous subsection, retaining chapter progress and the way back to its conversation. Reuse the inspection interaction introduced by [the example trajectory](03-example-trajectory.md).

Guide the user to locate their own message, inspect the corresponding request's input and model parameters, and compare the recorded output with the reply they just received. Explain the recorded timing and usage where available. Display actual saved data; absent fields remain unavailable rather than being filled from the example. For a model with effort support, guide the user to find the lowest effort used by this request; without support, explain that the request has no effort parameter.

Include the [chapter's system prompt](README.md#conversation-context) in this guidance. Read the model and effort recorded for the inspected request, even if the user has since changed the model selector.

Use the general trajectory reading and display mechanisms. Inspection is read-only: it does not resend a request, switch the execution history or change model settings. Opening the trajectory must not replace the exercise session or expose it in the ordinary session list.

## Advancement

Enable Continue only after the real trajectory for the completed exchange has opened and its content is displayed. The earlier example visit does not satisfy this condition. Missing or unreadable records keep this step incomplete and allow the user to retry loading them without resending the model request.

Clicking Continue completes this subsection and the chapter. Show the chapter's completed state with actions to return to the chapter list or restart. Refreshing or re-entering preserves the current attempt's progress and the same trajectory source.

## Acceptance scenarios

- After the real reply, the user enters trajectory inspection rather than completing the chapter immediately.
- The trajectory shows the current exercise's message, request and reply, including the chapter's exact system prompt and the request's actual model and applicable effort. A later model selection does not rewrite these recorded values. It does not substitute the example or another conversation.
- Record details show recorded timing and usage where available; missing values are not invented.
- Opening, refreshing and retrying trajectory loading make no model call and do not change the conversation or model settings.
- Only opening this real trajectory enables Continue. Clicking it then completes the chapter and exposes return and restart actions.
