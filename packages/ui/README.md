# PaperMoon UI

English | [中文](README.zh.md)

This library owns PaperMoon's React controls and editor views. Feature pages import @papermoon/ui instead of DSH component implementations. Components accept props and callbacks; they do not access storage, sessions or Cordis services.

## Sources and theme

The selected Button, Input, Menu and Modal implementations and their required styles originated from the official DSH commit recorded in [provenance.json](provenance.json). Each copied file records its original path and source hash. The [upstream license](DSH-LICENSE) is retained. Local changes are maintained here; setup and DSH upgrades do not refresh these copies automatically. New icons, controls and editor bindings are PaperMoon-owned. PromptTrace adapts the recorded DSH trajectory table styles into a static row list and detail pane; it has no Session dependency.

The theme adapter maps DSH CSS variables into PaperMoon variables. Controls inherit the surrounding font and support the existing light and dark themes. Dropdowns use the copied custom menu. Single-line inputs keep hover and focus emphasis on their outer border, without changing size or adding an inner focus outline. Modal focus is contained and restored to the previous element on close. Callers supply localized labels; business content remains literal user text.

## Editing

CodeEditor wraps CodeMirror 6 with line numbers, highlighting, search, undo and readonly presentation. It reports changes without owning saves or revision identities. An explicit diagnostic target selects and scrolls to its one-based line and column; the caller verifies which content that target belongs to. Each mounted file keeps its editor state while hidden by the file switcher. JavaScript, TypeScript, JSON and Markdown have highlighting; other files use plain text. Highlighting is not compilation.

CodeDiff shows readonly before/after values. Its comparison controls do not merge or restore content. Text catalogs use ordinary multiline fields rather than code-oriented controls. The [script editor](../../plugins/playbook-editor/README.md) owns those workflows.

PromptTrace displays literal system, user and assistant messages, preserving order and line breaks without interpreting Markdown or assigning runtime event identities.

## Maintenance

Main-repository checks validate component ownership and source records without reading DSH. Browser scenarios exercise the actual bundle, keyboard controls, readonly content and responsive layout. Dependencies and copies follow PaperMoon's [maintenance rules](../../AGENTS.md).

FunctionPreview renders readonly initial state and function declarations with caller-provided labels. It imports no compiler service; author text is rendered as text and JSON.
