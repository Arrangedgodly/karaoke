# Town Hall — Cycle 4: Free-Canvas Patch Editing + Card Resize

Coordinator: ultron (via ultron-redesign change-control handoff) · Meeting
date: 2026-08-30 · Status: **APPROVED 2026-08-30** (final record confirmed, no corrections; all clusters signed off individually across two grilling rounds)

## Problem statement & target users

The chain canvas currently edits order by reordering stacked sections
(SortableJS drag) inside one forced-reading layout. The user directed a
musician-native editing model, mid-redesign, in two parts:

1. **Patch-chain editing** — plugins free-position on the canvas with a
   tiny snap grid (alignment assist, not forced uniformity); chain
   linking is by draggable patch cords between jack points: MIC IN has
   one output point, every plugin an IN and an OUT point, master OUT one
   receiving point; the operator watches the cords to read/verify chain
   order. The existing whole-canvas FLOW toggle is repurposed to a
   per-card control: which way each card's CONTENT flows from its header
   bar.
2. **Card resizing** — drag a corner to scale a card up or down
   (user chose CONTINUOUS scale over stepped sizes).

Target users unchanged: the brother (karaoke operator, non-engineer,
live mid-show) and the developer (portfolio), plus the operator's agent
(WebMCP, order-based chain contract).

Scoping answers given 2026-08-30: **linear chain only** (cords visualize
strict order; splits/parallel are out), **bounded panel** (free
positions inside today's canvas panel with internal scroll; no
pan/zoom), **continuous scale** (any scale factor within clamps),
**autosave-only persistence** (positions/sizes/flow ride the autosave;
named presets store chain-only and auto-layout on load).

## Proposed MVP

- Free positioning of plugin sections inside the bounded canvas panel,
  quantized to a small snap grid; cards may sit at any grid-aligned
  position (alignment is possible, uniformity is not forced).
- Patch cords: drag from a jack point to another point to
  link/relink/unplug; cord topology IS chain order (linear); order
  changes commit through the existing structural chokepoint
  (duck/rebuild) exactly once per committed change.
- Continuous card resize via corner drag, clamped: minimum scale holds
  the 11px text floor; maximum scale bounded by panel width; scale
  applies to the whole card (knobs, text, hit targets together).
- Per-card content-flow direction (the repurposed FLOW semantics; a flow
  glyph beside the fold chevron, canvas-level FLOW toggle retired) rides
  the card, persisted with layout; folded sections keep {x, y, scale}
  and stay draggable/corner-resizable at header scale.
- Layout state = autosave extension ({x, y, scale, flow} per node,
  schema-versioned with migration: legacy autosaves without layout
  auto-layout to the incumbent vertical stack).
- Palette add + placement: adding a plugin places it at a free grid
  position (exact interaction is an open question, production-owned).
- Agent contract unchanged (order-based set_chain/add_node/set_param);
  agent edits auto-place/auto-move affected cards sanely.
- Keyboard/SR chain building unchanged in capability (append before
  terminal limiter); the DOM/aria reading order follows chain order,
  not canvas position.

## Non-goals

- No true graph routing (splits, parallel paths, merges) — linear chain
  only (scoping answer).
- No pan/zoom, no infinite board — bounded panel only.
- No layout inside named presets — presets stay chain-only and
  portable; loads auto-layout.
- No per-node audio bypass (standing DECLINED decision — collapse
  stays; a "power" jack/cord cut is NOT bypass).
- No undo for human edits (standing limitation; cord/resize edits join
  the same class — documented, not silently dropped from record).
- No agent control of positions/sizes (agent stays order/param-level).
- No touch/mobile scope (Chrome desktop recommendation stands).

## Journeys & states

- **Build**: palette → place → cord mic→plugin→…→out; snap grid
  assists alignment; wrong order is visible in the cords themselves.
- **Tune**: knobs (family arcs) with resize for glanceability (big gain
  card mid-show); display register keeps answering the touched control.
- **Mid-show edit**: unplug/relink with a deliberate-drag guard;
  rebuild duck keeps audio glitch-free; BYPASS/safety net untouched.
- **Reload**: autosave restores positions/sizes/flow; legacy autosave
  migrates to the incumbent stack.
- **Preset load**: chain applies, cards auto-layout (fresh tidy board);
  autosave baseline updates.
- **Agent edit**: set_param fast path moves rendered controls in place
  (positions irrelevant); add/remove auto-places/removes cards; pulses
  still land on the section.
- **States**: empty canvas hint; overlapping cards (selection +
  bring-to-front rules); collapsed sections (groove rows) still
  positionable/resizable at header scale.

## Success measures & acceptance criteria

- A chain built, reordered, and resized entirely by cord/pointer edits
  renders and sounds correct on the fixed test vocal (existing QA bar:
  audible, param-reactive, bypass-clean, artifact-free).
- Every committed cord change rebuilds the audio graph exactly once,
  through the existing duck/rebuild path (no rebuild storms on drag).
- Layout survives reload; legacy autosaves and all existing presets
  load with graceful fallback (byte-stable audio results on legacy
  chains — zero regression bar).
- Keyboard-only user can build any chain without the pointer (existing
  capability preserved and tested).
- Resize clamps: no text renders below 11px at any allowed scale;
  clamps enforced, not advisory.
- Suite green incl. new cord/resize/layout-migration coverage in the
  committed vm harness.

## Constraints, assumptions, risks

- Locked visual world: Pattern Machine / Single Face Chassis (redesign
  run owns the visual layer of cords/jacks/grid; production builds
  inside it).
- Offline, no build step, no new dependencies, localStorage,
  single page. SortableJS remains vendored (palette may keep using it;
  the chain list's use is expected to be replaced by custom pointer
  logic — plan decides).
- Audio graph builder, node registrations, watchdog/limiter safety
  net, MCP tool surface: untouched.
- Risks: free canvases drift into overlap chaos (mitigation: snap +
  tidy auto-layout fallback + bring-to-front); accidental unplugs
  mid-show (deliberate-drag threshold + duck rebuild); continuous
  scale vs crisp text (clamp + chosen scaling strategy, production
  spike); pointer-event simulation depth needed in the test harness.

## Role Perspectives

- **Product/User Value** — Supports: patching is how the target user
  thinks (pedals/racks); free layout builds muscle memory; resize
  serves 2m glanceability; marquee portfolio demo. Dissent: the
  non-engineer mid-show needs guardrails, not freedom — an unplugged
  cord is an audible change with no undo. Resolution to grill:
  deliberate-drag guard + auto-layout escape hatch.
- **UX/UI** — Supports: jack prints already exist in the chassis world;
  cords make order self-evident; grid dots are native panel texture.
  Concern: overlap/z-order/selection policy; cord routing legibility
  when paths cross; continuous resize interacting with the 11px floor
  and per-card flow direction. Smallest experiment: production spike of
  cord-drag + resize on the real chassis (the redesign's element round
  will tune the cord look live).
- **Frontend/Audio** — Supports: model stays ordered {id,type,params};
  layout is parallel metadata in the autosave (not the preset schema);
  order commits ride the existing single chokepoint. Concern: replacing
  the chain-list SortableJS with custom pointer logic (palette keeps
  clone-drag); SVG vs canvas cord layer; continuous-scale
  implementation (transform vs layout-based) and text crispness;
  harness pointer simulation. Experiment: implementation spike on a
  10-node chain (production).
- **Quality/Reliability** — Supports: no audio-path changes; rebuild
  machinery is proven. Concern: silent reorder on accidental unplug;
  cards hidden behind cards in a bounded panel; legacy autosave
  migration. Resolution: guards + tests; tidy action; migration test
  gate.
- **Security/Privacy** — No new surfaces; localStorage only. No
  concerns.
- **Accessibility** — Supports: keyboard add path unchanged; aria/DOM
  order follows chain order. Concern: cord drawing and corner-resize
  are pointer verbs; SR needs an order-based story, focus management
  with overlap. Resolution: keyboard parity for building (not for
  positioning); document positioning as pointer-only with the append
  model as the accessible equivalent (grill to confirm sufficiency).

## Open questions & disposition

| # | Question | Owner | Status |
|---|----------|-------|--------|
| OQ-1 | Cord drag/unplug/relink commit semantics + deliberate-drag guard | production | informs (safety-critical) |
| OQ-2 | Overlap/z-order/selection policy; tidy auto-layout action | production | informs |
| OQ-3 | Continuous-scale strategy + clamps (11px floor, panel width) + what scales | production | informs (spike) |
| OQ-4 | Palette-add placement interaction on free canvas | production | informs |
| OQ-5 | Per-card flow-direction spec + persistence | production | informs |
| OQ-6 | vm-harness pointer simulation + test gates for cords/resize/layout | production | informs |
| OQ-7 | SortableJS keep/retire on chain (palette keeps) | planning | informs |
| OQ-8 | SR/keyboard chain-order exposure + focus rules with overlap | production | informs (a11y gate) |
| OQ-9 | Cord/jack/grid VISUAL layer | ultron-redesign | separate track (element round) |

## Decisions & rationale

- Linear-only topology (user, scoping answer) — preserves audio graph,
  presets, and agent contract unchanged.
- Bounded panel (user) — no navigation state, least mid-show risk.
- Continuous scale (user, overriding the stepped recommendation) —
  clamps and the scaling strategy are production-owned (OQ-3).
- Autosave-only layout (user) — presets stay portable; loads
  auto-layout.
- Change-control routing (coordinator, per ultron-redesign discipline):
  behavior → this cycle; look → the open redesign run.

### Grilling round 1 (2026-08-30) — all approved as recommended
- **Q1 Placement**: click/keyboard add drops at the first free grid
  slot (order appended before terminal limiter as today), drag-from-
  palette places where dropped. One placement rule for both verbs;
  agent additions use the same auto-place.
- **Q2 Overlap**: allowed — free canvas means free; select/click brings
  to front; TIDY is the escape hatch (Q5).
- **Q3 Resize**: whole card scales proportionally (knobs, text, hit
  targets together); hard clamps — minimum scale holds the 11px floor,
  maximum bounded by panel width.
- **Q4 Cord commit semantics** (Challenger/Advocate round — Advocate
  carried): cords edit ORDER, never gate AUDIO. Unplug starts an edit;
  audio changes only on a completed relink (one structural commit
  through the existing duck/rebuild chokepoint); drop nowhere = edit
  reverts, node stays in chain. Unplugging can never remove audio;
  per-node bypass stays DECLINED; removal stays the explicit ×.
- **Q5 TIDY**: yes — one-click auto-layout back to the incumbent
  vertical stack; sits in the canvas chrome (flow-toggle zone).
- **Q6 Acceptance bar**: confirmed — existing QA bar on the test vocal
  for cord-built/reordered chains; zero regression on legacy
  chains/presets (bit-stable audio); keyboard-only building works;
  11px clamp enforced at all scales; suite green with new
  cord/resize/migration coverage.
- **Q7 SR story**: confirmed — positioning/resizing are pointer verbs;
  the append model is the accessible equivalent; DOM/aria order follows
  chain order, never canvas position.

### Grilling round 2 (2026-08-30) — all approved as recommended
- **Q8 Collapse on free canvas**: folded sections keep {x, y, scale},
  stay draggable by grip and corner-resizable at header scale; collapse
  semantics unchanged (session-only, re-expands on rebuild).
- **Q9 Per-card flow control**: a small flow glyph beside the fold
  chevron toggles the card's content flow (below-header ↔
  beside-header); persists with layout in the autosave; the canvas-level
  FLOW toggle is retired. Visual layer = redesign element round (OQ-9).
- **C1–C5 cluster sign-offs**: problem & users · MVP boundary &
  non-goals · journeys/states/measures · constraints/risks ·
  open-question dispositions — all confirmed individually.

## Sign-off record

- Scoping answers (2026-08-30): linear chain only · bounded panel ·
  continuous scale · autosave-only persistence.
- Round 1 (Q1–Q7): all approved as recommended (Q4 cord-commit rule
  through a Challenger/Advocate round; Advocate carried).
- Round 2 (Q8–Q9 + clusters C1–C5): all approved as recommended.
- Cluster mapping: problem & users — C1; MVP boundary & non-goals — C2
  (Challenger/Advocate via Q4); journeys/measures — C3/C6;
  constraints/risks — C4; open questions — C5 disposition table.

## Handoff to plan-it-out

Plan two workstreams on the same cycle: (A) the editing model
(positions, cords, resize, flow, persistence/migration, guards,
a11y, tests) sequenced to keep the suite green; (B) the visual layer
seam with the redesign run (cord/jack/grid look lands as a redesign
element round against the built feature). Research queue: none
blocking — all open questions are in-house UX/engineering with
established patterns.
