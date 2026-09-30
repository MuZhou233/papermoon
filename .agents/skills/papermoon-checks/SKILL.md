---
name: papermoon-checks
description: Review PaperMoon changes before commits or readiness reports, including scoped checks, bilingual prose and UI design review when applicable.
---

# papermoon-checks

Before committing or reporting that a change is ready, follow the [delivery workflow](../../../docs/testing.md#delivery-workflow). Review the complete change, including new files, and confirm that the implementation, tests, documentation and owning Note agree with the requested behavior.

Main code and tools use PaperMoon checks. Applied DSH changes retain DSH code and runtime constraints under PaperMoon's [patch maintenance scope](../../../patches/README.md). Inspect registered checks and confirm their coverage before execution. For mechanical regrouping, establish source equivalence; changed behavior needs its corresponding tests. Do not run a full DSH build for a main documentation-only change.

During final acceptance of main-repository changes, follow [pre-commit review](../../../docs/testing.md#before-committing). When the change includes prose, read the [bilingual writing guide](../bilingual-syntax-style-guide/SKILL.md) and review the changed text in context. Report the completed behavior and checks actually performed, distinguishing skipped checks from passing checks and identifying remaining verification gaps.

When a main-repository change or PaperMoon-carried DSH patch affects user-visible information, layout, controls, feedback or interaction, carry out the workflow's UI design review after basic checks and before final acceptance. Include its outcome in the delivery report.
