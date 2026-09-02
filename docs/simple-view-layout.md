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
stage below — description, richer summary rows — rather than accepted.

**Revision, 2026-09-01 (second pass):** the first build of this spec's
pick shipped two real problems, found reviewing it live rather than
from the write-up. Both are fixed in the prototype now; neither is a
cost carried forward.

1. **The mobile stage was invisible.** `.px-faceA` (MIC IN → Current
   sound → OUT) carried an unscoped `flex: 1 1 auto; min-height: 0`
   meant for the desktop console, where `.instrument` is genuinely
   `height: 100vh`. The prototype's mobile *preview* is a scaled-down
   frame sitting inside a real desktop-width page, so that height chain
   stayed active underneath it; against an unshrinkable library sibling,
   the stage collapsed to 0px. Fixed by giving `.px-faceA` the same
   `flex: none` (content height) treatment the library already had in
   the mobile override — verified non-zero, both meters and Save
   visible, on every sound state. A layout this central to the map's
   safety-floor requirement needs an explicit test once #47 builds it
   for real, not just a live look.
2. **The device strip duplicated the effect summary.** The composed
   stage (added by the first owner-direction pass to fix sparseness)
   showed the same handful of technical names twice — once as bold
   pills directly above the summary, once again as the summary's own
   quiet trailing label a few lines down. Fixed by folding the strip's
   one distinct piece of information (the family-color swatch) into
   each summary row itself, at the plain phrase's left, instead of a
   separate block — see the effect-summary bullet below. This also
   corrected a smaller inconsistency: the strip gave the technical name
   *top* billing, ahead of the plain phrase, cutting against "plain
   first, technical name quietly after."

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
  sound); the **effect summary**, one row per effect — a family-color
  legend swatch, then the plain phrase, then the technical name quietly
  after in its family's ink ("Evens out loudness · `Compressor`"),
  read-only, no values. The swatch is the glossary's permitted read-only
  "names the devices a preset uses as context" (no construction
  controls); it prints once per device, in the row that already
  explains it, rather than as a second list above the summary (see the
  revision note above). Then **Previous / Next** centered under the
  summary with an *n of m* position readout over the filtered factory
  list.
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
3. Current sound stage (name + Save + description + effect summary +
   Previous/Next) — verified non-collapsed; see the revision note above
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
- For #47: on mobile, the real Simple shell's stage element needs an
  explicit `flex: none` (or equivalent auto-height treatment) wherever
  it reuses `.voice-deck-face`'s desktop-only `flex: 1 1 auto;
  min-height: 0`, matching the fix in this prototype's revision note
  above. Give it a test at a narrow width, not just a live look — this
  is exactly how the first pass shipped invisible on mobile.
