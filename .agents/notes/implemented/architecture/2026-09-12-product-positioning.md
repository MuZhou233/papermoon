# Agent Note: Product positioning and DSH distribution

Status: implemented

English | [中文](2026-09-12-product-positioning.zh.md)

## Problem

Readers need to know which experiences PaperMoon serves and how it relates to DSH. Repository organization and startup behavior belong to maintenance guidance and the current implementation description.

## Decision

The [product introduction](../../../../README.md) presents PaperMoon as a DSH distribution for AI-driven interactive storytelling. Its intended experiences are LLM-driven text adventure games and roleplay. Frontend describes the user-facing purpose; the implementation can include browser code and server-side logic.

This Note's implemented status records the adopted product direction. The [launcher decision](2026-09-11-submodule-launch.md) records the running foundation, and the [maintenance decision](../process/2026-09-11-independent-maintenance.md) defines separate delivery standards for the main repository and patches.

## Alternatives considered

Introducing PaperMoon through its plugin and tool repository describes engineering organization without identifying the intended user experience.

Using the original DSH Web launcher as the product definition ties the description to the initial implementation and obscures the text-adventure and roleplay purpose.

## Consequences

Product introductions lead with the intended experiences and the DSH distribution relationship. Maintenance documents explain repository organization, while descriptions of delivered features follow the current implementation.
