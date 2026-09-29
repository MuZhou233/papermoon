# Chapter 1: Your First Character

English | [中文](README.zh.md)

This chapter begins [Fogbound Earthshine](../README.md). Users first learn about inputs and replies, then messages and context, author an opening and a system prompt, and finally choose a model and reasoning effort for their first performance. It follows the [save design](../../design.md), [shared interaction](../../README.md#shared-interaction) and [authoring capabilities](../../../playbook-authoring.md).

## Learning sequence and capabilities

The five sections follow their conceptual prerequisites: how input influences generation, how messages form context, how system instructions shape an exchange, why content placement can produce different effects across models, and how to observe a performance. Each section explains concepts, mechanisms and practical suggestions independently, followed by examples and analysis, then operation guidance.

The initial system prompt is empty and the opening contains zero messages. Examples are reading material; the save starts with blank authored content. Both components use plain-text mode throughout this chapter. Script editing and authoring-mode switching remain closed.

| Section | Newly available content | Advancement |
|---|---|---|
| [1.1 Prompts and Replies](01-prompts-and-replies.md) | Read the teaching text and written example, with no authored-content reads or writes. | Continue manually. |
| [1.2 Messages and Context](02-messages-and-context.md) | Read and edit opening messages manually or through a writer, including bodies, roles and order. | Save the current opening settings, including an empty list, then continue manually. |
| [1.3 System Prompts and Character Design](03-system-prompts-and-character-design.md) | Add system-prompt reading and editing while retaining opening editing. | Save a system prompt containing non-whitespace text, then continue manually. |
| [1.4 Content Placement and Model Differences](04-content-placement-and-model-differences.md) | Select a model while retaining both plain-text editors. | Select a valid model, then continue manually. |
| [1.5 Reasoning Effort and the First Performance](05-reasoning-effort-and-first-performance.md) | Select supported reasoning effort and start a performance. | Receive the first successful complete model reply and persist its chapter submission. |

Full teaching text and examples remain on the right, with currently available operations in the center. Users can read while working and locate controls through short hints. Continuing in 1.1 records only that section's advancement; reading has no duration, scrolling or quiz requirement. Authoring capabilities remain available in later sections. Content changes and comparisons in 1.4 are optional practice.

Writer and manual saves satisfy the same content conditions; continuation remains a user action. Resolve pending edits before continuing or starting, retaining unresolved local work. Check for a nonblank system prompt in 1.3 and again before performance startup. Model configuration and selection use native mechanisms; the selection applies to this performance while global defaults remain unchanged.

The table defines the content scope for both users and writers. Section 1.1 grants no authored-content reads or writes; 1.2 exposes only opening messages; 1.3 through 1.5 expose both openings and the system prompt. Shared status, help, history and metadata entry points obey the same scope. Existing writer sessions update their tools on unlock, and restoration, Fork and each execution recheck current permissions. Program, text-catalog, history-restoration, compilation and progress-editing tools remain closed in this chapter. Users manage model configuration through native entry points for the functions already available. Model selection for this save's performance opens in 1.4; reasoning effort selection and performance startup open in 1.5. General entry points obey the same stage scope.

## Shared examples

This section owns the original examples reused across lessons. Section-specific examples are maintained in their respective requirements. Each section references the relevant parts according to its display instructions, with examples and analysis following the teaching text. Displaying examples does not fill the Playbook, request a model or satisfy the chapter's reply condition. Use the version corresponding to the current interface language.

### Character instructions

> You portray a lighthouse keeper who lives beside a foggy harbor. Speak in short, calm sentences and describe what you can see and hear. When the visitor asks about something you do not know, say so and ask what they have discovered.

### Opening messages

| Role | Body |
|---|---|
| User (user) | Dusk settles over the harbor. I reach the lighthouse door with a damp map. |
| Assistant (assistant) | The keeper opens the door a little. “Come inside. What brought you out in this fog?” |

### First input

> I spread the map on the table. Have you seen this mark before?

## Chapter text

The chapter title is Your First Character; section titles use the sequence table's labels. Shared controls use the following exact text under the [text authority rule](../../README.md#text-authority). Guide, reminder and hint controls use the [shared interface text](../../README.md#shared-interface-text). Saving and other editing controls reuse the general editor, while model and conversation controls reuse native pages.

| Purpose | Text |
|---|---|
| Manual advancement | Continue |
| Startup | Start performance |
| Remain in conversation | Keep chatting |
| Next chapter | Enter Chapter 2 |
| Next chapter unavailable | Chapter 2 is not available yet. You can keep chatting. |

## Completion and continuation

The [fifth section](05-reasoning-effort-and-first-performance.md#startup-and-completion) owns the successful-reply condition and submission behavior. Submission success completes Chapter 1, creates its chapter tag and opens read-only chapter review under the shared save rules. Completion still depends on the qualifying reply and durable submission; model comparisons and content changes are creative choices.

Keep the performance open after completion. Users can continue chatting or enter Chapter 2 once available. While it is unavailable, show the explanation and disable entry. Later requirements own Chapter 2's content.

## Acceptance scenarios

- Complete all five sections from blank content using manual editing, writer assistance or both. Examples follow each section's teaching, which can be read independently.
- Read the full lesson and examples on the right while writing or chatting in the center. Hints locate real controls, and unseen progress follows the shared reminder rules while preserving focus.
- Grant no authored-content access in 1.1, opening-only access in 1.2, and system-prompt access from 1.3. Editors, tools, status and help share the scope; existing sessions update on unlock, and stale calls and indirect access are rejected.
- Allow empty openings. Require a nonblank system prompt for advancement in 1.3 and startup in 1.5 while general draft storage continues to accept unfinished content.
- Allow model selection and continuation in 1.4 with existing content. Comparisons and repeated replies add no completion gate, and general startup entry points obey the stage restriction.
- Complete only after the qualifying reply and tagged chapter submission are durable. Further conversation and read-only review preserve current progress.
- Permit Chapter 2 entry only when available and retain an explicit explanation while it is closed.
