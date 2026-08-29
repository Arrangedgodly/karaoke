---
version: 1
slug: "index-html"
primary_target: "index.html"
related_targets: ["styles/main.css","src/canvas.js","src/param-controls.js","src/presets-ui.js","src/main.js"]
---

# Surface Brief — Chain Builder Console Re-skin (Cycle 2)

## 1. Job and audience

Visitor mode: **Operate** — the tool disappears into the task.

- **Event operator (primary)**: the brother, standing at a dark venue, laptop
  + mic + PA, during setup and mid-show glances. Needs: instant state
  legibility at distance, one-action bypass, no surprises. Not an audio
  engineer; reads the UI like hardware, not like software.
- **Developer/portfolio visitor**: opens localhost, evaluates craft and the
  WebMCP story within seconds. Needs the surface to *look like what it is*:
  a self-built pro-audio utility, not a styled web demo.
- **Agent (Gemini in Chrome)**: drives the same surface through MCP tools;
  its activity must be visible, summarized, and undoable — never invisible.

## 2. Outcome and proof

Primary task: build/adjust a live vocal chain without breaking the show.
Success on this surface: status, meters, and bypass readable in one glance
from across a dark room; agent edits land with visible summaries and
one-click undo; absence of WebMCP changes nothing visually or functionally.
Proof is the working app itself (real mic, real presets, real IR asset) —
no invented users, metrics, or brand claims; product name stays the working
title until the user renames it.

## 3. Selected direction

**World (user-pinned in town-hall, beats any roll): dark pro-audio console.**

- **Rendition discipline — physical console, not neon terminal.** The
  calibration trap for this world is the AI-cluster "near-black + neon
  accent + glowing edges" rendition. Ground instead in physical console
  material: charcoal brushed-steel neutrals, silkscreened light legends,
  warm lamp-lit metering, hairline panel seams. Glow belongs to *meters
  and active signal only*, as lamp light — never as decorative edge light.
- **Color strategy: Restrained with functional coding.** Dark steel neutral
  family (two neutral layers: console body vs. panel insets) + **one signal
  accent (warm amber)** reserved for primary actions, current selection,
  live signal, and metering. Per-effect-family accent colors exist only as
  identity edges/legend chips on node cards (silkscreen discipline, donated
  by the guitar-pedal world: color as edge marking, never fill; text label
  always present — color is never the only signal).
- **Typography: one workhorse sans** (system stack — the app is offline;
  **no webfonts, ever**) at a fixed rem scale (~1.125 ratio), plus **system
  mono reserved for machine readouts** (meter dB values, sample rate,
  latency, status strip) — the console's LCD/VFD register. No display faces
  in labels, buttons, or data.
- **Structural/interaction thesis**: the 3-column console
  (palette | signal path | presets) under a **machine status strip** (the
  topbar becomes the console's status LCD: engine state, sample rate,
  latency/node count, agent chip — discipline donated by broadcast rack
  gear's dense status displays).
- **AMENDED 2026-08-28 (user-directed)**: the signal path flows
  **top-down** — MIC IN (top) → effect rows stacked vertically → OUT
  (bottom) — inside the unchanged 3-column frame; FX cards are
  **collapsible** (header row: family chip + name + grip + chevron + ×;
  params section hides on chevron toggle, default expanded; collapse is
  presentation-only — no per-node audio bypass, that was offered and
  declined); card scale **denser** (~90%: tighter paddings, smaller
  chips/faders, minimum text sizes and AA pairs unchanged). One-page
  constraint reaffirmed.
- **Focal moment**: the live signal path under lamp light — chain cards
  read like a patched channel strip, meters breathe at MIC IN and OUT
  anchors, and when the agent acts, the whole path visibly responds
  (changed cards pulse once amber, summary toast, undo affordance).
- **Bypass**: the single highest-contrast, largest-affordance control on
  the surface (safety red on steel); nothing in the theme may out-shout it.
- **Motion**: 150–250 ms state transitions only; meter ballistics are
  functional; no load choreography; `prefers-reduced-motion` quiets pulses
  but never freezes functional metering.

No concept roll ran: direction and topology were both user-pinned
(town-hall: dark console; 3-column layout and flows persist) — per
new-work's pinned-direction and precisely-specified-request rules. The two
donor disciplines above are facilitator-derived raises, labeled as such.

## 4. Scope and boundaries

- VIS-7 (2026-08-28 amendment): vertical canvas + collapsible cards +
  density pass — presentation only; flows, wiring, and safety untouched.

- Production-ready re-skin of every existing surface: topbar/status strip,
  palette, chain canvas, node cards, param sliders, presets panel, all
  states; plus new light-structure elements: MIC IN / OUT level meters,
  status readouts, agent-activity chip, change-summary toasts with undo.
- Named targets: `index.html`, `styles/main.css`, the JS modules that
  render cards/controls (`src/canvas.js`, `src/param-controls.js`,
  `src/presets-ui.js`, `src/main.js`) — markup/class changes allowed,
  wiring and behavior contracts preserved.
- Untouched: 3-column layout, all flows (drag-drop, reorder, sliders,
  presets, save/load/delete, autosave), keyboard behavior incl. spacebar
  bypass, disabled-until-started gating, audio path modules.
- Anti-goals: no layout/IA redesign; no new pages; no webfonts/CDN assets;
  no neon-terminal rendition; no display fonts in UI; no decorative
  motion; no reinvented form controls; no brand invention (name/logo
  undecided — working title stands).

## 5. States and ranges

- Chain content: 0 nodes (taught empty state) to ~8 nodes typical max;
  6 node types; 2–5 params per node.
- Presets: 0–20 named; names ≤ 40 chars.
- Material states: not-started (gated), live, bypassed, agent-unavailable
  (WebMCP absent — indistinguishable from today's app), agent-connected /
  agent-acting (chip states), change-summary toast (auto-dismiss +
  undo), adversarial-rejection (structured error surfaced as toast, audio
  untouched), engine error, unsaved-changes, focus/hover/disabled on every
  interactive component.
- Meters: silence to clip range with peak-hold; readable at ~2 m distance.

## 6. Interaction and layout

- Hierarchy: status strip (top, always) → signal path (center, dominant) →
  palette/presets (flanks, subordinate). The canvas is where the eye lands.
- Topology persists exactly; density increases (console-grade label
  rhythm), whitespace tightens deliberately — industrial, not airy.
- Feedback: every state change answers in ≤250 ms; agent mutations pulse
  affected cards once and summarize in one toast (never stacked modals).
- Affordances: same button/control vocabulary surface-wide; drag handles
  read as physical grips; sliders read as faders with detents.
- Desktop-first (event laptop); current responsive behavior must not
  regress; no new breakpoints required.

## 7. Constraints and open decisions

- Platform/delivery: static vanilla JS/CSS, no build step, zero runtime
  internet, vendored deps only, Chrome-only recommendation.
- Accessibility (approved gates): WCAG AA for **all** text on dark grounds;
  visible focus everywhere; keyboard flows preserved; distance readability;
  meter color never sole signal (redundant with label/position).
- Builder must not invent: product name, brand voice (copy stays verbatim
  from cycle 1; new readout labels terse-technical), palette hexes (final
  values ship only after the OQ-5 contrast audit), meter implementation
  tech (OQ-4: AnalyserNode vs AudioWorklet — research-owned), WebMCP chip
  semantics beyond connected/acting/unavailable.
- Open decisions: none blocking shape; the above route to deep-research /
  production as recorded in `docs/ultron/town-hall.md` § Open questions.
