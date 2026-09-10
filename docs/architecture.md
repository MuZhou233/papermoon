# Repository architecture

English | [中文](architecture.zh.md)

## Responsibilities

The main repository owns plugins, tooling, documentation, dependencies and CI. The Gitlink at `dsh/` pins the official implementation; it is not a main workspace package. Effective DSH changes are stored as patches and delivered under submodule standards. Patch tooling itself is main-repository code. Mixed changes carry separate evidence for their two owners.

The main rules are self-contained. Consuming a DSH interface does not import its package structure, runtime design rules, SDK requirements or organization workflows into main-repository policy. The [maintenance decision](../.agents/notes/implemented/process/2026-09-11-independent-maintenance.md) records this choice.

## Launch and data

The launcher executes DSH's official built CLI with the standard Web profile and the PaperMoon root as its working directory. Dependency installation and build run inside the submodule. Installation and build inherit `CI=true` for DSH's supported automated-install path; the development hook installer otherwise rejects the submodule's Git configuration. Patch checks receive their normal environment, and launch does not force this setting.

The launcher supplies independent default data homes and delegates configuration, authentication, model behavior and UI to DSH. No separate server, profile composition or application API is introduced. [Development](development.md) owns the command interface.

## Maintenance tools

Main checks read main-owned files and fixtures, excluding the submodule, dependency directories and runtime data. Adapted checkers live independently in `tooling/checks/`; they retain their original license and provenance. The [checker guide](../tooling/checks/README.md) owns their configuration and limitations.
