# UI layout prototype

Question: what should replace or substantially improve the current
three-column free-board layout without weakening the competition story or
live-audio safety?

Open `prototype-layouts.html` through the normal local server. Use the floating
arrow bar or the left and right arrow keys to switch between variants. Each
choice has a stable URL:

- `prototype-layouts.html?variant=A` for Focus desk
- `prototype-layouts.html?variant=B` for Edge patchbay
- `prototype-layouts.html?variant=C` for Sound scenes
- `prototype-layouts.html?variant=D` for Guided patchbay

The file is throwaway prototype code. It does not import production scripts,
register WebMCP tools, request a microphone, write to storage, or modify the
real audio graph.

## Direction chosen: D, a B/C hybrid

After reviewing A/B/C live, the direction picked for production is **D.
Guided patchbay** (below): it keeps B's free board, knobs, and cables as the
primary editing surface — nothing about direct manipulation gives ground —
but replaces B's flat "add an effect" chip row with a browsing panel built on
C's pattern: effects grouped in the product's own operator-language
categories (Shape your voice / Polish your sound / Keep it safe / More
effects), each showing a plain-language description, with the "what this
starts at and where it lands" preview revealed on hover or focus *before* you
commit by selecting it. The original "Recommended synthesis" note below (C
first-run + A's focus workspace) was this document's own pre-decision
proposal; it's kept for the record but D is the direction moving forward.

## D. Guided patchbay

B's board unchanged — fixed Voice In/Out rails, free-moving modules, knobs,
cable-drawn signal order. The only thing that changes is how a module joins:
cards in the add-effect panel are collapsed to a name and one-line
description by default, and expand on hover/focus to reveal what the module
would start at and where in the chain it lands, before you select it.

Best fit: keeps VOXCHAIN's physical-instrument identity and the free board's
existing engineering (drag, snap-grid, cord reorder) as the primary surface,
while fixing B's weakest point — a flat, unexplained chip row — with an
onboarding-grade browsing experience for people who don't know effect names.

Risk: two different vocabularies live on one screen (spatial board above,
grouped list below); the panel needs to read as clearly subordinate to the
board so it doesn't compete with it for attention.

D also picked up three refinements after the initial build, all reflected in
the live prototype:

- The system bar and the board's title/description collapsed into one row
  (brand + condensed status left, WebMCP chip + Bypass right) instead of two
  stacked rows, freeing vertical space for the board itself.
- The add-effect panel gained a second tab: **Effects** (the grouped browser
  above) and **Presets** (C's scene cards — Warm Presence, Ghost Radio, etc.
  — with the same plain-language descriptions and tags), so a person can
  either build from individual modules or start from a whole preset in the
  same guided place.
- **The prompt box was removed.** An early pass put a "describe a voice" text
  input + Apply button in the header, but that implies the app itself
  interprets plain language, which conflicts with PRODUCT.md's hard
  constraint against an in-app LLM. The real plain-language path stays
  external: a browser agent (Chrome's built-in AI, Claude, etc.) reads the
  page's WebMCP tools and edits the chain the same way a human would. Nothing
  on this screen should imply the app parses text itself.
- The signal-order strip (`USB mic → Gate → EQ → ... → Safe out`) sits
  centered directly beneath the board, above the add-effect panel.
- Effects in the add-effect panel carry their real family-color identity (a
  left tick, using the hex values already locked in `DESIGN.md`) instead of
  rendering flat; the four newer Tone.js effects (Pitch Shift, Tremolo,
  Bitcrusher, Phaser) stay neutral since production hasn't assigned them a
  family color yet either. Every knob's pointer, board or panel-preview
  alike, uses the header's own accent orange, while the ring keeps the
  family color — the one deliberate color thread between header and board.

## Recommended synthesis (superseded by D above)

Use C as the first-run structure, then open A's focused effect workspace when
someone selects a chain step. That pairing gives non-technical users a fast
result without hiding the real chain or turning the product into a preset
picker. Keep B's fixed input and output rails as compact status treatment; make
the wide free-cable board an optional expert editing mode only if cables prove
worth the added interaction and architecture cost.

## A. Focus desk

The chain becomes a compact signal strip. One selected effect gets a large,
plain-language workspace, while session and agent activity live in narrow
side areas. Input and output are persistent status, not objects on the board.

Best fit: deliberate tuning after an agent creates a starting point. This is
the clearest bridge between non-technical language and real audio controls.

Risk: experienced users may want several effects open at once. A production
version would need pinned controls or a compare mode.

## B. Edge patchbay

This keeps the distinctive free-cable idea but turns input and output into
fixed rails built into the board. Cards remain spatial and cables remain the
ordering gesture. The effect palette moves to a bottom drawer so the board is
the dominant object.

Best fit: preserving VOXCHAIN's physical-instrument character while fixing
the awkward movable endpoint objects.

Risk: free placement is harder to scan and maintain than a strict chain strip.
It also keeps the board architecture as a major product commitment.

## C. Sound scenes

The first decision is the intended voice, grouped by use case. Selecting a
sound expands its actual ordered chain below, where each step remains editable
and the limiter is visibly locked. Prompting and direct selection sit at the
same level.

Best fit: fast first-run success for streamers, gamers, and karaoke users who
do not know effect names.

Risk: it can feel preset-led unless custom chains remain equally easy to build
and save.

## What to borrow even if it does not win

- Variant A has the strongest selected-effect explanation and the cleanest
  input/output treatment.
- Variant B has the strongest visual identity and the best repair of the
  existing endpoint problem.
- Variant C has the clearest onboarding and use-case framing for the broader
  product.
- Variant D is B's board with C's preview-before-you-commit browsing grafted
  onto the add-effect step — the chosen direction.

All four keep the product and competition guardrails from
[WEBMCP-CHALLENGE.md](WEBMCP-CHALLENGE.md): visible shared state, human-only
Bypass, visible agent status, Undo, signal order, output safety, keyboard
access, and a prompt path on the main screen.
