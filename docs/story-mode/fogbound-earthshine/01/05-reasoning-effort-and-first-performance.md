# 1.5 Reasoning Effort and the First Performance

English | [中文](05-reasoning-effort-and-first-performance.zh.md)

This section belongs to [Your First Character](README.md). Users consider reasoning effort for the selected model, start a performance and send a real message. The first successful complete reply qualifies the chapter for submission.

## Steps and interface

| Step | Action | Visible result |
|---|---|---|
| 1 | Read the teaching text, then the first-input example. | The right panel explains reasoning investment and observation criteria before presenting the example and analysis. |
| 2 | Choose supported reasoning effort and adjust the model selection if needed. | Native controls show the effective choice while global defaults remain unchanged. |
| 3 | Resolve pending edits and start the performance. | Freeze saved content and display its opening on the native conversation page, awaiting the first input. |
| 4 | Send a message and wait for a successful complete reply. | Persist the qualifying record and submit the chapter; after success, show continuation choices. |

Keep both plain-text editors and their writer capabilities available. A valid model must be configured and selected before startup; use native settings when configuration is missing. Users choose reasoning effort according to preference, with no minimum setting or replacement by a recommendation. Show only options supported by the model; a model without adjustable effort remains usable. Choices apply to this performance while global defaults remain unchanged.

## Teaching

The following passages are the complete text for the right-side guide under the [text authority rule](../../README.md#text-authority).

> Reasoning effort adjusts how much reasoning some models invest in generating a reply. Reasoning can support the analysis of instructions, integration of background information and organization of an answer. Models that support this setting provide corresponding options whose effects depend on the model.

> Reasoning investment affects generation and may change reply quality, response time and usage. In character performance, extensive background, complex relationships and connected reasoning may increase the need to integrate information. A brisk exchange may place greater emphasis on waiting time. A suitable setting can reflect both the interaction and the user's preferences.

> A performance brings the authored character details, opening messages and new input together for generation. It provides an opportunity to observe how the model applies the character details, responds to the situation and forms an expression. Several exchanges in similar situations can inform model choice, content placement and reasoning effort.

> Observation of a first character can begin with continuity, responsiveness to the situation and expressive style. As the exchange develops, it becomes easier to identify which details influence the character's choices and which expressions match the intended effect. These observations can also inform further authoring.

## Example and analysis

After the teaching text, display the [first input verbatim](README.md#first-input), followed by this analysis:

> The question about the map follows from the visitor carrying it in the opening and gives the keeper something to address. Whether the reply retains the brief, calm style, and how it handles an unfamiliar mark, can help reveal the effect of the character instructions in a particular exchange.

Users write and send their own first message. The example is reading material and is neither inserted into the composer nor sent automatically.

## Operation guidance

Show the following explanation near the startup control:

> This model and reasoning effort selection applies to the current performance. At startup, the system fixes the saved system prompt and opening messages, then displays the opening; an empty opening waits for the first input. Further edits remain in the Playbook while the current performance retains its starting content.

> After the first successful complete model text reply, the system saves this chapter's submission revision. A successful save completes Your First Character and retains the current conversation. If chapter saving fails, it can be retried using the same successful reply.

Location hints use the independent text below. When effort is not adjustable, show the state explanation without locating a nonexistent control.

| Control | Text |
|---|---|
| Model selector | Choose a configured model. |
| Effort selector | Choose a reasoning effort setting supported by the model. |
| Startup control | Save your system prompt and opening settings, then start the performance. |
| Composer | Send a message to your character to begin the first real exchange. |

| Condition | Text |
|---|---|
| No adjustable effort | This model has no adjustable reasoning effort setting. You can still use it. |
| Ready for a first input | Send a message to your character and wait for the first complete reply. |
| Request unsuccessful | The reply did not complete. You can try again; reopening this page will not resend your message. |
| Chapter submission failed | The reply succeeded, but the chapter was not saved. Retry saving without sending another message. |
| Retry submission | Retry chapter save |
| Chapter complete | You have completed Your First Character. You can keep chatting or enter Chapter 2 when it is available. |

## Startup and completion

Before startup, require a saved nonblank system prompt, saved opening settings and a valid model selection. Resolve pending edits or cancel startup. An empty opening list is allowed. Freeze the chosen saved content according to the [authoring boundary](../../../playbook-authoring.md#performance-and-chapter-boundaries). Later manual or writer edits do not change the running performance's initial context.

Startup and authored opening display do not request a reply or satisfy completion. A user's actual message triggers the model. Completion requires the first successful complete assistant body reply in this performance, retained as a real execution record. Authored assistant openings, partial streams, reasoning-only output and failed, cancelled or interrupted requests do not qualify. There is no additional trajectory-viewing condition or manual completion click.

The qualifying reply automatically triggers chapter submission under the [save rules](../../design.md#chapter-submissions-and-review). Preserve the performed content and this successful record's boundary, not later draft edits or later replies. Submission success records the chapter tag and completion together. A persistence failure leaves submission pending; retry the save using the same qualifying record without requesting another model reply or making another performance. Repeated completion handling must not create duplicate chapter submissions.

Keep conversation available after completion. Subsequent successes, failures or cancellations do not change the qualifying reply or revoke progress. The [chapter overview](README.md#completion-and-continuation) owns the choices to remain or enter Chapter 2. Returning to the save restores the session and progress without automatically resending input.

## Acceptance scenarios

- Use supported effort settings freely, including a model with no adjustable effort. Configuration and selection do not change global defaults or require a minimum effort.
- Start with empty or populated openings. Verify that the saved system prompt, roles, bodies and order enter the actual request unchanged, and that startup sends no request.
- Send a real input; reject authored text, partial, reasoning-only, failed, cancelled and interrupted outcomes as completion evidence. The first successful full body reply triggers submission automatically.
- Fail and retry chapter persistence without another model call; preserve the performed snapshot and successful record even if the draft or conversation has since changed.
- Restore after interruption and process repeated completion without duplicate submissions. After success, keep chatting without revoking completion, and follow Chapter 2 availability.
