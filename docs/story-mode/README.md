# Story Mode requirements

English | [中文](README.zh.md)

Story Mode organizes experiences into storylines, chapters, sections and steps. Its Chinese product name is 故事模式. The [save design](design.md) owns Playbook saves, navigation, chapter submissions and review. [Fogbound Earthshine](fogbound-earthshine/README.md) is the first storyline. These requirements use the existing development and delivery workflow.

## Documents

Use one directory per storyline and one numbered directory per chapter. The storyline README owns its name, introduction and chapter list; the chapter README owns its theme and section sequence. Each numbered section document records steps, user actions, visible results, guidance, advancement conditions and acceptance scenarios. Maintain English, Chinese and pairing files under the [documentation rules](../AGENTS.md).

This document owns common presentation and text rules. The save design owns shared lifecycle behavior, while the [authoring design](../playbook-authoring.md) owns reusable editing and writer capabilities. Chapters reference those owners instead of repeating their contracts. Requirements do not track implementation or delivery status; architecture, APIs and decisions belong to engineering documentation and Agent Notes.

## Text authority

Requirements supply the exact text for everything Story Mode authors or changes: names, introductions, guidance, controls, states, errors, examples and preset prompts. Shared text has one owner; chapter text belongs to its overview or section. Each language supplies its confirmed interface wording. Text declared as a literal remains unchanged across interface languages.

Decide teaching passages, examples, controls and state messages in the requirements, rather than deferring wording to implementation. These passages are the interface text to use. If new content needs text, settle it in the requirements before implementing that content. Existing code is not evidence of approval. Do not add, polish, shorten or replace confirmed text during implementation. A Playbook draft remains the term for authored content that has not been committed; it does not describe the status of teaching copy.

Teaching prose follows an academic exposition: define concepts, explain mechanisms and conditions, then develop practical suggestions. Sections introduce concepts in prerequisite order. The prose develops its explanation independently, followed by examples and analysis that apply it. Practical passages offer suggestions; separately maintained operation guidance uses explicit action instructions. Each section proceeds through concepts and mechanisms, practical suggestions, examples and analysis, and operation guidance. In the prose, an example may be discussed as a kind of prompt content; references to particular teaching examples and their analysis belong in the subsequent example section.

In Chinese teaching prose, introduce a core term with its Chinese name followed by English in parentheses, then use Chinese for later mentions. Keep proper names such as PaperMoon, Playbook, Markdown and XML unchanged. English prose uses natural English. Preserve the technical values of message roles, with Chinese explanations pairing their Chinese names with system, user and assistant.

Dynamic text specifies its complete template and variable sources. Controls reused unchanged identify their source instead of copying upstream wording. Model names and supported effort choices come from model metadata; real replies come from the performance; underlying errors come from their service. Authored text surrounding those values still requires an explicit template.

## Shared interaction

### Presentation and navigation

Use DSH's theme, typography, controls and responsive conventions. The left sidebar retains ordinary workspace, save and session navigation; chapter progress does not replace it. The center hosts editing, writer conversations and performances. The right Story Guide panel holds the current save's teaching content.

Guidance follows the Playbook across its editor, associated writer sessions and performances, including an editor with no session. Switching saves switches the guidance context. Unrelated pages and ordinary sessions hide the guide; returning restores its position. Opening configuration does not change chapter progress. Hiding or closing guidance never relaxes the save's capability restrictions. New Session and other shared entry points must obey those restrictions. Follow the save design for entering, switching and resuming saves.

The guide uses a compact header for the save, chapter, section and step. Its independently scrollable body holds complete teaching, examples, analysis and operation guidance in that order. The footer holds prerequisite feedback and continuation controls. Chapter progress expands into a list of section titles and states. DSH theme colors, typography, spacing, borders and control sizes apply throughout the save entrance and guide. Users can read alongside the central interface; the Playbook receives content through authoring operations.

Examples use the trajectory view's ordered rows, role tags, selected-row emphasis and literal detail pane. Selecting a row by pointer or keyboard displays its complete text with original line breaks. Narrow panels stack the list and detail pane. Display labels follow the lesson's terminology: the first section uses input and response, and later sections introduce message roles. Example selection changes only the displayed detail.

Newly available features show a Newly unlocked tag and the feature name beside the central controls, with emphasis on the corresponding editor tab and area. Opening editing, system prompt editing, model selection and reasoning/performance receive this cue when their section opens. The cue remains until the corresponding content is saved, a valid model is selected or the performance starts. It follows the save's current state across refreshes. Existing progress and authorization determine availability; the cue adds presentation only.

Conversation and trajectory views use the actual DSH pages, retaining native headers, tabs, messages, composer and responsive behavior. Use general editor pages for authoring, with the current capability scope. Native model configuration, model and effort selectors, input fields and Send/Stop controls retain their existing labels and accessibility text. Chapter requirements provide additional authored guidance or controls. Guidance affects only the associated save, not ordinary sessions or global defaults.

### Opening and update reminders

Creating a save opens its editor with the right sidebar collapsed. An anchored hint points to the native expand button and explains how to open Story Guide. Users can open the sidebar or dismiss the hint by its control or Escape. Displaying the guide clears this initial hint; while the hint is visible, it occupies the initial reminder role. Explicitly continuing an existing save opens its guide. Subsequent interaction preserves the user's choice to collapse it, select another right-side tool or resize the panel. Progress updates do not reopen it, select its tab or take focus. The associated page header retains a Story Guide entry so users can return to it.

When the right sidebar is collapsed, show an unseen progress update immediately to the left of its expand button. When it is expanded but another tool is selected, mark the Story Guide tab unread. Selecting the reminder opens the current guide. Clear the reminder only after the latest state is successfully displayed; merge several unseen updates into one reminder. Updates already displayed in the visible guide need no unread mark. Reminders follow their save and cannot appear under another save's identity.

Share the right-side area with other tools, preserving their tabs and state. Do not open a second competing column or clear another tool to show guidance. Panel visibility, reading position and reminders are presentation state, not a second source of story progress.

### Anchored hints and narrow screens

Keep complete teaching text and examples in the guide. When an operation targets the left sidebar or central area, offer a short hint anchored to the real control. The section's operation guidance supplies its text. Users can dismiss and reopen it; preserve keyboard and pointer operation without simulating clicks or covering the target. If the target is absent, hidden or obscured, wait until it can be shown rather than pointing at another control.

Use a fullscreen guide on narrow screens. Before locating a control outside it, close the fullscreen guide while retaining its reading position and return entry. Display the hint when the target becomes visible. Changing the viewport or closing a hint does not complete a step, discard edits or change the save's capabilities.

### Shared interface text

These labels also supply accessible names for their controls. Save, chapter, section and step names and their progress states come from the current save and its requirements. Sidebar expand, collapse and fullscreen controls retain their native labels.

| Use | Text |
|---|---|
| Guide panel, tab and return entry | Story Guide |
| Unseen progress reminder and unread accessible label | Progress updated |
| Locate the current operation | Show me where |
| Dismiss an anchored hint | Dismiss hint |
| Creation hint | Save created. Open the right sidebar here to view Story Guide. |
| Newly available capability | Newly unlocked |
| Opening capability | Opening editor |
| System capability | System prompt editor |
| Model capability | Model selection |
| Performance capability | Reasoning effort and performance |
| Collapsible section list | Chapter progress |
| Operation guidance heading | Current task |
| Frozen content heading | Chapter content |
| Review records heading | Conversation records |
| Save list heading | Your saves |
| Trajectory column accessible labels | Number / Type / Content |

### Advancement

Support advancement through a verifiable result of a user operation or an explicit click to continue. Each step declares its condition. Meeting a manual step's prerequisites enables continuation without advancing automatically. Reading explanatory text has no timer, scroll-to-end requirement, quiz or fabricated completion event.

## Implementation constraints

Follow the [architecture responsibilities](../architecture.md#responsibilities): Story Mode owns storyline content, progress orchestration and stage rules. Reusable authoring, tools, configuration, requests and persistence belong to their extension or platform owners. Integrate through public extension points. Necessary DSH patches follow the [patch maintenance scope](../../patches/README.md).

The right-side host supports Playbook page context and real sessions. The [guidance decision](../../.agents/notes/implemented/architecture/2026-09-29-story-mode-contextual-guidance.md) records ownership and context isolation; the [plugin contract](../../plugins/story-mode/README.md) describes integration. These requirements retain product-level behavior independently of parameter protocols.

Later changes must preserve the learning goals and completion path of retained chapters. Explicitly retired chapter designs are removed from the requirement set without compatibility fixtures or historical-format tests. The [current-format policy](../development.md#frozen-revision-data) applies without adding migration support for old saves.

## Shared acceptance scenarios

- Create a save and verify the collapsed right sidebar and hint anchored to its expand button. Dismiss with the control or Escape, then open the guide manually. The hint clears once the guide displays, and explicit continuation of an existing save opens it.
- Inspect trajectory examples by pointer and keyboard, including multiline content and narrow layouts. Preserve teaching labels, message order, original text and the blank authoring state.
- Unlock each capability and verify its tag and editor emphasis. Saving the corresponding result or starting performance clears its cue; refresh and save switches retain the correct scope.
- Navigation identifies the current save, chapter, section and step. Neither progress navigation nor another entry point bypasses its conditions or capability scope.
- Open guidance in an editor without a session, then move between the save's editor, writer conversation and performance. Keep context and reading position; configuration visits preserve progress, while unrelated pages hide the guide.
- Switch saves and verify isolated content and reminders. Left navigation and other right-side tool tabs remain intact.
- Collapse the guide or select another tool, then advance progress. Show the reminder in the specified location without reopening or taking focus; merge updates and clear only after displaying the latest state.
- Locate real controls in the left and central areas, dismiss and reopen hints, and operate with keyboard and pointer. Missing or obscured targets do not produce misplaced hints.
- On narrow screens, open the fullscreen guide, locate an external control and return to the same reading position without losing edits.
- Manual conditions enable continuation without advancing; automatic conditions use actual completed operations.
- Showing, hiding or leaving the guide neither changes completion conditions nor bypasses authorization. Leaving releases owned hints without changing global preferences.
- Every new interface string maps to requirement text, an explicit template or a documented native/data source. Teaching passages and examples are complete requirement text, and reading does not trigger model requests or populate authored content.

## Storylines

- [Fogbound Earthshine](fogbound-earthshine/README.md)
