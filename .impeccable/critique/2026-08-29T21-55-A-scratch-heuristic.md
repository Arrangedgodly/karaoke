# Scratch — Assessment A (design review), cycle-3 finishing critique
Recorded BEFORE any detector output entered context. Browser evidence: fresh headless
system-Chrome tab via raw CDP (Browser Use runtime unavailable to subagents; playwright-core
absent). Screenshots /tmp/impeccable-critique3-a/{1-gated-default,2-live-default,3-live-cycle3-cards,4-cycle3-scrolled}.png + DOM probes at 1440x900.

## Sources read
index.html, styles/main.css (family tokens, param rows/select, EXP badge, palette),
src/canvas.js, src/param-controls.js, src/agent-ui.js, src/presets-ui.js, src/main.js,
src/node-types.js, paramSpecs of node-gate/distortion/chorus/autotune, PRODUCT.md,
DESIGN.md, .impeccable/surfaces/index-html.md. Trend context: 27 → 33 → 35 (/40).

## Live-DOM facts (probes, no detector)
- Palette renders 10 chips (registration order), aria-labels action-phrased; autotune chip
  carries "(experimental)" suffix + visible EXP tag; computed EXP badge font-size = 10px
  (0.625rem) on BOTH chip and card — below the 11px floor; CSS comment falsely asserts
  "above the 11px card floor"; DESIGN.md documents 0.625rem, contradicting its own floor rule.
- PLAIN_LANGUAGE_HELP covers gain/compressor/eq/delay/reverb/limiter ONLY. Cycle-3 params
  with zero help: gate Threshold/Attack/Release/FLOOR, autotune Key/Scale/RETUNE SPEED/Mix,
  chorus DEPTH (ms)/RATE (Hz)/Mix, distortion Drive/Tone/Output (row.title = null, verified).
- Distortion Drive/Tone render "0.25%" / "0.7%" (0–1 values with % unit) while every other %
  param surface-wide is 0–100 (Mix "30%"). Same-card inconsistency (verified DOM value text).
- Param select: native <select>, 11.2px, mono register, values C/Major, widths 88/96px,
  row rhythm preserved. Autotune header 24px, badge 91px, no wrap/ellipsis.
- 10-card chain: only 3–4 cards fit the 673px canvas viewport; pinned OUT footer + safe-output
  note + FLOW toggle stay visible (cycle-2 invariant holds). Internal scroll carries the rest.
- Palette: 10 flat chips fit the 900px flank; no grouping headers of any kind.
- Headless edge observed: after Start success, strip read "Stopped" (context resumed after
  start completion; handleContextState only refreshes status when contextLost was set —
  a late resume never corrects the strip). Likely unreachable with a real user gesture;
  recorded as P3 edge, not a scored defect.
- Two window.alert() remain in presets-ui defensive paths (mid-session preset disappearance).
- Meters: scale labels are −60/−40/−20/−6/0 canvas-drawn (earlier "−60 twice" was a misread).

## Cognitive load checklist
FAIL chunking/minimal-choices: the add-a-node decision point now exposes 10 flat, ungrouped
options (working-memory rule: 8+ = overloaded). Other six items pass. → moderate load.

## Heuristic scores (A's judgment, pre-detector)
1 Status 4 (strip/meters/toasts/unsaved dot; EXP disclosed pre-add; "AGENT —" placeholder + late-resume wedge noted)
2 Real-world 3 (plain-language layer exists for 6/10 families; Floor/Retune/Depth/Rate/Drive ship with none)
3 Control 3 (undo-conflict confirm + recovery toasts strong; manual-edit undo still absent — standing)
4 Consistency 3 (0.25% vs 30% unit break on the distortion card; 2 latent native alerts; otherwise one vocabulary)
5 Error prevention 3 (armed delete, gating, watchdog, EXP honesty; +24 dB gain / limiter removal mid-show still unguarded — standing)
6 Recognition 3 (all visible + redundantly encoded; but 4 new families' params must be recalled/Googled; help discovery still hover-only)
7 Flexibility 3 (keyboard add + spacebar + Cmd+Z; selects add native typeahead; no numeric fader entry, no keyboard reorder — standing)
8 Minimalist 3 (density disciplined, footer earns its row; EXP badge at 10px breaks the surface's own 11px floor — new)
9 Error recovery 4 (operator-voice failures with next actions; truthful undo-failure notes with retry — strongest register)
10 Help/docs 3 (14 help lines, no visible affordance; none for the four new families)
Subtotal A: 32/40.

## Strengths (specific)
1. Experimental disclosure has ONE source (registration `experimental: true` → card badge,
   chip aria-label suffix, agent capabilities readout) — visible badge and agent-facing
   disclosure cannot drift; SR hears the status BEFORE the node is added.
2. Param select is a native semantic in the design system's clothes: arrows/typeahead/SR
   value announcement free, mono readout register, 11.2px floor, fader row rhythm intact.
3. PR #17 toast truthfulness: failed restores keep the entry + show why + "retry Undo";
   conflicted undos require explicit "Undo anyway"; recovery toasts outlive the 6s toast.

## Priority issues (A's candidates)
P2a. Four cycle-3 families ship with zero plain-language help (the exact gap run-1 fixed).
P2b. EXP badge renders below the surface's own 11px floor, with a CSS comment and DESIGN.md
     that (wrongly) rationalize it — the same self-contradiction cycle 1 fixed for RATE/LATENCY/NODES.
P2c. Palette decision point at 10 flat, ungrouped options (chunking/working-memory violation).
P3. Distortion Drive/Tone unit display (0–1 scale + "%" → "0.25%") inconsistent with the
    surface's 0–100 % convention; misleading to the non-engineer.
P3. Late-context-resume leaves strip at "Stopped" (edge); 2 latent window.alert in defensive paths.

## Personas
Marco (brother): "Floor −40 dB", "Retune Speed 0 ms", "Depth 3 ms" with no plain language;
"Drive 0.25%" reads as a quarter percent; 10-effect wall with no grouping at setup time.
Sam (a11y): EXP badge text at 10px; selects natively operable (win); chip aria suffix (win);
help lines sr-only-announced for 6 families only.
Alex: param select typeahead is a real accelerator; still no numeric fader entry/keyboard reorder.

## Specificity verdict
Authored, not category-interchangeable: ten-family rq5-verified edge coding with shared
initials lookup; EXP badge in the amber status vocabulary; one badge factory, two placements
(card full, chip abbreviated — same abbreviation discipline as legend initials). Weak spots:
the % unit break and the below-floor badge are the first self-inconsistent tokens since the
cycle-1 fixes.
