# Testing and delivery

English | [中文](testing.zh.md)

## Main repository

Run focused behavior tests during development and the relevant commands before committing. CI runs the complete main check. Tests cover parser failures, lifecycle transitions, Git baselines, process cancellation and actual patch reconstruction. Main checks neither build nor inspect DSH sources, and they do not impose a per-file coverage quota. Workspace source aliases let plugin tests and documentation examples run without prebuilt plugin artifacts.

Document checks are read-only. Their fixtures exercise both valid and invalid examples even when the live repository has no diagrams, type excerpts or archives. Automated checks verify document structure, content hashes and command results. Reviewers assess translation quality, the reasoning behind alternatives and whether a consolidated Note preserves every meaningful argument.

The main workflow separates engineering readiness from product experience feedback. No live-model transcript or GIF is mandatory for main-repository changes.

## Before committing

The Agent making a main-repository change follows these steps before committing it. Applied DSH changes retain the submodule's delivery requirements.

1. Inspect the changes, including new files. Confirm that the code, documentation and owning Note describe the same behavior.
2. If the change includes Chinese or English prose, read the [bilingual writing guide](../.agents/skills/bilingual-syntax-style-guide/SKILL.md). Review the changed passages with their surrounding paragraphs. This includes documentation, Notes, skill instructions, comments and user-facing text. Read each language on its own for natural phrasing. For paired documents, also compare meaning and technical details. Preserve identifiers, protocol values and text that must remain verbatim. A change without prose needs no language review.
3. After revising and reviewing the text, update the affected bilingual records and run the relevant checks. Reuse passing results when the checked content has not changed; rerun affected checks after further edits.
4. Inspect the staged diff and run `git diff --cached --check`. Confirm that the intended files are included and private data and build outputs are excluded. Review any text changed since the language review before committing.

The Agent performs the language review as part of its work. Automated document checks verify structure, links and hashes; they do not judge syntax or style. Report language review separately from command results, and only report what was actually reviewed.

## DSH patches

Follow the checked-out submodule's delivery requirements for effective changes there. Register the selected package scripts and argument arrays in the patch series. Their successful execution is evidence only for those checks; reviewers confirm that the selection satisfies DSH requirements. Keep required DSH tests, documentation and Notes inside the patches.

Source comparison and delivery checks serve different purposes. A patch that applies successfully still needs the required tests. Changes produced by registered patches are expected and pass the source comparison. [Patch maintenance](../patches/README.md) defines the command configuration.

## Isolation and CI

Tests allocate temporary Git repositories, files and loopback ports and release resources on failure as well as success. Process tests wait for observable readiness rather than assuming fixed startup timing. Tests verify file and process outcomes independently of command self-reports.

The main CI workflow runs checks and builds main plugins without fetching the submodule, then executes `pnpm check:plugins:pure` to verify the emitted core imports. The integration workflow runs for Gitlink, patch, launcher, build, storage/core/editor/writer/tool plugins, UI components, profiles and related dependency changes. It initializes the submodule, builds, checks patches, runs `pnpm check:plugins:dsh` against real Cordis and runs the original-Web smoke plus `pnpm test:editor`. Browser scenarios cover manual edits, history, recovery, conflicts and authentication with temporary runtime data; CI installs Chromium first. Storage and business-repository unit tests use temporary databases without DSH; the dedicated plugin check uses built artifacts without starting Web or calling a model. Documentation outside the integration path filters does not request a DSH build.

In CI, archive checks compare against the trusted PR base or the commit before the push. Local checks use HEAD, or an empty baseline after confirming that the repository has no commits. An explicitly supplied baseline that cannot be read is an error. Test fixtures create their own Git history and cannot rewrite the repository’s archive baseline.

Writer unit tests cover settings, literal context and unsaved decisions. Script-tool tests exercise temporary repositories; the real DSH check additionally verifies scope isolation and tool output validation. Browser scenarios cover prompt ordering, readonly catalog presentation, navigation protection and conflicting saves. Main checks remain independent of the managed checkout.

Writer-session checks use actual DSH admission, request assembly and tool services. `pnpm test:writer-sessions` drives temporary Web sessions with a deterministic adapter and checks the outgoing messages, fixed settings, restoration, authored-context display and mode changes with unsent text. It does not contact a model provider or reuse user runtime data.

Compiler tests cover restricted modules, literal messages, translation failures, deadlines, cancellation, fixed snapshots and immutable artifact writes. Main CI also runs `pnpm check:compiler:built` without DSH. The compiler directory is included in integration path filters. Real tool and writer-runtime checks include asynchronous `story_compile` results; browser scenarios cover save confirmation, diagnostic navigation, source changes and artifact recovery. The built check reports the local Node version; passing locally does not claim a CI result.

Submission tests cover failed and multi-target compilation, final sequence conflicts, cancellation, attachment limits and atomic rollback. Storage tests corrupt and remove payloads, share revisions and reclaim their last references. Performance tests close the compiler before reading frozen artifacts. pnpm test:writer-sessions also verifies opening-only sessions, exact first requests, Fork and source deletion. The generic DSH presentation patch has separate list, search, event validation and SDK evidence.
