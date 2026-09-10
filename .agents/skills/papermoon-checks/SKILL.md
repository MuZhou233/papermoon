---
name: papermoon-checks
description: Select and report PaperMoon main-repository checks and separately assigned DSH patch evidence.
---

# papermoon-checks

Read [testing and delivery](../../../docs/testing.md). Classify changes by effective owner: main code and tools use PaperMoon checks; applied DSH changes use the checked-out DSH requirements. For patches, inspect the required command list and confirm its coverage before execution. A successful reconstruction is not successful delivery. Report commands actually run and distinguish skipped checks from passing checks. Do not run a full DSH build for a main documentation-only change.
