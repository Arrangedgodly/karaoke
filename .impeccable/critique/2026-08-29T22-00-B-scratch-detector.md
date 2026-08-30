# Scratch — Assessment B (detector + browser evidence), cycle-3 finishing critique
Recorded after Assessment A was completed and archived. Live surface http://localhost:8000
(python http.server, started for this run). Browser: fresh headless system-Chrome tab via raw
CDP — Browser Use runtime refused subagent context ("Browser is not available in subagent"),
playwright-core not installed; preflight mutable injection SUCCEEDED (document.title set to
"impeccable-preflight", script tag appended, read back 42), so overlay path ran for real.
Live server: node live-server.mjs --background → port 8400 (pid 58475); stopped with
`live-server.mjs stop` after collection (port verified closed). Overlay state: default preset
+ the four cycle-3 cards (10 cards), 1440x900.

## CLI scan (detect.mjs --json index.html) — 4 findings, exit 2
1. overused-font (roboto) — STANDING false positive: platform system stack fallback name,
   offline/no-webfonts constraint mandates the stack.
2. flat-type-hierarchy (ratio 1.5:1) — STANDING adjudicated keep: hierarchy carried by
   register (mono vs silkscreen), weight, color per DESIGN.md's two-register rule.
3. side-tab (3px sortable-chosen family stripe) — STANDING adjudicated keep: drag-state
   emphasis of the ratified family edge encoding, not an AI side-tab.
4. repeating-stripes-gradient (fader detent ticks) — STANDING adjudicated keep: functional
   skeuomorph; noise-at-size residue acknowledged.

## Browser overlay (inject http://127.0.0.1:8400/detect.js) — console: "[impeccable] 15 anti-patterns found"
Distinct findings (overlay elements verified in DOM, screenshot 5-overlay-live.png):
- undersized-ui-text ×2 — 10px "EXP" (chip) and 10px "Experimental" (card),
  span.node-experimental-badge — **GENUINE, NEW**: the cycle-3 badge renders below the
  design system's own 11px floor; matches Assessment A's independent source finding.
  Also newly pulls a 10px step into the computed size ladder (see flat-hierarchy below).
- border-accent-on-rounded ×10 — one per node card (3px family top edge + 8px radius);
  was ×6 at the 35/40 run, ×10 only because 10 cards were mounted. STANDING false
  positive (ratified redundant family encoding).
- wide-tracking ×2 — span.sr-only (agent chip explanation). STANDING false positive
  (invisible text; tracked silkscreen register on visible labels is the system itself).
- clipped-overflow-container — div#chain-layout clips a positioned child. STANDING
  adjudicated keep (bounded-scroll VIS-7 canvas; the same geometry cycle 2 adjudicated).
- overused-font ×2 — roboto (59%) + arial (17%) computed primaries. STANDING false
  positive (system stack).
- flat-type-hierarchy — sizes now 10px…16.8px (ratio 1.7:1). Same adjudication as ever
  (register-carried hierarchy), with one honest residue: the only sub-11px member of the
  ladder is the new badge — the undersized-ui-text finding, not a new hierarchy problem.
- text-occlusion: NOT reported this run (cycle-2's ×2 sr-only hits did not recur; no
  genuine occlusion found — pinned OUT footer geometry intact in screenshots 3/4).

## Detector vs review
- Agreement: the EXP badge's 10px size (review found it in source/CSS comment + computed
  style probe; detector independently flagged both placements from the live DOM).
- Detector-only: the badge's effect on the surface-wide size ladder (10px now in the
  computed set).
- Review-only (beyond detector reach): the four new families' missing plain-language help
  layer; Drive/Tone "0.25%" 0–1-with-% unit break; 10-chip ungrouped palette decision
  point; PR #17 toast-truthfulness assessment; headless late-resume "Stopped" strip edge.

## Skipped/failed steps
- Harness-native [Human] browser presentation: unavailable (Browser Use rejects subagents;
  no native browser-canvas tool). Fallback signal: headless automated tab + archived
  screenshots (/tmp/impeccable-critique3-a/*.png) + DOM probes.
- No multi-view injection: single-page app (PRODUCT "One page" constraint) — one view,
  two mounted states (gated + live) inspected.
