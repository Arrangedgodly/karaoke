# Cycle 3 Refinement Ledger — Finishing Phase

Source critique: `.impeccable/critique/2026-08-30T04-01-50Z__index-html.md`
(32/40 Good; trend 27 → 33 → 35 → 32 — polish-layer dip on new surface
area, nothing structural). User gate answers (2026-08-29): help layer
first · distortion readout normalized 0–100 · all issues in scope.

| # | Command | Finding | Status |
|---|---------|---------|--------|
| 1 | `$impeccable clarify` | P2-1: four cycle-3 effects (gate, distortion, chorus, autotune) ship with zero plain-language param help — the wall cycle-2 round 1 tore down for the original six. | **done-pending-approval** |
| 2 | `$impeccable typeset` | P2-2: EXP badge renders at 10px on both placements — below the 11px floor; CSS comment + DESIGN.md misstate it as compliant. | **done-pending-approval** |
| 3 | `$impeccable layout` | P2-3: palette is 10 flat ungrouped chips (was 6) — chunking violation at the decision point. | queued |
| 4 | `$impeccable polish` | P3-4: distortion Drive/Tone read "0.25%"/"0.7%" (0–1 scale + %) vs surface 0–100% convention — user approved normalizing to 0–100. | queued |
| 5 | `$impeccable harden` | P3-5 (partial): two latent `window.alert`s + late-context-resume can wedge the strip at "Stopped". The manual +24 dB / limiter-removal sovereignty finding stays recorded as deliberate design (backlog), per cycle-2 close. | queued |

Closing-critique trigger: entries 1–3 are P2 findings and 2–3 touch the
design system (type floor, palette structure) → closing critique + final
document refresh required after the loop.

## Entry log

(Workers append outcome + evidence here; the master records gate outcomes.)

### Entry 1 — `$impeccable clarify` (P2-1 cycle-3 help gap) — done-pending-approval

- **Files changed**: `src/param-controls.js` only (+39/−6: the map gains
  14 new lines — gate ×4, distortion ×3, chorus ×3, autotune ×4 — plus
  its doc comment; the cycle-2 wiring is byte-identical). No markup, no
  CSS, no dialogs, no new surface — the layer is additive exactly as
  cycle-2 round 1 built it.
- **Mechanism**: identical to the original six — same
  `PLAIN_LANGUAGE_HELP` single source, same per-row attachment (title on
  row AND control, `.sr-only` span, same-row `aria-describedby`), same
  register (plain-language operator voice, no label prefix, no em-dashes,
  direction clauses "Higher = …" on the risky ones). Copy follows
  README.md's own operator disclosures verbatim in substance (gate
  Threshold = "how quiet a sound can be before the gate closes on it";
  distortion Output carries the never-past-clean cap; chorus
  Depth/Rate = "how far/how fast the doubled voices wander"; autotune
  Retune = instant robot snap vs smoother glide). Risky controls carry
  the outcome-framed direction clause per the critique's fix note: gate
  Threshold/Floor, distortion Drive/Output, autotune Retune Speed.
- **Autotune disclosure**: the required experimental status + accepted
  fixed 20 ms engine delay ride the Key line — the card's FIRST param
  row and first tab stop — so the sentence is said once per card, not
  four times (clarify.md: say each idea once); the badge on the same
  card header and the chip's pre-add aria-label already carry the status
  from the same single source (`NodeTypes.isExperimental`). Operator
  wording per README: "Experimental: the newest engine, and it adds a
  fixed 20 ms delay (a fiftieth of a second) to the vocal."
- **Evidence**: `tests/test-palette-cards-cycle3.js` extended with
  section H (the cycle-2 layer had no committed test; this file is the
  vm-DOM harness that already renders the real ten-module registry
  through the real param-controls.js). Section H renders ALL TEN types
  via loadModel and verifies, per param row (28/28): non-empty `.sr-only`
  span, row-scoped span-id convention, title set on row AND control with
  the same line, and same-row `aria-describedby` resolution — plus the
  five risky lines carry direction clauses, the autotune Key line
  discloses Experimental + 20 ms, and the status sentence rides the
  first row only. This doubles as the help-completeness gate the closing
  critique mused about: a future family shipping without help lines now
  fails the suite. Render-level spot check (vm-DOM, verbatim gate +
  autotune card help printed): titles/sr-only/describedby all match per
  row. Full suite **23/23 files / 1823 checks green**.
- **Residuals (disclosed)**: help discovery remains hover/focus-only
  (the unfunded "?" seam — standing, out of scope); the painted tooltip
  itself is OS chrome (same disclosed trade-off as cycle-2 round 1);
  Drive/Tone still read "0.25%"/"0.7%" until entry 4 lands — the help
  lines deliberately avoid referencing the readout numbers so both
  conventions read true.

### Entry 2 — `$impeccable typeset` (P2-2 EXP badge under the 11px floor) — done-pending-approval

- **Files changed**: `styles/main.css` (the UI-2 badge block only:
  font-size 0.625→0.6875rem, side padding 0.3→0.35rem, comment
  corrected), `DESIGN.md` (badge spec value), `.impeccable/design.json`
  (sidecar description + css snippet), `tests/test-palette-cards-cycle3.js`
  (+138: new section I). No src/ JS, no markup, no audio/MCP — the badge
  factory and its single-source status wiring are byte-identical.
- **Mechanism**: both placements already render through ONE rule
  (`.node-experimental-badge`; the chip-scoped rule adds only
  `margin-left: auto`), so one size lift fixes both placements at once:
  0.6875rem = 11px computed, the legend-initials floor precedent that
  DESIGN.md's 11px Floor Rule already declares. Side padding widened
  0.3→0.35rem (the critique's fix note: compensate at the larger size);
  weight 700 / 0.06em tracking / amber-on-Module-Card (6.65) untouched —
  still a quiet status tag, no new loudness. Both misstatements
  corrected: the CSS comment (which claimed "above the 11px card floor
  at 0.625rem" — 0.625rem IS 10px) now states the floor honestly and
  names the correction; DESIGN.md's badge spec and the design.json
  sidecar snippet carry the corrected value so no doc can re-contradict
  the stylesheet.
- **Evidence**: test section I parses the REAL main.css (comments
  stripped) and asserts: rule present; font-size 0.6875rem = computed
  11px, meeting the floor; the chip-scoped rule sets NO font-size (the
  two placements cannot drift); the legend-initials rules (`.node-card
  ::before` / `.node-chip::before`) hold the same 0.6875rem; tag
  treatment (700 / 0.06em) and amber-on-card colors unchanged; padding
  widened; both live DOM placements wear the one class; DESIGN.md +
  design.json agree with the stylesheet — any future re-shrink or doc
  drift fails the suite. Render-level check (headless Chrome, real
  stylesheet, canvas.js-faithful DOM): computed 11px on BOTH placements;
  chip badge 35×16.2px single-line with the chip at 167px in the real
  200px palette flank and 187px at a 220px-flank variant —
  scrollWidth === clientWidth both times (zero overflow; chip height
  38px unchanged, badge under the 20px legend square, density kept);
  card badge 100.6×16.2px single-line, header one 24px row, no
  chevron overlap at production width (939px card at 1440×900); chip
  aria-label still "Add Autotune to chain (experimental)". Detector
  type scan: 13 → 12 findings — the badge's 0.625rem off-ramp advisory
  is gone; the remaining 12 are the standing adjudicated set, untouched.
  Full suite **23/23 files / 1836 checks green**.
- **Residuals (disclosed)**: in a sub-production ~240px canvas column
  (window narrower than ~680px; the venue default is 1440×900) the
  squeezed card's badge rides over the collapse chevron — measured
  pre-existing at the old 10px too (17.3px overlap vs 26.8px now; label
  ellipsization is the designed shrink path), a standing narrow-window
  edge outside this entry's appearance-only scope.
