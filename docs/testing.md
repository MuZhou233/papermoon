# Testing and delivery

English | [中文](testing.zh.md)

## Main repository

Run focused behavior tests during development and the relevant commands before committing. CI runs the complete main check. Tests cover parser failures, lifecycle transitions, Git baselines, process cancellation and actual patch reconstruction. Main checks neither build nor inspect DSH sources. They do not impose a per-file coverage quota.

Document checks are read-only. Their fixtures exercise both valid and invalid examples even when the live repository has no diagrams, type excerpts or archives. Automated checks verify document structure, content hashes and command results. Reviewers assess translation quality, the reasoning behind alternatives and whether a consolidated Note preserves every meaningful argument.

The main workflow separates engineering readiness from product experience feedback. No live-model transcript or GIF is mandatory for main-repository changes.

## DSH patches

Follow the checked-out submodule's delivery requirements for effective changes there. Register the selected package scripts and argument arrays in the patch series. Their successful execution is evidence only for those checks; reviewers confirm that the selection satisfies DSH requirements. Keep required DSH tests, documentation and Notes inside the patches.

Source comparison and delivery checks serve different purposes. A patch that applies successfully still needs the required tests. Changes produced by registered patches are expected and pass the source comparison. [Patch maintenance](../patches/README.md) defines the command configuration.

## Isolation and CI

Tests allocate temporary Git repositories, files and loopback ports and release resources on failure as well as success. Process tests wait for observable readiness rather than assuming fixed startup timing. Tests verify file and process outcomes independently of command self-reports.

The main CI workflow runs without fetching the submodule. The integration workflow runs for Gitlink, patch, launcher, build and related dependency changes. It initializes the submodule, builds, checks patches and runs a temporary Web smoke. Documentation-only changes do not request a DSH build.

In CI, archive checks compare against the trusted PR base or the commit before the push. Local checks use HEAD, or an empty baseline after confirming that the repository has no commits. An explicitly supplied baseline that cannot be read is an error. Test fixtures create their own Git history and cannot rewrite the repository’s archive baseline.
