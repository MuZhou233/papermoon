# Chapter 0, Section 3: View the example trajectory

English | [中文](03-example-trajectory.zh.md)

These requirements belong to [hello world](README.md) and follow the [shared interaction requirements](../README.md).

## Experience and UI

After the conversation example, retain the current conversation view and use the shared anchored hint to guide the user to its native Trajectory tab. The user selects the tab to display the example trajectory; entering this subsection never switches views automatically. Keep chapter progress and guidance in the sidebar. Explain that the trajectory lets users inspect conversation inputs, model requests and outputs, then guide them to locate `hi`, the corresponding example request and the fixed reply from the previous step. Show how selecting a record opens its details.

Guide the user to find the [chapter's system prompt](README.md#conversation-context) in the example request's input and distinguish it from the user message and model reply. The example's input box remains locked while inspecting its trajectory.

The Story Mode package supplies the trajectory example alongside the conversation example. Their message content must agree. Use DSH's trajectory presentation and clearly label the data as an example. Do not present sample timing or usage as real consumption. Reading the example does not send a model request, create a real execution record or add content to the later exercise session.

## Exact text

Use this sidebar guidance:

> Select the Trajectory tab above the conversation. Find hi, inspect the system prompt and request, then locate the assistant reply. Select a record to view its details. These are example records, with no real timing or usage.

The overlay uses the [shared trajectory hint](../README.md#trajectory-overlay). Message text comes from [the conversation example](02-conversation-example.md#exact-text), and the system prompt comes from [the chapter context](README.md#conversation-context). Native record titles, field labels and detail controls reuse DSH’s trajectory page.

## Advancement

Enable sidebar Continue once the corresponding trajectory content has actually been displayed. Entering the step before its content loads is insufficient. Opening the trajectory does not advance automatically; Continue completes this subsection and opens [the real conversation exercise](04-first-message.md).

## Acceptance scenarios

- The user can follow the sidebar guidance on the native trajectory page to locate `hi`, its example request and the fixed reply. Selecting a record displays its details.
- Request details include the chapter's exact system prompt, and opening the trajectory does not unlock the example's input or sending.
- The trajectory agrees with the conversation example, remains clearly marked as an example and makes no real model call.
- Continue is unavailable before the trajectory content has opened; afterward, an explicit click is required to advance.
- Refreshing or returning preserves the current attempt's progress and does not put example records into the real exercise.
- Showing or dismissing the hint, or projecting records in the background, never enables Continue. The native tab remains usable by mouse and keyboard.
