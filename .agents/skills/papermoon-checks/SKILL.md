---
name: papermoon-checks
description: Review PaperMoon changes before commits or delivery, including bilingual prose and separately assigned DSH patch checks.
---

# papermoon-checks

Before committing or reporting that a change is ready, follow [pre-commit review](../../../docs/testing.md#before-committing). When the change includes prose, read the [bilingual writing guide](../bilingual-syntax-style-guide/SKILL.md) and review the changed text in context; passing automated checks does not complete this step. Classify changes by effective owner: main code and tools use PaperMoon checks; applied DSH changes use the checked-out DSH requirements. For patches, inspect the required command list and confirm its coverage before execution. A successful reconstruction is not successful delivery. Report commands actually run and distinguish skipped checks from passing checks. Do not run a full DSH build for a main documentation-only change.
