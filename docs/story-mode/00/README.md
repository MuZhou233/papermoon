# Chapter 0: hello world

English | [中文](README.zh.md)

Chapter 0 establishes how users enter Story Mode, follow chapter progress and complete an exercise. It also establishes the boundary between the chapter experience and general PaperMoon mechanisms.

## Experience

Apply the [shared interaction and implementation constraints](../README.md). The chapter is named `hello world`. Users first read the Story Mode introduction and complete model configuration only if no configured model is available, then view a prepared conversation and its trajectory. They next send their own message in a fresh exercise conversation and inspect the trajectory of that real exchange.

| Order | Subsection | Advancement |
|---|---|---|
| 1 | [Welcome to Story Mode](01-introduction.md) | Read the introduction, then click Continue once at least one model has complete configuration. |
| 2 | [View a conversation example](02-conversation-example.md) | Click Continue after viewing the static example. |
| 3 | [View the example trajectory](03-example-trajectory.md) | View the native example trajectory, then click sidebar Continue. |
| 4 | [Send the first message](04-first-message.md) | Advance when the first complete model reply succeeds; chatting remains available. |
| 5 | [View the exercise trajectory](05-exercise-trajectory.md) | View the native trajectory of the first successful exchange, then click sidebar Continue to complete the chapter; chatting remains available. |

Each subsection owns its controls, prerequisites and acceptance scenarios. The shared requirements own chapter navigation, progress persistence, restart and session visibility.

## Chapter text

The subsection names in the sequence above are their exact interface labels. Shared buttons and states use the [shared text](../README.md#shared-text).

| Use | Exact text |
|---|---|
| Chapter number | Chapter 0 |
| Chapter name | hello world |
| Full chapter label | Chapter 0 · hello world |
| Example conversation title | hi |
| Exercise conversation title | hello world |

The chapter list shows this introduction:

> Start a conversation, then explore the request sent to the model and the reply it returns.

On chapter completion, show:

> You have completed hello world. You can keep chatting, return to the chapter list, or restart.

## Conversation context

Both the example and the real exercise use exactly `You are a helpful assistant` as their system prompt. Keep this text unchanged in both interface languages, without added punctuation or chapter guidance. The example request and the actual exercise request must reflect the same prompt; their trajectories expose it as part of the request input.

## Chapter acceptance

Complete the five subsections in order from a fresh attempt, including when the user already has model configuration and does not need to visit configuration. The first subsection checks for any configured model, even when no default is selected or the selected default is invalid. Exercise both manual advancement and advancement triggered by a completed operation. Then verify the shared refresh, exit, re-entry and restart behavior across the sequence.

The chapter must distinguish its static conversation and trajectory from the user's real request and records. Viewing configuration, the example or either trajectory does not call a model; only the user's real exercise sends a message. The first successful full reply advances to trajectory inspection while preserving the current native view and allowing further messages. Completing the chapter also requires opening that first successful exchange’s trajectory and explicitly continuing. Further successes, failures, cancellations or interruptions do not change the inspection target or undo progress, and chapter completion does not close the exercise conversation.

The example's input is locked. The real exercise allows the user to choose a model and any supported effort freely, with guidance defined in [the fourth subsection](04-first-message.md#model-selection-and-effort-guidance). Verify that changing models preserves the chapter's system prompt, that guidance follows the current model and effort, and that it neither changes parameters nor prevents sending.
