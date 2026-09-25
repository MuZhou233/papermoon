# Story Mode plugin

English | [中文](README.zh.md)

This switchable bundle implements [Chapter 0: hello world](../../docs/story-mode/00/README.md). Requirements remain in the chapter documents; this document describes the plugin boundary and operation.

## Ownership

The plugin owns the five-step chapter, guidance, fixed example, effort advice and progress gates. It consumes the [text conversation extension](../text-conversations/README.md), [anchored guidance](../ui-guidance/README.md), DSH settings navigation and native conversation pages. General model configuration, Agent execution, session persistence and trajectory rendering remain outside this layer.

Progress is stored atomically at `$DSH_HOME/story-mode/hello-world.json`. An attempt ID rejects actions from stale pages after a restart. Practice uses a fresh DSH Session, allocated at the fourth step; restart retains the former session on disk but never reuses it. Saved progress references the practice session rather than copying its log. Unsupported progress fails without modifying the file.

The client replaces the sidebar workspace region only while a chapter is active, using the existing slot priority mechanism. Its effect-owned New Session handler returns to the current step. Only the focused step expands sidebar guidance and Continue. The introduction occupies the main area with an optional settings button. Advancement requires at least one configured model, regardless of the default selection; visiting settings is not a gate. Read failures block advancement and can be retried without losing the attempt. These checks never invoke a model or choose one for the user. A new practice retains a valid current selection, or leaves selection to the native model control.

Example and practice use normal Session navigation into the default Conversation page, including its header and tabs. Chapter activity is independent of the current panel; settings and view changes never leave the chapter or trigger repeated navigation. The fixed example is a separate readonly Session seed without model calls, copied practice history or fabricated usage. Practice remains writable during trajectory inspection and after chapter completion. The first completed turn establishes its inspection target; later replies, failures and cancellation never change that target or revoke progress. Completion does not stop the Agent.

The two trajectory steps keep the current view and highlight its native Trajectory tab. Users select it themselves; the target reply's actual native row must be visible before Continue unlocks. A later reply, background projection or hidden/virtualized row cannot acknowledge the target. Escape dismisses the hint, and the sidebar can show it again. Per-Session owner leases expose Trajectory and constrain tools, attachments and mode controls without changing developer settings or model defaults. Leaving or unloading releases those leases, the selected private page and all guidance.

`src/locales.ts` holds the confirmed requirement copy for both Host and Client. Story RPC failures carry a stable key for localization; underlying errors retain their original message. Copy tests check every owned string against the corresponding language's requirement documents, including fixed prompt and example text. Changing wording requires updating the requirements first.

## Enable and disable

`pnpm start` initializes the PaperMoon profile with this bundle enabled. Use DSH's Plugins page to disable or re-enable it. The bundle remains installed and visible while disabled; future launches retain the selection. Unloading stops and drains its owned practice Agent, removes its UI and keeps progress. Re-enabling does not resend input. The text conversation extension remains mounted independently.

## Verification

`pnpm test:story-mode` runs the hosted application with a deterministic model adapter and temporary data. It exercises configuration availability and recovery, invalid default selection, both trajectories, actual requests, continued conversation after completion, effort advice, failure, stopping, refresh and restart. It does not use live model credentials.
