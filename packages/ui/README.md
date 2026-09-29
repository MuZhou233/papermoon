# PaperMoon UI

English | [中文](README.zh.md)

This library owns PaperMoon's React controls and editor views. Feature pages import @papermoon/ui instead of DSH component implementations. Components accept props and callbacks; they do not access storage, sessions or Cordis services.

## Sources and theme

The selected Button, Input, Menu and Modal implementations and their required styles originated from the official DSH commit recorded in [provenance.json](provenance.json). Each copied file records its original path and source hash. The [upstream license](DSH-LICENSE) is retained. Local changes are maintained here; setup and DSH upgrades do not refresh these copies automatically. New icons, controls and editor bindings are PaperMoon-owned. PromptTrace adapts the recorded DSH trajectory table styles into a static row list and detail pane; it has no Session dependency.

The theme adapter maps DSH CSS variables into PaperMoon variables. Controls inherit the surrounding font and support the existing light and dark themes. Dropdowns use the copied custom menu with an opaque layer-2 background in both light and dark themes. Portaled menus move keyboard focus into their options after positioning makes the list visible; subsequent repositioning preserves the focused option. Single-line inputs keep hover and focus emphasis on their outer border, without changing size or adding an inner focus outline. Modal focus is contained and restored to the previous element on close. Callers supply localized labels; business content remains literal user text.

## Editing

CodeEditor wraps CodeMirror 6 with line numbers, highlighting, search, undo and readonly presentation. It reports changes without owning saves or revision identities. An explicit diagnostic target selects and scrolls to its one-based line and column; the caller verifies which content that target belongs to. Each mounted file keeps its editor state while hidden by the file switcher. JavaScript, TypeScript, JSON and Markdown have highlighting; other files use plain text. Highlighting is not compilation.

The editor theme uses DSH's resolved color variables for native and drawn carets, selections, search controls, bracket matches and revision differences. Syntax tokens use the same palette as DSH code blocks. Theme changes update these colors through CSS, preserving focus, selection, undo history and unsaved text.

CodeDiff shows readonly before/after values. Its comparison controls do not merge or restore content. Text catalogs use ordinary multiline fields rather than code-oriented controls. The [script editor](../../plugins/playbook-editor/README.md) owns those workflows.

The shared `MessageRole` badge uses the trajectory table palette for system (neutral), user (blue) and assistant (violet). Editor role triggers and menu options reuse the badge.

PromptTrace displays literal system, user and assistant messages, preserving order and line breaks. Pointer and keyboard selection open the corresponding detail pane. Optional `roleLabel` supplies teaching terminology while retaining the technical role; `compact` reduces the minimum height and bounds the detail area for side panels. Responsive layouts stack the list and details. Rendering is static text, independent of runtime event identities.

## Maintenance

Main-repository checks validate component ownership and source records without reading DSH. Browser scenarios exercise the actual bundle, keyboard controls, readonly content and responsive layout. Dependencies and copies follow PaperMoon's [maintenance rules](../../AGENTS.md).

FunctionPreview renders readonly initial state and function declarations with caller-provided labels. It imports no compiler service; author text is rendered as text and JSON.

## Explicit highlighting

`CodeEditor.highlight` accepts `markdown` or `xml` for plain authoring. A CodeMirror compartment reconfigures only the language extension, preserving the document, selection, undo history and pending edits. Callers persist the choice as a display preference. Incomplete markup remains editable and saveable.
