# Agent Note: UI design review before delivery

Status: implemented

English | [中文](2026-09-30-ui-design-review.zh.md)

## Problem

A finished interface can pass behavior checks while still imposing unnecessary navigation or obscuring its main action. The delivery workflow needs a clear point at which the task Agent reassesses the design against existing UI/UX principles.

## Decision

PaperMoon's [delivery workflow](../../../../docs/testing.md#delivery-workflow) covers implementation, checks, final acceptance and delivery against the requested behavior. Within that sequence, the [delivery skill](../../../skills/papermoon-checks/SKILL.md) triggers a UI design review after basic checks and before final acceptance when main-repository changes or PaperMoon-carried DSH patches affect the visible interface. The review assesses the design against the requested behavior and established principles, and any improvements receive validation as part of the final change.

The checked-out DSH UI/UX guide supplies design and interaction principles. PaperMoon owns the timing and delivery scope under its [independent maintenance decision](2026-09-11-independent-maintenance.md). Existing checks provide evidence for final acceptance. The workflow and skill remain in the main repository, so main documentation checks retain their independent execution.

## Alternatives considered

Adding principles only to the design guide would leave the review timing outside the delivery entrypoint. A separate review task could bring another perspective, but adds coordination overhead; it remains a possible later experiment. A dedicated screenshot suite would duplicate evidence already provided by existing browser scenarios and add maintenance work.

## Consequences

UI tasks include a design review bounded by the requested behavior and affected surfaces. The Agent implements improvements with a clear benefit or retains a suitable design with concrete reasons, then reports that outcome alongside actual verification. Checks affected by further edits run again, while passing results for unchanged content remain usable. Internal and documentation-only tasks keep the shorter path from basic checks to final acceptance. Design quality still depends on the Agent's judgment.
