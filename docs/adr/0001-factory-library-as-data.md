# ADR 0001: The factory preset library is data, not hand-mirrored literals

- **Status**: Accepted (2026-09-01)
- **Context**: wayfinder map [#26](https://github.com/Arrangedgodly/voxchain/issues/26), tickets [#28](https://github.com/Arrangedgodly/voxchain/issues/28) / [#30](https://github.com/Arrangedgodly/voxchain/issues/30)

## Context

Until this decision, the shipped factory preset library lived as six hand-mirrored JS literals inside `src/factory-presets.js`, governed by a documented discipline: content "COPY VERBATIM, do not re-derive," with a header note that if a node type or param ever changed incompatibly, "these literals must be re-mirrored BY HAND" — the same discipline the registry mirrors used before the deep effect catalog replaced them. That regime was correct for six entries whose provenance was two events (PX-3's default, the QA-3 five).

The library is now growing to a coverage-driven target (map #26): dozens of auditioned entries, added in batches, carrying matchable metadata (descriptions, taxonomy tags, provenance) for the preset-first agent strategy. Hand-mirroring that volume rots: every content edit touches loader code, and nothing mechanical catches drift.

## Decision

1. Library content lives in **`src/factory-library-data.js`** — pure data (`window.FACTORY_LIBRARY`: vocabularies, primary-group order, entries as `{name, description, tags, primary, provenance, nodes}`) — loaded immediately before `src/factory-presets.js`, which becomes a **thin loader** over it with fresh-copy exports. Content edits never touch loader code.
2. Conformance is **enforced by test, not discipline**: `tests/test-factory-library.js` validates every entry against its own vocabularies and group order, the real `PresetSchema.deserialize`, and the **live EffectCatalog registry** (types, param names, discrete values as canonical strings, numeric ranges). The WebMCP policy half stays in `tests/test-factory-presets-policy.js`, unchanged.
3. **Drift rule** (map #26, settled at charting): when the drift test names an entry, that entry is *pulled from the library until re-auditioned* — a preset whose sound changed after its audition is an unauditioned preset wearing a provenance stamp. The test failure message says so.

## What is NOT amended

The audition gate. Every entry in the data module is human-auditioned material with its verdict recorded in `provenance` (`verdict: 'accepted'`); the conformance test rejects anything else. Structure-as-data changes how content is *stored and checked*, never how it *earns entry*.

## Consequences

- Adding entries (e.g. the seed batch, #31) is a data-file edit plus the same-edit test updates (entry count here and in the policy test; any new node types' `src/node-*.js` files in the new test's load list).
- The taxonomy vocabularies are append-only data in the same module (#28): a tag is added only when a real user request fails to match.
- Sandboxes and tests that load `src/factory-presets.js` must first load `src/factory-library-data.js` (index.html's order); without it, the loader's documented degrade path returns empty listings.
- `FactoryPresets.list()` keeps its exact `{name, nodes}` shape (strict-deep-equalled by `tests/test-preset-tools.js`); metadata reaches consumers only through the additive `describeAll()` / `listDetailed()` / `groupOrder()` exports, and `listDetailed()` deliberately never carries nodes so it cannot become a second load path.
