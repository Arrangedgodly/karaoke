# Assessment A scratch — CLOSING critique (design review, pre-detector)

Recorded BEFORE any detector/browser output entered context. Single-context
fallback (no sub-agent/Task tool exposed in this session); this scratch is
the isolation seam. Replaces the cancelled 05-10 run's partial scratch.

Mode: Operate. Closing run after refinement round 1 (five approved entries)
+ merged PR #18. Adjudications carried in: manual +24 dB / limiter-removal
sovereignty is DELIBERATE (not re-litigated); hover/focus-only help
discovery is a disclosed unfunded residual.

## Delta verification (source level)

1. Help layer (P2-1 fixed in source): PLAIN_LANGUAGE_HELP in
   src/param-controls.js now covers ALL 10 families — distortion
   drive/tone/output, chorus depthMs/rateHz/mix, gate
   threshold/attack/release/floor, autotune key/scale/retune/mix. The
   critique-named risky rows (gate Threshold/Floor, distortion
   Drive/Output, autotune Retune) carry outcome-framed direction clauses.
   Autotune's experimental + fixed-20-ms disclosure rides the Key line
   (first row, first tab stop) — said once per card, matching the badge
   single-source. PENDING LIVE: title/aria-describedby wiring on the new
   rows.
2. EXP badge (P2-2 fixed in source): .node-experimental-badge at
   font-size 0.6875rem (11px) with widened 0.35rem side padding
   (styles/main.css:1256-1264); .node-chip variant inherits everything
   except margin-left:auto — both placements share the size. CSS comment
   and DESIGN.md §badge both corrected to name the 11px floor ("the
   legend-initials size"). PENDING LIVE: computed px on both placements.
3. Palette grouping (P2-3 fixed in source): three operator legends —
   "Shape your voice" (eq/distortion/chorus/autotune = 4), "Polish your
   sound" (gain/compressor/delay/reverb = 4), "Keep it safe"
   (limiter/gate = 2) — every group ≤4 chips (working-memory rule now
   passes). Catch-all "More effects" fallback renders only when
   populated; registry stays the source of chip order. Headers are real
   non-interactive h3 silkscreens (0.7rem = 11.2px, above floor) —
   heading outline h1→h2→h3 is SR-navigable; chips remain direct
   children; SortableJS draggable scoped to '.node-chip'. PENDING LIVE:
   legends render, chips still operable.
4. Distortion readout (P3-4 fixed in source): displayScale:100 on
   drive/tone in src/node-distortion.js paramSpec, readout-only —
   formatValue multiplies just the rendered string; slider/model/preset/
   agent numbers stay 0..1 (saved drive 0.25 means the same sound).
   Display convention now surface-wide 0–100%. PENDING LIVE: card reads
   Drive 25% / Tone 70% / Mix 30%.
5. Harden (P3-5 fixed in source): grep-verified zero alert(/confirm(/
   prompt( in src/ (only watchdog-alert element names remain); both
   presets-ui defensive paths route through the quiet .preset-note line;
   main.js handleContextState refreshes the status sentence on EVERY
   'running' transition with upgrade-only gates (isEngineLive + error
   register) — the late-resume wedge reads fixed in source. PENDING
   LIVE: surface-level no-dialog check.
6. PR #18 (get_capabilities compact): nodeTypes.<type>.<param> =
   {unit, range|values, action}; discrete cycle-3 params publish the
   value list with action:'reject'; experimental.<type> top-level note
   map (single-source via NodeTypes.isExperimental, autotune only);
   chainRules condensed to 7 one-line rules; humanOnly list. Was >15k
   chars, now targets Chrome's ~1,500-char guidance. No human-visible
   surface change. PENDING LIVE: serialized length sanity check via
   harness-free console probe (optional).

## Design-specificity (unanchored)

Still authored, not category-interchangeable — the refinements
strengthened the product's own vocabulary rather than borrowing generic
UI: palette legends derived from README's own framing verbs ("adds grit",
"thickens", "pulls each note toward the key" → Shape/Polish/Keep it
safe), help lines in README voice with direction clauses, the badge
repaired inside the system's own type ladder (the legend-initials size).
The grouping is a presentation seam over the registry — no hardcoded type
list, catch-all never silently drops a type. The one self-inconsistency
class the system keeps flirting with (two display scales for one number)
now survives only agent-side: get_capabilities still publishes drive/tone
as {unit:'%', range:[0,1]} while the operator surface reads 25% — an
agent asked for "50% drive" sends 50, gets rejected with the [0,1] range
inline, corrects in one round trip. Deliberate (documented in
node-distortion.js/param-controls.js comments) but a real seam; P3
candidate.

## Heuristic draft (pre-live; to reconcile with live evidence)

1 Status 4 (wedge fix closes the last non-deliberate gap; "AGENT —"
  residue deliberate) · 2 Match 4 (10/10 families helped; % convention
  uniform operator-side) · 3 Control 3 (manual slider/drag edits still
  lack undo — standing) · 4 Consistency 4 (dialogs gone; % uniform; only
  agent-side 0–1+% seam remains, P3) · 5 Error Prevention 3 (+24 dB/
  limiter-removal unguarded = deliberate sovereignty, standing by
  adjudication) · 6 Recognition 3 (help discovery still hover/focus-only
  — disclosed unfunded "?" seam) · 7 Flexibility 3 (no numeric fader
  entry, no keyboard reorder — standing) · 8 Aesthetic 4 pending live
  badge measurement · 9 Recovery 4 (unchanged strongest register;
  defensive paths now have quiet recovery notes) · 10 Help 4 pending
  live confirmation of the new rows' wiring.

Draft total: 36/40 pending live verification of entries 1, 2, 4, 8, 10
(help on hover/focus; badge px both placements; group legends + chips
operable; distortion card 0–100%; no dialogs live).

## Watch list for live run (possible NEW issues)

- Group headers must not break chip drag ghost geometry (Suite green
  23/23 was pre-merge; verify chips still draggable-looking in DOM).
- New .palette-group-label (0.08em uppercase tracking, muted) — check
  the detector's wide-tracking/contrast rules don't fire on it.
- Autotune Key help line ~200 chars — long for a native title tooltip.
- Agent-side drive {unit:'%',range:[0,1]} vs operator 25% (P3
  candidate; agent contract deliberately 0..1).
- Late-resume wedge: not practically triggerable headless without a real
  mic; source-verified logic + upgrade-only gates. Record as
  source-verified, not live-verified.
