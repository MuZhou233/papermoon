# Chapter 0, Section 3: View the example trajectory

English | [中文](03-example-trajectory.zh.md)

These requirements belong to [hello world](README.md) and follow the [shared interaction requirements](../README.md).

## Experience and UI

After the conversation example, guide the user to open Trajectory, with a direct entry to the example's trajectory. Keep the chapter progress visible. Explain that the trajectory lets users inspect conversation inputs, model requests and outputs, then guide them to locate `hi`, the corresponding example request and the fixed reply from the previous step. Show how selecting a record opens its details.

Guide the user to find the [chapter's system prompt](README.md#conversation-context) in the example request's input and distinguish it from the user message and model reply. The example's input box remains locked while inspecting its trajectory.

The Story Mode package supplies the trajectory example alongside the conversation example. Their message content must agree. Use DSH's trajectory presentation and clearly label the data as an example. Do not present sample timing or usage as real consumption. Reading the example does not send a model request, create a real execution record or add content to the later exercise session.

## Advancement

Enable Continue once the user has actually opened the corresponding trajectory and its content is displayed. Clicking an entry whose content has not opened is insufficient. Opening the trajectory does not advance automatically; Continue completes this subsection and opens [the real conversation exercise](04-first-message.md).

## Acceptance scenarios

- The user can open the example trajectory from the guidance and locate `hi`, its example request and the fixed reply. Selecting a record displays its details.
- Request details include the chapter's exact system prompt, and opening the trajectory does not unlock the example's input or sending.
- The trajectory agrees with the conversation example, remains clearly marked as an example and makes no real model call.
- Continue is unavailable before the trajectory content has opened; afterward, an explicit click is required to advance.
- Refreshing or returning preserves the current attempt's progress and does not put example records into the real exercise.
