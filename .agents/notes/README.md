# Agent Notes

English | [中文](README.zh.md)

## Purpose and ownership

A Note preserves a main-repository decision, its motivation, real alternatives and consequences. Non-trivial main changes add or update the owning Note; mechanical local edits are exempt. Search existing Notes before adding one. DSH-only patch decisions follow the submodule's Note rules and remain inside patches.

Use the lifecycle and class directories as the inventory, with filenames `YYYY-MM-DD-topic.md`. The date is when the topic was first proposed. There is no central index. Classes are `feature`, `bug-fix`, `simplification`, `architecture`, `process` and `testing`. Empty classes need no placeholder records.

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

Creation supports `--status`, `--date` and a rejection `--reason`. Templates contain explicit unfinished markers, which checks reject until replaced. Creation does not claim that a decision is complete.

Transition accepts prepared bilingual content with the destination status and sections. Relative links in prepared files are interpreted from the old Note location. The tool validates before moving the complete triplet, rebases relative links and repairs active incoming references. Only proposals transition to implemented or rejected. Reviewing the prepared content remains the author's responsibility.

## Supersession and consolidation

For partial supersession, retain both Notes, update surviving facts and cross-link the decisions. A complete consolidation may delete the old triplet only after the new owner preserves all unique rationale, alternatives, consequences, required verification and known gaps. Repair every incoming reference. Do not rely on Git history as the only remaining explanation.

Keep a rejected proposal only while it prevents a plausible, meaningful mistake; otherwise delete the triplet and repair references. These are reviewed editorial operations, not automatic age-based cleanup. Link checks detect dangling references but cannot certify that every argument was preserved.

## Archive and freeze

Archive only an implemented decision whose reasoning is unlikely to guide future work. Retain useful ownership, data, security and reintroduction reasoning as active records. Never archive by age, count or word budget.

```sh
pnpm note archive .agents/notes/implemented/process/2026-09-11-topic.md --date 2026-09-11
pnpm check:notes
```

The command moves the complete English, Chinese and pairing triplet to the archive class directory, retains the implemented status, inserts a matching `Archived:` date and seals every artifact. These are the only body changes during archival. Outbound links remain historical; active incoming references are repaired.

Once sealed, the triplet cannot be edited, translated, renamed, moved or deleted. The append-only manifest records content hashes. Checks compare both files and manifest with committed history, so rewriting the hashes cannot authorize a change. Archive files are not current authority and are excluded from evolving prose and outbound-link rules.

`PAPERMOON_ARCHIVE_BASE_REF` supplies an explicit trusted Git baseline. Local checks otherwise use HEAD; a verified unborn repository uses an empty baseline. A missing explicit baseline is an error. CI obtains its baseline from the pull request base or pre-push commit, never from a change-controlled manifest.
