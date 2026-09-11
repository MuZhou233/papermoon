# Agent Note: Bilingual writing skill

Status: implemented

English | [中文](2026-09-12-verbatim-writing-skill.zh.md)

## Problem

The supplied bilingual writing guide needs a discoverable project skill while preserving its wording and following the paragraph formatting rule.

## Decision

The [writing skill](../../../skills/bilingual-syntax-style-guide/SKILL.md) preserves the supplied wording and adds skill metadata. Each language label and its following text share one physical line. Its Chinese and English sections share one file, registered as a pairing exemption. Root instructions link to it for prose work.

The skill follows the standard paragraph check and needs no wrapping exemption or checker changes.

## Alternatives considered

A blank line between the label and text would create separate paragraphs. A wrapping exemption would preserve the source layout but require special checker behavior. Joining the lines retains the paragraph structure and uses the existing rule.

## Consequences

The wording remains intact, and the skill uses the existing documentation checks. Removing or moving it requires updating its registration and the root link.
