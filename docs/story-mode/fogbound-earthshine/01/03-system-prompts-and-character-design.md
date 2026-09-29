# 1.3 System Prompts and Character Design

English | [中文](03-system-prompts-and-character-design.zh.md)

This section belongs to [Your First Character](README.md). It builds on messages and context to introduce system instructions, compare all three message roles and expose plain-text system-prompt editing.

## Steps and interface

| Step | Action | Visible result |
|---|---|---|
| 1 | Read the teaching text, then the complete example with system instructions. | The right panel explains how overall instructions relate to a particular exchange, followed by the example. |
| 2 | Write the system prompt manually or ask a writer to help. | The system-prompt editor becomes available in the center while opening editing remains accessible. |
| 3 | Save a nonblank system prompt and continue. | Persist this section's completion and enter 1.4. |

This stage adds system-prompt reads and writes while retaining opening-message access. Both entry points share the [plain-text editing experience](../../../playbook-authoring.md#manual-editors), including Markdown/XML highlighting, search, undo/redo and save state. Writers gain system-prompt read and edit tools with the same scope as manual editing. Existing writer sessions update their tools and help on unlock, and every call checks the current scope.

## Teaching

The following passages are the complete text for the right-side guide under the [text authority rule](../../README.md#text-authority).

> A system prompt supplies task and behavioral instructions that apply across an exchange. This content is usually passed through the system role or the corresponding location provided by the model's interface. Together with user and assistant messages, it forms the context used for generation.

> The conventional functions of the three roles can now be considered together: the system role describes the overall task and behavioral instructions, the user role supplies the current input to address, and the assistant role presents the model's side of the exchange. The model interprets these contents and their relationships according to the instruction priorities and processing conventions of the model and interface in use.

> In character performance, a system prompt can hold relatively stable character details, such as identity, experience, motivation, knowledge, relationships and expressive style. It can also establish which characters the model portrays and which narrative perspective it uses. Particular events and developments can then enter the context through messages as the exchange progresses.

> Character details can be organized around how a person understands a situation, makes choices and expresses themselves. Traits with greater influence on interaction may benefit from fuller treatment, while background details can develop through further authoring. Coherent details can help a model apply the character's traits across different situations.

## Example and analysis

After the teaching text, display the [character instructions](README.md#character-instructions) with the label System (system), followed by the [two opening messages](README.md#opening-messages). Preserve the shared wording in all three parts, then display this analysis:

> The system instructions establish the keeper's identity, manner of speaking and approach to unfamiliar information. The user message describes the visitor's arrival, and the assistant message responds by opening the door and asking a question. Character details and the current situation together provide a basis for the exchange.

## Operation guidance

Use the following text near the system-prompt editor and in its location hint:

> Describe the character and their behavioral instructions, then save and continue. You can write them yourself or ask a writer for help.

| Condition | Text |
|---|---|
| Blank saved prompt | Save a system prompt containing some text before continuing. |

## Advancement

Continue becomes available when the saved system prompt contains at least one non-whitespace character. Do not trim or rewrite the stored value when checking it. Resolve pending edits before continuing. Saving does not itself advance the section; a writer's successful save satisfies the same condition as a manual save.

The content condition is limited to nonblank text, with no assessment of character quality, additional length, format or similarity to the example. Incomplete markup can be saved. Reading the explanation, changing highlighting and manually saving do not call a model; an explicitly requested writer conversation follows the normal writer request path. Performance startup remains available only in 1.5.

## Acceptance scenarios

- The system-prompt editor is empty when first exposed, and existing opening messages remain intact. Examples are not inserted automatically.
- Empty and whitespace-only system prompts can be saved as drafts but do not enable continuation. A nonblank manual or writer save enables manual continuation without automatically advancing.
- Preserve exact text through Markdown/XML switches, save/reload and incomplete markup. Conflicts and failed saves retain local work.
- Add system-prompt tools and help to a writer session opened in 1.2 while retaining opening capabilities. Restoration, Fork and stale-call execution check current permissions.
- Deny direct and indirect access to programs, text catalogs, history restoration, compilation, progress editing and other unopened capabilities.
