# ADR 0003: `list_presets` is a compact browse index, and the guide is preset-first

- **Status**: Accepted (2026-09-01)
- **Context**: scale-out batch decisions D-2 / D-12 / D-13 / D-15 ([scale-out-plan.md](../ultron/preset-axis-cycle/scale-out-plan.md)); builds on [ADR 0001](0001-factory-library-as-data.md) (the library is data). `CONTEXT.md` defines the two terms this implements: **Preset-first** and the **Closeness rule**.

## Context

The complaint that opened this decision: the browser agent builds chains from scratch — many slow `add_node` / `set_param` round trips — instead of loading a factory preset that already sounds like what was asked for. Two causes, both in this repo, both real.

**1. The agent could not tell what a preset was.** `buildListPresetsResult()` returned `{name, nodeCount}` per factory entry. The agent saw *"Cathedral Drift, 7 nodes"*. Node count does not distinguish two presets for a listener; it never answered "is this the dreamy hall the user asked for?" So the agent had no basis on which to load anything, and building from scratch was the only strategy the surface supported. Meanwhile `src/factory-library-data.js` called `description` "the agent-matching surface" — a surface the agent was never shown.

**2. The guide said the opposite of the strategy we want.** `SOUND_DESIGN_GUIDE.workflow` read:

> edit: "Call get_chain first; preserve nodes unless the user asks to rebuild."
> apply: "Use set_param on existing nodes; add_node only for a missing effect."

Every word of that is correct *for editing the sound already loaded*. Nothing scoped it that way, so it read as the instruction for every request, including a brand-new sound. The guide was actively teaching build-from-scratch.

## Decision

### 1. `list_presets` returns a compact browse index for factory entries

Each factory entry now carries `summary` (the library's hand-written ≤60-character line), `primary`, and its **public** tags. `nodeCount` is dropped from the factory group; `get_preset` still carries the full nodes *and* the full `description` for the one entry the agent picks. User entries keep `nodeCount` — they have no library metadata, and it is the only thing knowable about them without a load.

The `technique:` axis is filtered out. It is internal (`CONTEXT.md`, "Technique axis") — coverage and dedup only, never user-facing grouping and never steering copy. The filter is an **allow-list** of the four public axes rather than a deny-list on `technique`, so a future internal axis is excluded by default instead of leaking until someone remembers.

### 2. The summary is a separate hand-written field, not a truncation (D-13)

Recorded in [ADR 0001](0001-factory-library-as-data.md)'s successor edit to the entry shape. Truncating `description` keeps the setup and cuts the payoff. Studio Polish is the proof: its description opens on what it fixes ("Fixes the mic first: hiss gone between phrases…") and closes on the clean natural voice that results — and the closing half is the half a request matches. A 60-character prefix of it stops mid-word inside the recipe.

### 3. The guide leads with a preset-first step

`SOUND_DESIGN_GUIDE.workflow` gains `start`, placed **first** (JSON key order is the order an agent reads), stating both halves of the Closeness rule:

> "New sound: list_presets, then load_preset the closest match — one tag matching the ask is close enough. Else build fresh."

`edit` is rescoped to "Editing that sound: …" so "preserve nodes" no longer reads as the instruction for a new request.

### 4. The input schema stays frozen

`list_presets` takes no arguments and still takes none. `docs/WEBMCP-CHALLENGE.md`'s change gate asks whether the page still registers "exactly 10 WebMCP tools with the same public names and schemas" — this change touches **output only**, so that answer stays yes without qualification. A tool's returned payload is not part of its published contract; its name, its annotations, and its `inputSchema` are, and all three are byte-unchanged.

## The payload arithmetic

Measured against the real 14-entry library (`tests/test-factory-presets-policy.js` section G prints the live figure on every run, so this table cannot quietly go stale):

| Factory entry shape | chars/entry | at 14 presets | at 60 presets |
|---|---|---|---|
| Old — `{name, nodeCount}` | 39 | 543 | 2,340 |
| `{name, summary}` alone | 83 | 1,166 | 4,980 |
| **Shipped — `{name, summary, primary, tags}`** | **164** | **2,302** | **9,840** |
| Rejected — full `description` instead of `summary` | 250 | 3,503 | 15,000 |

Descriptions run 96–178 characters (mean 127); summaries run 39–52 (mean 46). The honest ceiling on this library is 40–60 distinct presets (see capability gaps below), so 60 is the number the shape has to survive — and full descriptions would spend **15 KB** to answer one browse call. The shipped shape spends 9.8 KB, and roughly half of that is the tags and primary that make the Closeness rule mechanical rather than a vibe check. If the library ever outgrows that, the next move is paging or a filter argument — not shrinking the summary, which is the field doing the work.

**The guide payload is the tighter constraint, and it is now nearly spent.** The `get_capabilities({focus:'sound_design'})` response is capped at 2,000 characters (`tests/test-mcp-tools-cycle3.js` A20, `tests/test-tool-registration.js` D1). It measured **1,938 before this change — 97% of budget**. The preset-first step was funded from inside that ceiling by lossless compression of existing copy (`verify` rewritten without losing a single fact; `intensity` shortened while keeping the "first listed"/"last listed" phrases A16 pins; one redundant article in `transposed`), landing at **1,992 / 2,000**. That is 8 characters of headroom: *the next vocabulary or workflow addition cannot be absorbed and requires an explicit ceiling decision.* The ceiling has moved once before (1,500 → 2,000 on 2026-08-31, to fund the four Tone types) and its basis is Chrome's preliminary output guidance, not an enforced limit — so moving it again is available, but it should be a recorded decision rather than a side effect.

## Alternatives rejected

**Add a `filter` / `tags` argument to `list_presets`.** The obvious way to keep the payload small as the library grows: let the agent ask for `{tags: ['vibe:spacious']}` and return only matches. Rejected for three reasons.

1. It breaks the change-gate answer. `list_presets` currently takes no arguments; adding a property changes its published `inputSchema`, so "the same public names and schemas" becomes a qualified yes days before a submission whose whole claim is a stable 10-tool contract. Not worth it for a payload that fits.
2. It moves the matching into the agent's *first* call, where the agent has the least information. To filter well the agent must already know the vocabulary — which is exactly what the unfiltered index teaches it. A wrong filter returns an empty list, and an empty list looks identical to a coverage gap; the agent's recovery from that is to build from scratch, which is the behavior this ADR exists to stop.
3. It buys nothing yet. 9.8 KB at the library's honest ceiling is a browse call, not a problem. Solving a size problem the library cannot reach, at the cost of the contract, is the wrong trade this week.

If the library ever genuinely outgrows one call, the cheaper move is a second tool or a cursor — both additive — rather than making the entry point conditional.

**Truncate `description` to build the summary.** Covered above: truncation preserves the recipe and discards the request. Enforced against by a structural conformance check (a summary that is a prefix of its description fails).

**Leave `nodeCount` on factory entries alongside the summary.** Costs ~15 characters per entry to tell the agent something no listener cares about, and invites the reading that a 7-node preset is "more" than a 3-node one. `get_preset` carries the nodes when the agent actually wants them.

## The capability gaps that bound library growth

These bound how far the "grow the library" half of the strategy can go, and they are the reason 60 is a ceiling rather than a waypoint. All three are engine limits, not authoring limits — no amount of preset writing routes around them.

- **Reverb exposes only `mix`.** The impulse response is host-owned and fixed (`src/mcp-tools.js`, rule `host-reverb-internals`). Cathedral, Arena, Stadium, Cave and Big Room are the *same plate at different wet percentages*. Distinct venue presets cannot be authored, so every "put me in a big room" request collapses onto one axis.
- **EQ is 3 fixed bands** (200 Hz shelf / 1 kHz peak Q1.0 / 5 kHz shelf). There is no sweepable bandpass, so telephone, megaphone, walkie-talkie and radio all reach for the same three knobs and land close together.
- **No harmony, no vocoder, no formant shift.** The prior art's entire "harmony stack" family is unbuildable. Without formant shift, helium and chipmunk are one pitchshift at two amounts.

Honest estimate at the "usable without edits" audition bar: **40–60 distinct presets.** Past that, candidates become param variations that fail the admission bar (D-3: name the plain-language request answered, and why the closest existing preset fails it). The most valuable output of pushing further is not more presets — it is naming which *node type* to build next, which is worth more than ten more entries.

## Consequences

- `FactoryPresets.listDetailed()` is the read path for the index. Per ADR 0001 it deliberately never carries `nodes`, so this cannot become a second load path. `list()` keeps its exact `{name, nodes}` two-key shape.
- A factory entry with no metadata (bare harness, damaged data module) degrades to `{name}` — never an invented summary. Same discipline as the other guarded reads in `src/mcp-tools.js`.
- Section G of `tests/test-factory-presets-policy.js` pins the index: summary and primary verbatim from the library, no `nodeCount`, no `nodes`, **no `technique:` tag**, and the no-argument input schema. It also asserts the library *does* carry technique tags, so the filter check cannot pass vacuously.
- `tests/test-mcp-tools-cycle3.js` A16b pins the guide: `start` names both tools, states both halves of the Closeness rule, is the first key, and does not contain "preserve nodes" (which now lives only in `edit`).
- Every new library entry needs a hand-written summary. `src/audition-candidates.js`'s header records this so candidates carry one at authoring time, where the person who wrote the sound knows which request it answers — rather than having one invented at promotion.
