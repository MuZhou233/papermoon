# Testing and delivery

English | [中文](testing.zh.md)

## Main repository

Run focused behavior tests during development and the relevant commands before committing. CI runs the complete main check. Tests cover parser failures, lifecycle transitions, Git baselines, process cancellation and actual patch reconstruction. Main checks neither build nor inspect DSH sources. They do not impose a per-file coverage quota.

Document checks are read-only. Their fixtures exercise both valid and invalid examples even when the live repository has no diagrams, type excerpts or archives. Machine checks verify structure, identities and executable results; they cannot judge translation quality, the strength of an alternative, or whether consolidation preserved every meaningful argument.

The main workflow separates engineering readiness from product experience feedback. No live-model transcript or GIF is mandatory for main-repository changes.

## DSH patches

Follow the checked-out submodule's delivery requirements for effective changes there. Register the selected package scripts and argument arrays in the patch series. Their successful execution is evidence only for those checks; reviewers confirm that the selection satisfies DSH requirements. Keep required DSH tests, documentation and Notes inside the patches.

The source comparison is independent of delivery checks. An applicable patch is not a passing product test, and expected patch modifications do not make the checkout invalid. [Patch maintenance](../patches/README.md) defines the command configuration.

## Isolation and CI

Tests allocate temporary Git repositories, files and loopback ports and release resources on failure as well as success. Process tests wait for observable readiness rather than assuming fixed startup timing. Tests verify file and process outcomes independently of command self-reports.

The main CI workflow runs without fetching the submodule. The integration workflow runs for Gitlink, patch, launcher, build and related dependency changes. It initializes the submodule, builds, checks patches and runs a temporary Web smoke. Documentation-only changes do not request a DSH build.

Archive checks use the trusted PR base or pre-push commit in CI. Local checks default to HEAD, with a verified unborn-repository case for the first commit. An explicitly supplied missing baseline fails. Test fixtures create their own Git history and cannot rewrite the repository's archive baseline.
