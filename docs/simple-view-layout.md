# Simple view layout — the chosen arrangement

Decision record for wayfinder **#45** ("[Prototype] Simple view layout"),
proven against the throwaway `prototype-layouts.html` (three variants
side by side, switchable via `?variant=`). This spec answers
**arrangement only**; every behavioral and naming decision was settled
in map **#43** (language per `CONTEXT.md`, updated by PR #50). No
production code is committed by this decision — tasks **#46–#49**
implement it.

## The pick: Variant A — sidebar library · sound stage

The existing split-collapsible shell keeps its geometry; Simple re-tenants
it. Variant B (now-playing band) and Variant C (library page · bottom
dock) stay in git history inside the prototype file as the rejected
alternatives.

Why A won:

1. **It is the map's own frame.** #45 asks where things sit *inside the
   existing split-collapsible-panel shell*. A is the only variant that
   answers that question rather than replacing the shell — the Sounds
   library takes the presets sidebar's seat (the same sticky-search +
   own-scroll discipline that seat already proves), and Current sound
   takes the board's flex-grow seat.
2. **The safety floor survives at equal prominence by construction.**
   Start, microphone selection, and Bypass stay in the system deck
   untouched, and the MIC IN / OUT meters keep their full-width
   `.canvas-footer` strips framing the stage — exactly their Advanced
   seats. B and C demote the meters to mini units packed into a
   band/dock; that is a weaker reading of "never hides the human's
   control over what reaches the speakers."
3. **The effect summary is never behind a toggle.** It is Simple's only
   representation of the live chain; B truncates it to one line (expand
   for the rest) and C collapses it behind a chevron. A lays it out in
   full beside the sound it describes — the strongest reading for the
   map's first-run-unaided proof.
4. **Browsing and listening are simultaneous on desktop.** The library
   column never moves while Previous/Next steps the filtered results
   beside it.

Known costs, accepted: on mobile the transport sits at the top of the
stack rather than at thumb height (C's one genuine win; if field use
contradicts the pick, C is the runner-up and the mobile stacking is the
first thing to revisit). The stage's original sparseness at wide
desktops was answered by owner direction (2026-09-01) with the composed
stage below — description, device strip, richer summary rows — rather
than accepted.

## Desktop (≥901px), top to bottom

- **System deck** — unchanged. The **Simple | Advanced** segmented key
  joins it beside the identity nameplate (reachable from both views;
  switching is presentation-only — settled). The agent reporter chip
  stays in the deck (the map leans yes on it joining the safety floor;
  still its open question, not this spec's).
- **Voice deck, row split as today:**
  - **Left — Sounds library** (the presets-sidebar seat, collapsible
    rail included): plain filter chips (**All · Warm · Rock · Funny ·
    Speech**) above the sticky search box; below, one scrollable column
    of cards grouped **Factory** then **Yours**. A chip that returns
    nothing renders the coverage-gap copy (a #26 gap, not a Simple bug).
    Yours is unfiltered (settled); search matches both sections.
  - **Right — the stage** (the board's seat): **MIC IN meter strip →
    Current sound → OUT meter strip**, the stage filling the height the
    board fills in Advanced.
- **Current sound stage** — a single composed column, capped to a
  reading measure (~640px) and centered in the board's seat, vertically
  centered when content runs short. Top to bottom: the kicker "Current
  sound"; the name — the preset's name, or "Custom sound" when the live
  chain matches no preset — with the unsaved marker and **"Save this
  sound" beside the name** whenever the sound is unsaved or custom
  (never in the secondary menu — settled); the sound's own one-line
  description (the preset's prose; a save invitation for a custom
  sound); the **device strip** — one key per device in the live chain,
  each carrying its family legend square and separated by chevrons
  (the glossary's permitted read-only "names the devices a preset
  uses"; no construction controls); the **effect summary**, one row per
  effect, plain phrase first with a family tick down the row's left
  edge and the technical name quietly after in its family's ink
  ("Evens out loudness · `Compressor`"), read-only, no values; then
  **Previous / Next** centered under the summary with an *n of m*
  position readout over the filtered factory list.
- **What Simple does not show here** (settled, restated for layout
  consequences): no board cards, no Effects/palette panel, no
  signal-order strip — the effect summary is the chain's Simple
  representation; per-node params, per-node bypass, add/remove/reorder
  are Advanced-only.

## Mobile (<901px)

Zones stack, the deck stays sticky at top, the page keeps its scroll
(the shell's own narrow reading):

1. System deck (wrapped rows, as today — Bypass never leaves view)
2. MIC IN meter strip
3. Current sound stage (name + Save + description + device strip +
   effect summary + Previous/Next)
4. OUT meter strip
5. Sounds library — the scrolling tail; filters, search, cards full-width

The safety floor plus everything about the sound you are on fits the
first screen; the library is one flick below it.

## Prototype notes for the implementers (#46–#49)

- The plain effect phrases in the prototype are placeholder copy
  pending #44's research and #46's catalog work.
- The prototype pads the factory library with six unprovenanced mock
  presets so filters return realistic result sets; the real six-preset
  library returns exactly one result per chip today.
- "Try a preset" is the settled verb for what a card does (PR #50's
  glossary addition); the prototype's cards just do it silently.
