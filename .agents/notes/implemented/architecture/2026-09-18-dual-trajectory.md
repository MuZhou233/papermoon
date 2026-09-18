# Agent Note: Worldline navigation and dual-mode trajectory

Status: implemented

English | [中文](2026-09-18-dual-trajectory.zh.md)

## Problem

One player input can require several model requests and tool steps. A request-centered page makes these look like separate story outcomes. Chronological event sorting also changes the order of script-composed historical references.

## Decision

The performance uses one Trajectory page with a worldline navigator and the full DSH ledger. A node owns one admitted input and its complete return, including tools and failures. Floors count ancestor depth; real DSH turn numbers remain chronological. Browsing, display mode and execution selection are independent.

Original inspection reads the path through the chosen node. Rewritten inspection reads its saved base context once, then its complete execution. Ordered context uses separate display identities and keeps source links; it does not create events, timestamps or usage. The [module reference](../../../../plugins/performances/README.md#actual-context) owns interface and navigation details.

The DSH extension uses an effect-scoped readonly source registry and navigation slots. Conversation assembles explicit event windows through its existing definitions. Ordered context preserves original message identities and source links separately from presentation indexes; execution records keep turn, step and request grouping. Context references create no timing or usage. Input authorship comes from durable source metadata under shared user-input admission, not an inspection-provider override.

## Alternatives considered

Fabricating sequence numbers or timestamps would obscure source identity. Mutating the active Conversation binding would couple inspection to Chat and execution. A separate renderer would also lose shared attachment handling and presentation policy.

Keeping separate worldline and request pages makes users switch between two navigation schemes. Replacing DSH’s ledger with a text preview loses tool, reasoning and request inspection. Sorting composed references by their source sequence changes the script’s order. Selecting runtime history merely to inspect it can change the next generated outcome.

## Consequences

Disposing a registration restores the ordinary source. Providers own selection semantics, translated labels and immutable request reads; the shared ledger retains search, fold, detail and copy behavior. The extension changes no Session event or SDK format. Tests cover reordered references, ordinary views, built bundles and effect cleanup.

Whole-turn inspection reuses durable composition and worldline facts without a format change. Snapshot-bound paging rejects mismatched cursors; ambiguous execution ownership fails explicitly. Historical context has no new timing or usage. Input classification follows the persisted message source. Reroll and edited resubmission use [shared user-input admission](2026-09-18-user-input-reexecution.md). Selection changes row styling without reducing text height; navigation transitions respect reduced-motion preferences. Chat presents the exchange and its reply actions; Trajectory owns composed-context inspection, avoiding a second context viewer between messages. Main-repository tests own floors and navigation; the generic DSH inspection registration and ledger extensions use the selected patch checks.

This refines inspection in [worldlines](2026-09-16-worldlines.md) and [request composition](2026-09-17-context-composition.md), preserving their execution, persistence and state rules.
