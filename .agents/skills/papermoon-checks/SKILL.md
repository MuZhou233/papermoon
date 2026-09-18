---
name: papermoon-checks
description: Review PaperMoon changes before commits or delivery, including bilingual prose and separately assigned DSH patch checks.
---

# papermoon-checks

Before committing or reporting that a change is ready, follow [pre-commit review](../../../docs/testing.md#before-committing). When the change includes prose, read the [bilingual writing guide](../bilingual-syntax-style-guide/SKILL.md) and review the changed text in context; passing automated checks does not complete this step. Main code and tools use PaperMoon checks. Applied DSH changes retain DSH code and runtime constraints under PaperMoon's [patch maintenance scope](../../../patches/README.md); do not restore upstream-wide documentation or Note gates. Inspect registered checks and confirm their coverage before execution. For mechanical regrouping, establish source equivalence; changed behavior needs its corresponding tests. Report commands actually run and distinguish skipped checks from passing checks. Do not run a full DSH build for a main documentation-only change.
