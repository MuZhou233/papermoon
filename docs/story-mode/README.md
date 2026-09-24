# Story Mode requirements

English | [中文](README.zh.md)

Story Mode presents experiences in chapters. Its Chinese product name is 故事模式. These documents define the intended experience and its constraints. The existing development and delivery workflow still applies.

## Documents

Use a numbered directory for each chapter, a README for its goals and sequence, and a numbered Markdown file for each subsection. Maintain English, Chinese and pairing files under the [documentation rules](../AGENTS.md).

Each subsection records user actions, visible results, required UI and guidance, advancement conditions and acceptance scenarios. This entry document owns shared interaction requirements; chapters refer to them instead of repeating them. Requirements do not track implementation or delivery status. Architecture, APIs and implementation decisions belong to engineering documentation and Agent Notes.

## Shared interaction

### Entry and chapter navigation

Add a Story Mode entry to the left sidebar. Its page displays the chapter list, each chapter's completion state and a button to enter it. Entering a chapter replaces the sidebar's workspace list region with chapter progress, distinguishing completed, current and not yet started steps. Clicking the progress list cannot skip an unfinished step.

Provide a way to return to the chapter list. Leaving a chapter restores the ordinary workspace list. While a chapter is active, New Session entry points must not bypass its current step or create an ordinary session.

Use DSH's theme, typography, controls and responsive conventions. Configuration pages can open from within a chapter; closing them returns to the same step without losing progress.

### Advancement

Support two advancement conditions: a verifiable result of a user operation, and an explicit click to continue. Each subsection specifies its condition. When a manual step has prerequisites, satisfying them enables Continue; it does not advance the step automatically.

### Saved progress and restart

Save chapter progress and its exercise session within the same installation configuration. Refreshing, leaving and re-entering continue the current attempt. Restart resets that attempt's progress; its real conversation exercise uses a new session with no previous conversation history. Exercise sessions are restored only through Story Mode and do not appear in the ordinary session list.

Restoring a page does not automatically resend a model request. A failed, cancelled or interrupted request leaves the exercise available for the user to retry. Chapter completion is displayed explicitly, with actions to return to the chapter list or restart.

## Implementation constraints

Follow the [architecture responsibilities](../architecture.md#responsibilities): the Story Mode plugin owns chapter definitions, progress orchestration, dedicated UI, guidance and preset content. Other packages provide general mechanisms such as model configuration, request execution and session persistence. Use those mechanisms through their public extension points. Necessary DSH patches follow the [patch scope rule](../../patches/README.md), including its requirement to minimize scope and justify expansion.

When later chapters require architecture changes, every implemented chapter must remain completable from the beginning in the current version. Instructions and preset content can evolve while preserving the learning goals and expected results. Saving progress does not introduce migration support for old progress or session formats.

## Shared acceptance scenarios

- The sidebar entry opens the chapter list with completion states and entry buttons. Entering and leaving a chapter replace and restore the workspace list region correctly.
- Progress identifies completed, current and not yet started steps. Neither the list nor New Session entry points bypass the required sequence.
- Opening and closing configuration preserves the current step. The chapter follows DSH styling in both wide and narrow layouts.
- Refreshing or re-entering restores the current attempt and exercise session; restarting resets progress and uses a fresh conversation for the real exercise.
- Exercise sessions stay out of the ordinary list, and page restoration does not resend requests.

## Chapters

- [Chapter 0: hello world](00/README.md)
  - [Section 1: Check model configuration](00/01-model-configuration.md)
  - [Section 2: View a conversation example](00/02-conversation-example.md)
  - [Section 3: View the example trajectory](00/03-example-trajectory.md)
  - [Section 4: Send the first message](00/04-first-message.md)
  - [Section 5: View the exercise trajectory](00/05-exercise-trajectory.md)
