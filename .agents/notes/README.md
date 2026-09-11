# Agent Notes

English | [中文](README.zh.md)

## Purpose and ownership

A Note preserves a main-repository decision, its motivation, real alternatives and consequences. Non-trivial main changes add or update the owning Note; mechanical local edits are exempt. Search existing Notes before adding one. DSH-only patch decisions follow the submodule's Note rules and remain inside patches.

Find Notes by status and class directory; no central index is maintained. Filenames use `YYYY-MM-DD-topic.md`, where the date records when the topic was first proposed. Classes are `feature`, `bug-fix`, `simplification`, `architecture`, `process` and `testing`. Empty classes need no placeholder records.

## Active states

Every Note starts with an Agent Note title, a blank line and a `Status:` line. The language switcher follows the status. Both languages retain the machine-readable header tokens and the same status, including a rejection reason. Human section headings are translated.

| Directory | Required English sections |
|---|---|
| `proposed` | Problem, Proposal, Alternatives considered, Acceptance criteria, Risks |
| `implemented` | Problem, Decision, Alternatives considered, Consequences |
| `rejected` | Problem, Proposal, Alternatives considered; rejection reason in status |

The first section is Problem. Implemented Notes describe shipped facts and do not retain proposal or acceptance-plan sections. Keep their facts current when paths, names and responsibilities change. A different decision needs a new Note, not an opposite conclusion edited into the old one. Alternatives are genuine options, never invented to satisfy a template.

## Create and transition

```sh
pnpm note new --class process --slug topic --title "Topic" --title-zh "主题"
pnpm note transition .agents/notes/proposed/process/2026-09-11-topic.md --to implemented --english prepared.md --chinese prepared.zh.md
pnpm docs:record .agents/notes/implemented/process/2026-09-11-topic.md
pnpm check:notes
```

The creation command accepts `--status`, `--date` and a rejection `--reason`. Replace the templates’ unfinished markers before running checks. Creating a Note does not mean the decision has been implemented.

To transition a Note, prepare both language versions with the target status and required sections. Write their relative links as if the files were still at the Note’s original location. After validation, the tool moves the English, Chinese and pairing files together, adjusts relative links and updates references in active documents. Only proposals can transition to implemented or rejected. The author must review the prepared text.

## Supersession and consolidation

When a decision replaces only part of an earlier one, keep both Notes, update the facts that still apply and link them to each other. Delete an old triplet only after the consolidated Note preserves every distinct reason, alternative, consequence, verification requirement and known gap. Update all references to the removed files. The explanation must remain available without searching Git history.

Keep a rejected proposal while its reasoning can help others avoid a mistake they might otherwise repeat. When it no longer serves that purpose, delete the triplet and update its references after review. Do not delete records automatically because they are old. Link checks find broken references but cannot establish whether every argument was preserved.

## Archive and freeze

Archive only an implemented decision whose reasoning is unlikely to guide future work. Keep reasoning about ownership, data, security or reintroducing an approach active while it remains useful. Never archive based on age, count or word limits.

```sh
pnpm note archive .agents/notes/implemented/process/2026-09-11-topic.md --date 2026-09-11
pnpm check:notes
```

The command moves the complete English, Chinese and pairing triplet to the archive class directory, retains the implemented status, inserts a matching `Archived:` date and seals every artifact. These are the only body changes during archival. Outbound links remain historical; active incoming references are repaired.

Once sealed, the triplet cannot be edited, translated, renamed, moved or deleted. The append-only manifest records content hashes. Checks compare both files and manifest with committed history, so rewriting the hashes cannot authorize a change. Archive files are not current authority and are excluded from evolving prose and outbound-link rules.

Set `PAPERMOON_ARCHIVE_BASE_REF` to compare against a specific trusted Git baseline. Local checks otherwise use HEAD, or an empty baseline after confirming that the repository has no commits. An explicitly supplied baseline that cannot be read is an error. CI uses the pull request base or the commit before the push, so changing the manifest cannot change the baseline.
