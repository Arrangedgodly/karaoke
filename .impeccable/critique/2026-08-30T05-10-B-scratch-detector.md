# Assessment B scratch — CLOSING critique (detector + browser evidence)

Run AFTER Assessment A was recorded (2026-08-30T05-10-A-scratch-heuristic.md).
Single-context fallback; second of the two sequential assessments.

## Environment

- CLI: node .../impeccable/scripts/detect.mjs --json index.html → exit 2,
  4 findings: overused-font (roboto), flat-type-hierarchy (1.5:1; ladder
  now "11.2px, 12px, ... 16.8px" — the 10px step is GONE from the CSS
  ladder), side-tab (sortable-chosen family stripe), repeating-stripes —
  the same previously adjudicated keeps as the 32/40 run.
- Browser: project served on OWN port 8478 (python3 http.server); skill
  live-server on OWN port 8477 used only as the /detect.js host (its "/"
  serves the detector bundle, not the project — first attempt 404'd
  /index.html, recorded here). Headless system Chrome driven via raw CDP
  (WebSocket + Runtime.evaluate; Browser Use runtime rejects subagent
  sessions and playwright-core is absent — same fallback signal as the
  prior run). Fresh automated tab; preflight mutation verified
  (document.title set + appended <script> executed, marker 42); detect.js
  injected; [impeccable] console lines read. NO user-visible [Human] tab.

## Scan 1 — resting surface (pre-Start): "[impeccable] 2 anti-patterns found"

Details: wide-tracking 0.08em on span.sr-only (standing FP — sr-only help
spans), overused-font roboto 71%, flat-type-hierarchy (ladder starts at
11px). NO undersized-ui-text — the prior run's EXP-badge finding (10px ×2)
is GONE; both placements now measure 11px computed (chip "EXP" and card
"Experimental" probed directly).

## Scan 2 — 5 cards mounted via ChainCanvas.loadModel (the app's own
public model path; gain/distortion/chorus/gate/autotune): "8 found"

- wide-tracking ×1 (sr-only; standing FP)
- clipped-overflow-container ×1 (#chain-layout bounded canvas; standing
  adjudicated keep)
- border-accent-on-rounded ×5 (one per card = the ratified family top
  edge; standing false positive)
- nested-cards ×5 — NEW DETECTOR OUTPUT vs the 32/40 run (subject
  div.node-card). Candidate inner "card": the Experimental badge — now
  100.6×16.2px, 1px border + 3px radius + card ground, after the widened
  0.35rem padding; likely crossing a ~100px card-width heuristic (at the
  old 10px/0.25rem geometry it measured ~97px and did not fire).
  Adjudicated FALSE POSITIVE: a 16px-tall silkscreen status tag is not a
  card; DESIGN.md defines it as "a status tag, not a control". Watch: if
  a second experimental family ever lands, re-check.
- overused-font 65%, flat-type-hierarchy (11px floor start).
- NO text-occlusion with 5 cards; canvas scrollWidth == clientWidth
  (971px); anchors 57px tall with meters attached (an earlier probe's
  outVisible=false was my own exact-text-match bug — anchors carry meter
  text "OUT−∞Output…", not bare "OUT"; not a UI fault).
- Chips: real <button>s, honestly disabled pre-Start; group headers are
  non-interactive h3s; all 10 chips remain direct children of
  #palette-list after grouping.

## Live delta verification (closing round)

1. Palette grouping: three legends render in order — "Shape your voice"
   / "Polish your sound" / "Keep it safe"; 10 chips; groups ≤4.
2. EXP badge: chip "EXP" = 11px, card "Experimental" = 11px (both live
   computed). Detector concurs (no undersized-ui-text).
3. Distortion readout: card reads Drive=25%, Tone=70% (displayScale 100
   live-verified; Output −3 dB default convention unaffected). Chorus
   Mix=30% on the same surface — one % convention.
4. Help layer: EVERY param row on all five mounted cards (incl. the four
   new families) carries title help + aria-describedby; autotune Key
   line includes the experimental + fixed-20-ms disclosure.
5. Harden: dialog traps (alert/confirm/prompt) armed page-wide, ZERO
   fired during load/mount/palette interaction; preset-note is lazily
   created (not in DOM at rest — source-verified route); late-resume
   wedge NOT live-triggerable headless (no real mic gesture) —
   source-verified: handleContextState refreshes on every 'running'
   transition, upgrade-only gates.
6. PR #18 get_capabilities (live execute): serialized 2487 chars (prior
   payload >15,000) — nodeTypes.<type>.<param> {unit, range|values,
   action}; discrete key/scale publish value lists with action:'reject';
   experimental.autotune disclosure present; chainRules ×7; humanOnly ×3.
   Above the ~1.5k Chrome guidance note but same order of magnitude;
   agent-facing only. Distortion drive publishes {unit:'%', range:[0,1],
   action:'reject'} while the operator reads 25% — the documented
   agent-side 0..1 seam (one round-trip self-correcting).
7. WebMCP-absent console diagnostics exactly as designed ("expected
   without chrome://flags"); no other console errors.

## False positives / skips

- FP: wide-tracking (sr-only), border-accent ×5 (family edge),
  nested-cards ×5 (badge tag, new — see above), side-tab + stripes (CLI,
  drag-state/texture adjudications).
- Skipped: [Human] overlay presentation (automated tab only — runtime
  rejects subagent sessions); late-resume live trigger (needs real mic
  gesture); defensive preset paths live-fired (invasive select
  manipulation; source-verified quiet .preset-note route).
