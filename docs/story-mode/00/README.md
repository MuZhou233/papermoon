# Chapter 0: hello world

English | [中文](README.zh.md)

Chapter 0 establishes how users enter Story Mode, follow chapter progress and complete an exercise. It also establishes the boundary between the chapter experience and general PaperMoon mechanisms.

## Experience

Apply the [shared interaction and implementation constraints](../README.md). The chapter is named `hello world`. Users first inspect their model configuration, then view a prepared conversation and its trajectory. They next send their own message in a fresh exercise conversation and inspect the trajectory of that real exchange.

| Order | Subsection | Advancement |
|---|---|---|
| 1 | [Check model configuration](01-model-configuration.md) | Click Continue after the viewing and configuration requirements are met. |
| 2 | [View a conversation example](02-conversation-example.md) | Click Continue after viewing the static example. |
| 3 | [View the example trajectory](03-example-trajectory.md) | Open the example trajectory, then click Continue. |
| 4 | [Send the first message](04-first-message.md) | Advance when a model reply completes successfully. |
| 5 | [View the exercise trajectory](05-exercise-trajectory.md) | Open the real exercise trajectory, then click Continue to complete the chapter. |

Each subsection owns its controls, prerequisites and acceptance scenarios. The shared requirements own chapter navigation, progress persistence, restart and session visibility.

## Conversation context

Both the example and the real exercise use exactly `You are a helpful assistant` as their system prompt. Keep this text unchanged in both interface languages, without added punctuation or chapter guidance. The example request and the actual exercise request must reflect the same prompt; their trajectories expose it as part of the request input.

## Chapter acceptance

Complete the five subsections in order from a fresh attempt, including when the user already has model configuration. Exercise both manual advancement and advancement triggered by a completed operation. Then verify the shared refresh, exit, re-entry and restart behavior across the sequence.

The chapter must distinguish its static conversation and trajectory from the user's real request and records. Viewing configuration, the example or either trajectory does not call a model; only the user's real exercise sends a message. A successful full reply advances to trajectory inspection. Completing the chapter also requires opening that trajectory and explicitly continuing.

The example's input is locked. The real exercise allows the user to choose a model freely while keeping its effort at the lowest available option. Verify that changing models preserves the chapter's system prompt and applies the newly selected model's effort constraints.
