# Story Mode requirements

English | [中文](README.zh.md)

Story Mode presents experiences in chapters. Its Chinese product name is 故事模式. These documents define the intended experience and its constraints. The existing development and delivery workflow still applies.

## Documents

Use a numbered directory for each chapter, a README for its goals and sequence, and a numbered Markdown file for each subsection. Maintain English, Chinese and pairing files under the [documentation rules](../AGENTS.md).

Each subsection records user actions, visible results, required UI and guidance, advancement conditions and acceptance scenarios. This entry document owns shared interaction requirements; chapters refer to them instead of repeating them. Requirements do not track implementation or delivery status. Architecture, APIs and implementation decisions belong to engineering documentation and Agent Notes.

## Text authority

Requirements supply the exact text for everything Story Mode authors or changes: names, introductions, guidance, controls, states, errors, example messages and preset prompts. Shared text belongs here; chapter text belongs in its overview or owning subsection. Other documents refer to the owner instead of maintaining another copy. Each language supplies its confirmed interface wording; prompts and example messages declared as literals remain unchanged across interface languages.

Before implementing content whose text is missing, discuss the wording and add it to the requirements. Existing code is not evidence that its wording was approved. Changes to text or translations require discussion and a requirements update before implementation. Do not add, polish, shorten or replace confirmed text while implementing it.

Dynamic text specifies the complete template and each variable's source. Controls reused unchanged from DSH identify their source instead of copying upstream wording. Model names come from model metadata, real replies from the exercise session, and underlying errors from their originating service. Any Story Mode wording added around these values still requires an exact template. Story Mode's own fixed errors use the text below.

## Shared text

### Names, controls and states

| Use | Exact text |
|---|---|
| Mode name | Story Mode |
| Enter | Enter chapter |
| Resume | Continue chapter |
| Return | Chapter list |
| Reset | Restart |
| Advance | Continue |
| Complete | Complete chapter |
| Configuration entry | Open model configuration |
| Restore overlay | Show hint |
| Dismiss overlay | Dismiss hint |
| Retry | Retry |
| Loading | Loading… |
| Completed state | Completed |
| Current state | Current |
| Not started state | Not started |
| Progress name | Chapter progress |
| Progress template | {completed} / {total} steps completed |

The {completed} and {total} variables come from actual chapter progress. The chapter list introduction is:

> Choose a chapter and follow its guidance to explore PaperMoon.

Native conversation headers, model and effort selectors, input fields, Send/Stop controls and trajectory controls reuse DSH's default conversation and trajectory pages, including their labels and accessibility text. Chapter documents supply any fixed conversation titles. Native model configuration retains the DSH Models page's controls and wording.

### Trajectory overlay

Both trajectory steps use this exact hint:

> Select the Trajectory tab here to inspect this conversation.

### Story Mode errors

| Condition | Exact text |
|---|---|
| Mode disabled | Story Mode is off. Turn it on again to continue. |
| Stale page operation | The exercise has been restarted. Refresh the page. |
| Unmet prerequisites | This step’s requirements have not been met yet. |
| Operation unavailable in this step | This action is not available in the current step. |
| Exercise not ready | The exercise conversation is not ready. Please retry. |
| Example not ready | The conversation example is not ready. Please retry. |
| Sending temporarily unavailable | Messages cannot be sent right now. Please try again shortly. |

## Shared interaction

### Entry and chapter navigation

Add a Story Mode entry to the left sidebar. Its page displays the chapter list, each chapter's completion state and a button to enter it. Entering a chapter replaces the sidebar's workspace list region with chapter progress, distinguishing completed, current and not yet started steps. Clicking the progress list cannot skip an unfinished step.

Provide a way to return to the chapter list. Leaving a chapter restores the ordinary workspace list. While a chapter is active, New Session entry points must not bypass its current step or create an ordinary session.

Use DSH's theme, typography, controls and responsive conventions. Within a chapter, use the actual DSH conversation and trajectory pages, without a separate chapter renderer. Place operational guidance, prerequisite feedback and Continue in the sidebar; expand guidance only for the focused subsection. A subsection may explicitly place its introduction in the main content area, while its operational guidance stays in the sidebar. Other steps show their title and progress state. Example and exercise Sessions open through ordinary navigation into the default Conversation page, retaining its native header, tabs, messages, composer and responsive layout. Apply only the changes required by the current subsection. Chapter activity is independent of the selected panel or view. Configuration pages can open from within a chapter; closing them returns to the same step without losing progress. Private Session titles remain readable. Leaving or disabling Story Mode releases its restrictions and guidance without altering ordinary Sessions or global defaults.

Trajectory steps keep the current conversation and guide the user to select its native Trajectory tab. Temporarily expose that tab for chapter Sessions without changing the global developer setting. An anchored overlay highlights the actual control and gives a short hint; full guidance remains in the sidebar. The overlay follows scrolling and layout changes, waits for a mounted, visible target, and preserves native mouse and keyboard operation. It never clicks the control or provides a substitute switch. Escape dismisses it; a sidebar action restores it. Dismissal does not satisfy the viewing condition. After refresh, use the actual page state and omit the hint when the corresponding trajectory is already displayed.

### Advancement

Support two advancement conditions: a verifiable result of a user operation, and an explicit click to continue. Each subsection specifies its condition. When a manual step has prerequisites, satisfying them enables Continue; it does not advance the step automatically.

### Saved progress and restart

Save chapter progress and its exercise session within the same installation configuration. Refreshing, leaving and re-entering continue the current attempt. Restart resets that attempt's progress; its real conversation exercise uses a new session with no previous conversation history. Exercise sessions are restored only through Story Mode and do not appear in the ordinary session list.

Restoring a page does not automatically resend a model request. A failed, cancelled or interrupted request leaves the exercise available for the user to retry. Chapter completion is displayed explicitly, with actions to return to the chapter list or restart.

## Implementation constraints

Follow the [architecture responsibilities](../architecture.md#responsibilities): the Story Mode plugin owns chapter definitions, progress orchestration, chapter navigation, sidebar guidance and preset content. Other packages provide general mechanisms such as model configuration, request execution and session persistence. Use those mechanisms through their public extension points. Necessary DSH patches follow the [patch scope rule](../../patches/README.md), including its requirement to minimize scope and justify expansion.

When later chapters require architecture changes, every implemented chapter must remain completable from the beginning in the current version. Instructions and preset content can evolve through the text discussion and requirements update process while preserving the learning goals and expected results. Saving progress does not introduce migration support for old progress or session formats.

## Shared acceptance scenarios

- The sidebar entry opens the chapter list with completion states and entry buttons. Entering and leaving a chapter replace and restore the workspace list region correctly.
- Only the focused subsection expands its sidebar guidance. Conversation and trajectory steps use the actual DSH pages.
- Progress identifies completed, current and not yet started steps. Neither the list nor New Session entry points bypass the required sequence.
- Opening and closing configuration preserves the current step. The chapter follows DSH styling in both wide and narrow layouts.
- Refreshing or re-entering restores the current attempt and exercise session; restarting resets progress and uses a fresh conversation for the real exercise.
- Exercise sessions stay out of the ordinary list, and page restoration does not resend requests.
- Every Story Mode text maps to its owning requirement, exact template or documented reuse/data source; missing wording is discussed before implementation, and implementation does not change confirmed text.

## Chapters

- [Chapter 0: hello world](00/README.md)
  - [Section 1: Welcome to Story Mode](00/01-introduction.md)
  - [Section 2: View a conversation example](00/02-conversation-example.md)
  - [Section 3: View the example trajectory](00/03-example-trajectory.md)
  - [Section 4: Send the first message](00/04-first-message.md)
  - [Section 5: View the exercise trajectory](00/05-exercise-trajectory.md)
