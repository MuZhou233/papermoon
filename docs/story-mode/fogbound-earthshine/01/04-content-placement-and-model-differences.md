# 1.4 Content Placement and Model Differences

English | [中文](04-content-placement-and-model-differences.zh.md)

This section belongs to [Your First Character](README.md). It builds on the three message roles to discuss content placement, expose model selection and establish criteria for observing the first performance.

## Steps and interface

| Step | Action | Visible result |
|---|---|---|
| 1 | Read the teaching text, then compare several arrangements of the same character details. | The right panel explains roles and placement before showing examples and analysis; both editors remain available. |
| 2 | Choose a preferred configured model and optionally change the content arrangement. | Native model controls show the current choice, with native configuration available when needed. |
| 3 | Resolve pending edits and continue manually. | A valid model choice permits entry to 1.5, including with the existing content. |

Keep system-prompt and opening-message editing and the corresponding writer scope. Model selection uses native mechanisms and applies to this performance while global defaults remain unchanged. Return to the current save after adding configuration. Model configuration and selection belong to the user; performance startup becomes available in 1.5.

## Teaching

The following passages are the complete text for the right-side guide under the [text authority rule](../../README.md#text-authority).

> Message roles give content different positions in an exchange. The same passage establishes a different conversational relationship when it enters the context as a system instruction, content supplied by the user, or something the assistant has already said. The content, its role label and its position can all influence the model's next reply.

> Models differ in the conversation formats they encountered during training, their instruction training and their generation habits. They can therefore respond differently to the same content arrangement. Some arrangements may help a particular model sustain character details, while others may better support the continuation of a voice or narrative style.

> In character performance, content placement can extend beyond the three roles' conventional functions. Ongoing character instructions can appear in a user message alongside a particular situation. Behavioral conventions can also be written as the character's own statements in assistant history, giving later generation an expression to continue from. For a particular model, these arrangements may produce results closer to the creative intent than conventional placement.

> Content placement can be considered in terms of both the purpose of the instructions and the actual reply. Consistency of identity and motivation, responsiveness to the situation and the intended language style can all inform that assessment. Comparing arrangements of the same character details and observing several exchanges can help establish an approach suited to the current model and character.

## Example and analysis

After the teaching text, display the following three arrangements in order. The first two reuse the [character instructions verbatim](README.md#character-instructions); the third uses this section's rewritten passage. Follow each arrangement with the [shared opening](README.md#opening-messages), preserving its wording and order. The table's labels are interface text; the body sources and display roles are requirement instructions.

| Label | Body source and display role |
|---|---|
| System instructions | The original character instructions, with the system role. |
| Instructions in a user message | The same original character instructions, with the user role. |
| Assistant self-description | The rewritten passage below, with the assistant role. |

Exact text for the assistant self-description:

> I live beside a foggy harbor and tend its lighthouse. I speak in short, calm sentences and pay attention to what I can see and hear. When I do not know something, I say so and ask visitors what they have discovered.

Display this analysis after the three arrangements:

> The first arrangement supplies the character details as overall instructions, the second places the same words in a user message, and the third presents identity and behavior as something the character has already said. The first two can help reveal the effect of role placement; the third also changes the perspective of the writing. Their effects can be assessed through the character behavior and language later produced by the selected model. Basic task instructions can remain in the system prompt while other details are placed according to the observed performance.

These examples illustrate the placement of character details as one part of the input. A nonblank system prompt still needs to be saved under the chapter's startup condition. Examples neither rewrite the save automatically nor present fabricated model-comparison results.

## Operation guidance

Use the following text near the model selector and in its location hint:

> Choose a configured model, then continue.

| Condition | Text |
|---|---|
| No valid model selection | Choose a configured model before continuing. |

## Advancement

A valid configured model selection enables manual continuation. Resolve pending edits before continuing. Existing content satisfies this section's requirements; changing message roles, comparing models and making requests add no conditions. This section does not start a performance. The [fifth section](05-reasoning-effort-and-first-performance.md#startup-and-completion) rechecks the model and saved content before startup.

## Acceptance scenarios

- Continue with existing content after selecting a valid model. If none is available, show the explanation and return to the same save and progress after native configuration.
- Apply model selection to this performance while preserving global defaults. Writers retain access only to the system prompt and opening messages.
- Optional edits follow save, conflict and permission rules while preserving roles and order exactly. Resolve pending content before continuation.
- The three examples follow the required body sources, labels and order. Reading and comparing them neither request a model nor change the save.
- Reject early performance startup through both controls and general entry points. On reaching 1.5, recheck the model and handle a removed or invalid selection.
