# Story mode requirements

English | [中文](README.zh.md)

Story mode presents experiences in chapters. Each subsection's Markdown document records the intended experience and serves as its product requirements. The existing development and delivery workflow still applies.

## Documents

Use a numbered directory for each chapter and a numbered Markdown file for each subsection. Maintain English, Chinese and pairing files under the [documentation rules](../AGENTS.md). Subsections can be written before their features exist; their requirements do not claim that the experience has shipped.

Describe user actions, visible results and any UI or guidance needed for the subsection, including controls that appear later or a dedicated interface. Keep shared experience requirements in one owning document and reference them from the relevant subsections. Architecture, APIs and implementation decisions belong to engineering documentation and Agent Notes.

When later chapters require architecture changes, every implemented chapter must remain completable from the beginning in the current version. Instructions and preset content can evolve while preserving the learning goals and expected results. This requirement does not establish migration support for earlier exercises, progress or sessions.

## Chapters

- Chapter 0
  - [Section 1: Set up a DeepSeek API Key](00/01-deepseek-api-key.md)

The first subsection currently contains only its title. Its requirements have not been written.
