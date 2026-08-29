# Cycle 2 Production Log

Evidence trail for cycle-2 production. Task statuses live in plan.md;
approval cursor in state.md.

---

## FEW-1 — Agent event contract + components — `awaiting-approval`

**Date**: 2026-08-27 · **Delegation**: general-purpose subagent (fallback
none; subagent available), master verification in-session.

**Changed files**
- `src/agent-ui.js` — NEW, 656 lines: authoritative contract doc-block +
  IIFE `window.AgentUI` (setState/getState, reportMutation, pushUndo/undo/
  canUndo/clearUndo, init; dynamic #agent-chip + #agent-toast-region;
  Escape/hover/6s/3-max toast rules; Ctrl/Cmd+Z gated to toast presence).
- `index.html` — +9 lines: script tag between persistence.js and
  presets-ui.js, house comment style.
- `styles/main.css` — +65 lines: structural-only block (neutral tokens,
  positioning; theming deferred to VIS tasks).

**Validation evidence**
- `node --check src/agent-ui.js` clean (run by subagent and master).
- Subagent fake-DOM harness (real file, fake clock): **39/39 checks** —
  event shapes, no-op rules, toast lifecycle, undo button sync, 20-cap,
  Cmd+Z gating incl. Space passthrough (`/tmp/few1-agentui-harness.mjs`,
  outside repo).
- Master live-browser check (in-app browser, python3 http.server :8000):
  page loads; app fully intact (palette 6 types, presets w/ localStorage
  "Classic Karaoke", canvas, disabled Bypass — matches cycle-1 gating);
  snapshot shows chip "AGENT —" + sr-only text inside topbar before
  Bypass; locator reads: chip count 1, `data-state="unavailable"`,
  region count 1 as body's last child; CSS block present (main.css
  L448–505+); screenshot captured (session artifacts).
- Keyboard coexistence: statically verified against main.js Space handler
  (disjoint conditions: this module only inspects z/Z+Ctrl/Cmd, skips
  form controls, preventDefaults only on real undo). Harness confirms
  Space with toast present → no preventDefault, no undo.

**Honest limitations**
- Live in-browser exercise of setState/reportMutation/undo not performed:
  IAB evaluate is read-only (side-effect rejected, per browser-skill
  discipline). Dynamic behavior rests on the 39-check harness against the
  real file; will be re-verified live during MC-1/MC-5 integration and
  QA-2/QA-3.
- Console-error check was structural (self-init try/catch + nothing
  top-level can throw) rather than an observed empty console.

**Deviations from task spec** (documented in contract block by subagent,
accepted by master as within FEW-1 outcome):
1. Undo button appears iff stack non-empty (avoids dead affordance);
   push/report order-independent.
2. Internal render copy of detail; event carries exact reference.
3. Documented defaults for unspecified edges (missing summary → warn/no
   toast; clearUndo fires no event; return values).

**Follow-ups for later lanes** (contract block is authoritative):
MC-1 calls setState after registration/around execute; MC-5 pushes
restore closures + nodeIds on reportMutation (VIS-6 pulses listen to
`agentui:mutation`); VIS-2/VIS-6 theme `.agent-chip[data-state]`,
`.agent-toast*` classes; region has role=region + aria-label.

**Commit/approval**: not committed (user commits by preference at gates);
awaiting user approval.

---

## VIS-1 — Theme token foundation — `awaiting-approval`

**Date**: 2026-08-27 · **Delegation**: general-purpose subagent; master
verification in-session. UI-task discipline: impeccable context.mjs already
run this session; craft-floor loaded before editing; **finish-reviewer +
documenter routed to POL-1 over the assembled surface** (per plan
structure — per-VIS-task full reviews would re-flag what VIS-2..4 are
scoped to do; recorded here deliberately).

**Changed files**: `styles/main.css` ONLY (104 lines removed / 217 added,
rules 57→63). No JS/HTML touched.

**What changed**
- `:root` now carries the rq5 token set verbatim (24 tokens + mono readout
  stack) — master-verified by independent sed/grep of the block.
- Full old→new mapping: --panel→bg-panel, --border→hairline (seams) /
  line-strong (interactive bezels), --muted→text-muted, --live→accent
  (amber owns LIVE per rq5), bypass split-role (OFF: panel bg + 2px
  red-edge ring + text-primary; ON: red-fill + white + red-edge), body
  dark, controls/selects/sliders/palette/anchors/presets/toasts dark,
  `::selection` accent+on-accent, global `:focus-visible` amber ring,
  FEW-1 block references updated.
- Foundation-only tokens awaiting later tasks: --family-* (VIS-3/4),
  --meter-* (VIS-5), --status-live/--status-error, --accent-hover/active,
  --focus-ring-on-accent, --font-readout (VIS-2).

**Validation evidence**
- Subagent: every rq5 hex present once in :root; grep-zero for all old
  values/tokens; enumerated text/bg pair list — every pair an rq5-verified
  ratio (text-primary 11.04–14.36, text-muted 5.14–5.74, accent 7.43,
  white-on-red-fill 5.08; non-text 3.28–4.48); braces 63/63; .sr-only
  byte-identical; declaration-level diff proves no layout properties
  changed (only color/border/background/outline/opacity + slider
  pseudo-element geometry minimum).
- Master: independent grep confirms :root verbatim + 28 new-token usages +
  NO_OLD_VALUES_FOUND; live reload snapshot — full structure intact
  (topbar/palette/canvas/presets/agent region, saved preset loads);
  screenshot captured (session artifacts) for the user gate.

**Documented deviations** (in subagent report, accepted)
1. `color-scheme: dark` added — native select popups/scrollbars must not
   render light; zero layout effect.
2. Slider pseudo-element geometry (4px track/14px thumb) — irreducible
   minimum for hairline-track/accent-thumb/bezel treatment.
3. Shadow opacities re-tuned for dark ground (0.3/0.45/0.5); removed the
   light-theme red halo + its compensation rule.
4. Family stripes on node cards SKIPPED — required finding: canvas.js
   sets only data-node-id, no family attribute in CSS-reachable form
   (JS off-limits in VIS-1). Palette chips DO carry data-node-type →
   VIS-3 can apply family edges today; VIS-4 must expose type on cards.

**Flags for later tasks**
- Gated state keyboard focus not trapped (pre-existing cycle-1 quirk,
  unchanged) → QA-4/VIS-4.
- Remove-× hover uses red-edge border + text-primary glyph (red-edge as
  small text fails 4.5) → VIS-4 revisit.
- Start button kept neutral — VIS-2 differentiates.

**Commit/approval**: awaiting user approval.

---

## MC-0 — Live localhost WebMCP spike — `awaiting-approval` (user validation pending)

**Date**: 2026-08-27 · **Executed directly by master** (logged deviation:
trivial seed code + interactive user validation; subagent delegation waived
for speed — the hardening into the permanent shim IS task MC-1).

**Changed files**
- `src/mcp-server.js` — NEW, 156 lines: IIFE spike registering one `echo`
  tool via `document.modelContext ?? navigator.modelContext` per RQ-1;
  readOnlyHint annotation; plain-object result (deliberately labeled in the
  result body to resolve RQ-1's content-wrapper contradiction from the
  DevTools render); silent no-op + one console.info when API absent;
  drives AgentUI.setState('tools-ready') on success (first live use of the
  FEW-1 contract).
- `index.html` — script tag after agent-ui.js with house-style comment.

**Validation evidence**
- `node --check` clean; server serves both files (HTTP 200).
- **No-op path verified live (IAB, WebMCP absent)**: reload → app identical
  (palette/presets intact), chip `data-state="unavailable"` — the
  graceful-degradation acceptance holds.
- User-flagged-Chrome path: PENDING — checklist handed to user (DevTools →
  Application → WebMCP pane: tool listed, Run with message, observe result
  shape; chip should flip to AGENT READY).

**What the user's check resolves**
1. A-1 assumption (localhost viability) — confirmed/falsified.
2. RQ-1 contradiction (plain value vs content-wrapper) — which renders.
3. Whether flag name/mechanics on their stable Chrome match RQ-1.

**Commit/approval**: awaiting user's DevTools observation.

**OUTCOME (2026-08-27, user validation received)**: user's flagged Chrome —
chip flipped to **AGENT READY**; `echo` listed in DevTools WebMCP pane; ran
with message "hello"; output was the **plain object**
`{echo:"hello", at:"2026-08-27T18:51:37.538Z", app:"karaoke-chain-builder",
note:"MC-0 spike: plain object result (not MCP content-wrapper)"}`.
All three spike questions answered: A-1 confirmed; result-shape
contradiction resolved (plain values); flag mechanics work on stable.
**MC-0 → completed.** Scope note: Inspector-extension NL drive deferred to
MC-6/QA-3 (already planned there, with the 5-prompt script).

---

## MC-1 — Permanent WebMCP shim — `awaiting-approval`

**Date**: 2026-08-27 · **Delegation**: general-purpose subagent (full
rewrite of src/mcp-server.js — the ONLY file changed, SHA-256 manifest
verified across all 62 project files); master verification in-session.

**API shipped** (authoritative doc-block in file):
`McpServer.registerTool(def) → Promise<boolean>` ·
`registerTools(defs) → {registered[], failed[]}` · `isAvailable()` ·
`listRegistered()`. def = ModelContextTool shape + shim-only `timeoutMs`.
Core hardening: execute wrapper — `acting` state on entry, plain-value
passthrough on success, inner-throw/timeout → descriptive
`{error:true, tool, reason, hint}` result objects (RQ-1 live-verified
convention), `tools-ready` on every settle; API options/AbortSignal
passed through; AgentUI guarded (absent + throwing).

**Validation evidence**
- Subagent: node --check clean; **60/60 vm-sandbox harness checks**
  (/tmp/mc1-test.js) — result shapes byte-exact, state transitions in all
  three outcomes, signal pass-through, registry dedupe, lazy detection,
  absent-API trace byte-identical to spike (same single console.info,
  zero state changes); single-file manifest diff.
- Master: node --check clean; doc-block inspected (matches report);
  IAB no-op reload: chip `unavailable`, app structure intact.

**Documented deviations** (accepted)
1. registerTools with API absent → ONE warn per batch (not per tool) —
   avoids 8× warns on unflagged browsers when MC-2 lands.
2. setStateSafe guard around AgentUI.setState — broken AgentUI must not
   leak into API-facing wrapper.

**Notes carried**: MC-2 plugs schemas via registerTools(); MC-3 removes
echo by deleting makeEchoTool() + its single init() call (file header
documents this).

**Commit/approval**: awaiting user approval. Optional live demo on the
user's flagged Chrome: run `echo` in DevTools WebMCP pane — chip should
flash AGENT ACTING → AGENT READY.

---

## MC-2 — Tool schema layer — `awaiting-approval`

**Date**: 2026-08-27 · **Delegation**: general-purpose subagent; master
verification partial (see limitation).

**Changed files**: `src/mcp-tools.js` NEW (1069 lines, IIFE
`window.McpTools.getDefs()` + self-init `McpServer.registerTools(...)`) +
script tag in index.html after mcp-server.js. Nothing else (git-baseline
verified).

**What shipped**
- 8 tool defs in ModelContextTool shape; description char counts audited
  (tools 208–331 of 500; params max 133 of 150). readOnlyHint on the 3
  readers; untrustedContentHint false throughout.
- Structural arg validation with plain-object results: INVALID_ARGUMENTS
  {reason, problems:[{path, message, allowed?}], suggestion} (RQ-3 style);
  valid args → honest NOT_IMPLEMENTED stubs until MC-3/MC-4. A crashing
  validator resolves SCHEMA_LAYER_FAULT (honest label), never a throw.
- Param fidelity mapped to the REAL app model (grepped ≥2× per node
  file): gain.gainDb; compressor.threshold/ratio/attack/release;
  eq.lowGain/midGain/highGain; delay.timeMs/feedback/mix; reverb.mix;
  limiter.ceiling/release. Nominal ranges only — rq3 safety table
  deliberately NOT encoded yet (MC-4).
- Registry-aware: prefers live window.NodeTypes paramSpec, static
  fallback snapshot mirrors node files; set_chain reuses
  PresetSchema.deserialize() as authority; set_param resolves node type
  via ChainCanvas runtime model.

**Validation evidence**
- node --check clean (master-verified).
- Subagent vm-harness **95/95** (/tmp/mc2-harness.js), 3 scenarios:
  (A) full registry — all stub outcomes + every required invalid case
  (flanger w/ 6-type allowed list, wrongKey w/ allowed gainDb, malformed
  set_chain → 3 precise problems, set_param missing fields, empty preset
  name) + range/type/position/duplicate-id/hostile-input no-throw sweep;
  (B) bare window — fallback path identical; (C) fake document.modelContext
  + real mcp-server.js — echo + 8 register in order, wrapped tool returns
  plain INVALID_ARGUMENTS through the shim.
- **Master IAB live check NOT run**: in-app browser webview detached
  (guest not attached; tabs lists empty; retries silent). No-op-path risk
  is covered by harness scenario B + node --check (self-init defers to the
  shim's absent-API short-circuit, MC-1-live-verified). Note: on unflagged
  browsers the shim emits ONE console.warn for this batch (MC-1 deviation
  1) — documented, accepted.

**Deviations/decisions (accepted)**: set_chain takes the full preset
object (deserialize contract — get_chain round-trips); structural
duplicate-id/unregistered-type rejection; boolean rejected where spec is
numeric.

**Notes carried**: MC-3 swaps the 3 read stubs + deletes echo canary;
MC-4 swaps the 5 mutation stubs + adds rq3 table; MC-6 renders from
fresh getDefs() calls.

**Commit/approval**: awaiting user approval. Live check available on the
user's flagged Chrome: DevTools WebMCP pane should now list 9 tools
(8 stubs + echo).

---

## MC-3 — Real read tools + canary removal — `awaiting-approval`

**Date**: 2026-08-27 · **Delegation**: general-purpose subagent + one master
repair (below).

**Changed files**: `src/mcp-tools.js` (3 read tools implemented;
1783→1809 lines), `src/mcp-server.js` (echo canary deleted per its own
header instructions — function + init registration + comments updated).

**What shipped**
- `get_chain`: ChainCanvas.getCurrentModel() → PresetSchema shape +
  engine state + preset name/unsaved (reuses presets-ui DOM sources);
  honest empty pre-start state (mirrors persistence default note).
- `list_presets`: PresetStore.listNames() + nodeCount per entry +
  currentlyLoaded; corrupt entries flagged null.
- `get_capabilities`: structured object — 6 types × 14 real params (live
  NodeTypes registry + static fallback), **18 chainRules** (every rq3 rule
  + host-owned disclosures + error-shape contract), orderGuidance (6),
  3 starterChains (self-consistency-verified: budgets 10.26–11.26 ≤ +12 dB,
  limiter terminal, caps respected), safetyNotes (4).
- **Unit-mapping table** (rq3 → app units, node-file-verified): gain
  [0,4]lin → gainDb [−24,+12] dB; delayTime [0.02,0.75]s → timeMs
  [20,750]; feedback ≤0.70 → ≤70% (node hard-cap 90 disclosed as differing
  from rq3's 0.85 parenthetical); limiter release [0.05,0.3]s → [50,300]ms;
  makeup estimate 0.57×|threshold| dB (rq3 anchors); EQ cuts clamp to app
  nominal −12 (tighter than rq3 −24); comp knee/EQ freq/Q disclosed as
  fixed (not app params); limiter attack locked at 0 ms (app native-min;
  rq3 window 1–3 ms — discrepancy disclosed).

**Master repair (within-task)**: subagent flagged that canary removal
orphaned the load-time 'tools-ready' chip transition. Fixed in
mcp-tools.js self-init: registerTools().then → if registered.length > 0 →
AgentUI.setState('tools-ready') (guarded, best-effort). node --check both
files clean. Deviation-closure, not scope change.

**Validation evidence**
- Subagent vm-harness **63/63**: field-exact get_chain vs stub; pre-start
  empty; no/throwing-ChainCanvas no-throw; list_presets exact; capabilities
  completeness (6×14 named params w/ nominal+agent+treatment; 18 rules incl.
  host-*; starter self-consistency); hostile inputs no-throw; mutations
  still NOT_IMPLEMENTED (regression check); static fallback parity; echo
  grep-zero in both files (delay descriptions reworded to keep grep clean).
- Master: node --check both files; tools-ready repair verified by syntax +
  contract trace (IAB webview still down — live check on user's Chrome).
- **Live check for user (flagged Chrome)**: refresh → chip **AGENT READY**
  (8 tools registered, no echo) → DevTools WebMCP pane → run `get_chain`
  (returns current chain JSON) and `get_capabilities`.

**Deviations (accepted, documented)**: compressor-count = compressor+
limiter both (≤1 musical compressor beyond required limiter — stated in
rule); makeup formula = 0.57×|threshold| line through rq3's own anchors
(spec page unreachable; constant exported as
MAKEUP_DB_PER_THRESHOLD_DB for MC-4 reuse).

**Notes carried**: MC-4 must enforce exactly the published table (reuse
AGENT_PARAM_POLICY/CHAIN_RULES statics or re-derive from
get_capabilities() — no drift); param without policy entry self-reports
"registry drift" (keep tripwire); preset-name "Unsaved chain" ambiguity
inherited from UI placeholder (fix only if presets-ui exports real state).

**Commit/approval**: awaiting user approval.

---

## MC-4 — Mutation tools + RQ-3 enforcement + host attenuator — `awaiting-approval`

**Date**: 2026-08-27 · **Delegation**: general-purpose subagent; master
verification (IAB down — static + harness).

**Changed files**: `src/mcp-tools.js` 1808→2993 (+1185: enforcement engine
from the published statics — single source of truth, no rq3 literal
duplication outside statics), `src/audio-graph.js` 501→728 (+227:
persistent outputAttenuator 0.5012=−6 dBFS; chainGate→attenuator→
destination; getOutputAttenuator; verifyAttenuatorOffline OfflineAudioContext
self-test; #safe-output-note derived from constants), `src/canvas.js`
491→527 (+36: dragActive from existing Sortable onStart/onEnd;
isDragActive() export), `styles/main.css` +17 (.safe-output-note).

**What shipped**: 4 mutation tools live (set_chain, add_node, remove_node,
set_param) — single write path via the UI's model/loadModel flow;
drag-vs-agent QUEUE (bounded 5 s → BUSY error); full rq3 enforcement
(reject/clamp per published table, limiter-required-terminal, +12 dB budget
incl. 0.57×|thr| makeup w/ per-node breakdown, EQ caps, compound guard,
node/comp/gain caps, HOST_OWNED carve-outs incl. attenuator); per-change
AgentUI.reportMutation summaries (basic; MC-5 upgrades); save_preset still
NOT_IMPLEMENTED (MC-5). Safe-output note visible next to OUT anchor.

**Validation**: vm-harness **64/64** — full enforcement-coverage table in
subagent report (every rq3 row → enforcement site → case id); round-trip,
starter-chains-pass-enforcement, hostile no-throw, reads regression, BUSY
queue+timeout, single-writer assertion. Master: node --check ×3 clean;
constants/note/drag-export verified by grep (note text DERIVED from
OUTPUT_CEILING_DBFS). Live attenuator check: verifyAttenuatorOffline()
awaiting QA-2/MC-6 in a real browser (IAB webview down).

**⚠ Flagged consequence for user decision (gate)**: the shipped
"Classic Karaoke" default chain predates rq3 (limiter ceiling −1 outside
agent range [−12,−3]; comp −24 dB breaks the +12 dB budget under the
makeup estimate) — `set_chain` of it VERBATIM REJECTS with exact trades.
Manual/UI path completely unaffected (show-safety principle intact);
agents simply cannot recreate a hot chain — which IS the approved policy
intent. Options: (a) accept as-is (recommended — no behavior change, agent
strictness is the point); (b) retune the factory default to be in-policy
(a small follow-up task); (c) town-hall if seen as scope-relevant.

**Notes carried**: MC-5 snapshot point = readCurrentModel() pre-apply +
readPresetDisplay(); undo via same loadModel path + conditional
markModified. FEW-3 watchdog derives ceiling from OUTPUT_CEILING_DBFS,
mutes via chainGate, never re-gains attenuator. QA-2 calls
verifyAttenuatorOffline() (assert peak < 0.6).

**Commit/approval**: awaiting user approval (incl. the flagged
consequence choice). **Resolved: option (a) accepted by user 2026-08-27.**

---

## MC-5 — save_preset + summaries + exact-state undo — `awaiting-approval`

**Date**: 2026-08-27 · **Delegation**: general-purpose subagent.

**Changed files**: `src/mcp-tools.js` only (2993→3577, +584). **All 8 tools
now live** — NOT_IMPLEMENTED machinery removed.

**What shipped**
- Snapshot-based undo (OQ-6): every APPLIED mutation (incl. clamped; not
  rejects/BUSY) pushes one AgentUI entry — deep-cloned serialize of
  {nodes, presetName, unsaved} captured post-drag-settle/pre-apply;
  restore via the same single write path (loadModel-equivalent) + display
  restore; restore deliberately bypasses re-validation (returns the
  human's pre-agent state even where agents couldn't create it — verified
  against the factory default's −1 dB ceiling).
- Human-readable summaries per mutation + refusal toasts (rejected:true +
  160-char-capped errorText) — operator sees every agent action and
  refusal.
- save_preset: trimmed 1–40 validation; save via PresetStore.save (the UI
  Save handler's exact call) + UI updates incl. dropdown rebuild; undo:
  created→remove (UI Delete flow), overwrote→re-save prior content;
  result {saved, overwrote, nodeCount}; not drag-queued (mirrors UI Save
  semantics).

**Validation**: /tmp/mc5-harness.js **39/39** (byte-identical restores,
clone immunity, label exactness per tool, save create/overwrite/invalid,
depth-2 undo, hostile no-throw, restore-via-AgentUI.undo()) ·
/tmp/mc4-harness.js re-run **64/64** (zero regression). NOTE for QA:
mc2/mc3-era harnesses carry stale pre-MC-4 expectations (retired stubs/
canary) — current-behavior coverage lives in mc4/mc5 harnesses only.

**Known limitation (accepted, owner: MC-6/VIS-3)**: presets-ui keeps
setCurrentPreset/clearModified/refreshPresetSelect private; MC-5 mirrors
those three DOM operations (documented in-file "MC-5 display mirrors"
block). Caveat: Save-prompt default suggestion may lag the displayed name
after an agent rename; all on-screen truth (display, dot, get_chain,
list_presets) is correct. Consolidate into real exports when presets-ui
is next legitimately open (VIS-3) — single-write-path hygiene.

**Other documented decisions**: corrupt-prior overwrite edge (undo removes
agent version — unreachable short of hand-edited localStorage);
PRESET_STORE_UNAVAILABLE code; store-contract failure-swallowing mirrored.

**Notes carried**: MC-6 harness drives undo via AgentUI.undo() and surfaces
undo labels + rejected stream; QA-3 exact-state steps scripted in report
(snapshot get_chain → undo per mutation → deep diff incl. save_preset
semantics).

**Commit/approval**: approved by user 2026-08-28.

---

## MC-6 — Dev test harness (agent simulator) — `awaiting-approval`

**Date**: 2026-08-28 · **Delegation**: general-purpose subagent (re-dispatched
after a harness-update interruption — no partial state; verified before
re-dispatch). Master verification partial (IAB webview still down).

**Changed files**: `src/mcp-harness.js` NEW (772 lines; IIFE, ?dev-gated;
exports window.McpHarness {run, close} in active mode — QA-2 console hook);
`index.html` +18 (comment + script tag after mcp-tools.js);
`styles/main.css` +287 (31 .mcp-harness* classes — tokens only, no new hex,
top offset clears topbar/Bypass, z-index below toasts).

**What shipped**: overlay panel with all 8 tools from fresh getDefs()
(mono names, readOnly badges, param summaries), valid-JSON prefills
(dynamic nodeId placeholders resolve live; set_chain prefill is
policy-legal 4.42 dB), direct def.execute() invocation (agent-free
portfolio path), per-tool run counters + pretty-printed results with
[error] flags, live agentui:* event stream (cap 200, clear), real-path
undo bar (AgentUI.undo, canUndo-gated, depth estimate re-synced by undo
events), Escape/Close, WebMCP status line, zero localStorage (proxy-trap
proven), zero footprint without ?dev (stubbed-DOM proven).

**Validation**: /tmp/mc6-harness.js **75/75** (gating negatives, full
panel build, prefill parse table, success/clamp/error runs, event-stream
exactness, undo-bar lifecycle incl. panel-button undo + exhaustion,
WebMCP-present stub, storage traps). Master: node --check clean; tag +
CSS verified by grep. Live panel check on user's flagged Chrome:
**http://localhost:8000/?dev**.

**Deviations (accepted)**: undo depth is an estimate between undo events
(AgentUI exposes only canUndo — never wrongly-enabled, authoritative
re-sync on agentui:undo.remaining); defs-direct runs skip the shim wrapper
so chip doesn't flip 'acting' from harness Runs (documented in header;
mutation/undo events still stream).

**Notes carried**: QA-2 drives the matrix via panel or McpHarness.run();
DOC-1 demo script sketched in report (6 steps incl. flag-on variant).

**MILESTONE M2 REACHED** (MCP functional core: MC-2/3/4 + MC-6 demoing
validated mutations without a live agent). M3 reached modulo VIS-6
styling of the same surfaces.

**Commit/approval**: awaiting user approval.




---

## VIS-3 — Palette + presets panels re-skin + consolidation — `awaiting-approval`

**Date**: 2026-08-28 · **Delegation**: general-purpose subagent. Master
verification static only (IAB webview down all session — user's flagged
Chrome is the live instrument).

**Changed files** (exactly 4): `src/canvas.js` (additive FAMILY_INITIALS +
data-family/data-initials on palette items only), `src/presets-ui.js`
(exports setCurrentPreset/clearModified/refreshPresetSelect — additive),
`src/mcp-tools.js` (MC-5 display mirrors DELETED; 5 call sites → exports
via presetsUiExport() resolver, one-warn degradation), `styles/main.css`
(.node-chip console-module rebuild, panel-header silkscreen treatment,
preset-name mono readout, pressed-state ink-on-amber for buttons).

**What shipped**: family legend squares (20px, family fill via
[data-family], initials in on-accent ink via attr() — rq5 redundant
encoding; color never fills items; 2px family top edge on hover/active
only, inset shadow = zero layout shift); silkscreen panel headers with
hairline rule; full state coverage incl. SortableJS drag vocabulary
(chosen/drag/ghost) matched to node-card styling; preset name in
--font-readout; drag-ghost-safe item sizing (~35px); MC-5's Save-prompt
lag caveat RESOLVED via real exports (verified: private currentPresetName
updates through exported path).

**Validation**: /tmp/vis3-harness.js **60/60**; regression sweep —
MC-4 64/64, MC-6 75/75, MC-5 39/39 (one documented stub adjustment: 3
tests moved their display-write assertions to the PresetsUI export spies —
behavior-identical, byte-identical assertions); CSS audit zero new hex,
braces 110/110; all files HTTP 200. Master: node --check ×3, attribute
grep verified.

**Known note**: live visual confirmation pending on user's Chrome
(panel look, chip rendering, drag states) — part of this gate.

**Commit/approval**: awaiting user approval.

---

## VIS-4 — Node cards + param controls (channel-strip anatomy) — `awaiting-approval`

**Date**: 2026-08-28 · **Delegation**: general-purpose subagent.

**Changed files** (exactly 2): `src/canvas.js` (additive: shared
familyInitials() helper — single source w/ palette — + data-family/
data-initials on cards), `styles/main.css` (cards + faders). param-
controls.js BYTE-IDENTICAL (value spans already had .param-value — mono
readout pure CSS).

**What shipped**: channel-strip cards — 3px family top edge (brief-pinned),
20px family legend chip via card ::before attr() (same vocabulary as
palette), silkscreen labels, physical-grip ⋮⋮ (padding hit area), remove ×
(1.5rem target, red-edge BORDER on hover, glyph stays text-primary — rq5
small-text rule), hover/chosen/drag/ghost states (family edge preserved
via border-top-color longhand; ghost hides legend), gated coherence,
agent-pulse hook (keyframe inside prefers-reduced-motion:no-preference —
inert until VIS-6 wires it), taught empty-hint (dashed line-strong target
zone, copy verbatim). Faders: 8px track w/ hairline detent gradient +
2px line-strong center detent (measuring-tool markings of the committed
world), 14×22 amber cap w/ ink position line, accent-hover on hover,
150ms transitions; label+value readout line (silkscreen + mono) above
full-width fader via order/flex only — semantics, steps, arrow keys,
wiring untouched.

**Validation**: /tmp/vis4-harness.js **84/84** (6 types + fallback CH;
structure/copy verbatim; FAMILY_INITIALS single-source; param-controls
byte-identical; CSS audit — zero new hex, pulse guarded, detents present,
red-edge never a text color); FULL regression zero adjustments: MC-4 64/64,
MC-5 39/39, MC-6 75/75, VIS-3 60/60. Master: node --check clean.

**Live check**: user's flagged Chrome — drag an EQ into the chain, watch
family edge + chip + faders; drag-reorder states; empty-hint.

**Commit/approval**: awaiting user approval.

---

## VIS-5 — MIC IN / OUT meter components — `awaiting-approval`

**Date**: 2026-08-28 · **Delegation**: general-purpose subagent.

**Changed files** (exactly 3): `src/meters.js` NEW (789 lines — contract
block, ballistics advance(), paint, dirty-check, build/init),
`index.html` (+script tag before main.js), `styles/main.css` (+68:
.meter-unit/.meter-canvas/.meter-readout + data-clip; tokens only).

**What shipped**: two lamp-bar meters inside the MIC IN / OUT anchors —
19-segment canvas bars in rq5 zone stops (green/amber/red), RMS underlay
(50% alpha, no glow), peak-hold tick, clip latch (red pin @0dB + dot +
'CLIP', 2 s auto-clear, re-triggerable), canvas-drawn mono dB scale
(−60/−40/−20/−6/0) guaranteed zone-aligned, live readout, lamp glow on
lit segments only (3px shadowBlur, dpr-scaled), silent-at-rest dark
render, role=meter + aria at ≤4 Hz, dpr-crisp backing. All ballistics
per rq4: attack ~instant, fall 12 dB/s, hold 1500 ms, RMS τ≈50 ms.
Dirty-check: zero repaints on identical feeds.

**Validation**: /tmp/vis5-harness.js **42/42** with fake clock +
recording canvas stub — full ballistics table (fall −18.95@0.5s vs −18
expected segment-res; hold exact; clip exact; RMS τ −21.05@50ms;
dirty-check 0/0; aria cadence 4/s; silence/engine-off/reset/defensive/
dpr all pass). Master: node --check clean.

**Deviations (accepted, documented)**: meter unit lives INSIDE each
.anchor (sibling would break the anchor→arrow flex rhythm + MC-4's
safe-output-note insertion point); scale labels canvas-drawn (zone
alignment guaranteed, same dirty-checked pass, no extra DOM).

**Notes carried**: FEW-3 contract — feed('in'|'out', {peakDb, rmsDb,
clipRun}) every frame incl. silence; setEngineState on start/teardown;
reset on device switch/context recreation (decay-to-rest per rq4);
tap points sourceNode + getChainGate(); watchdog may reuse OUT tap.
Meters never touch the graph. Reduced-motion: no CSS animation exists on
meters — functional by construction.

**Live check**: user's Chrome — meters visible at rest (dark), animate
after Start.

**Commit/approval**: awaiting user approval.

---

## FEW-3 — Meter wiring + runtime watchdog — `awaiting-approval`

**Date**: 2026-08-28 · **Delegation**: general-purpose subagent.

**Changed files** (4 — index.html tag was necessary; see deviations):
`src/meter-taps.js` NEW (~700 lines, window.MeterTaps, one-strike safe()
guard), `src/main.js` (+22 additive hook calls: start L209–216, device
switch L251–258; no stop path exists in the app — onEngineStopped wired+
tested for future), `styles/main.css` (.watchdog-alert block after
safe-output-note), `index.html` (script tag between meters.js and main.js).

**What shipped**: analyserIn off sourceNode (reconnect per device switch),
analyserOut off chainGate (connected exactly once per session — rebuild-
safe per rq4); ONE rAF loop feeding Meters both sides every frame
(reused Float32Array/Uint8Array; explicit −Infinity silence); watchdog
sharing analyserOut reads: peak > OUTPUT_CEILING_DBFS+0.5 sustained
>250 ms OR 1–8 kHz band monotonic rise ≥55/60 frames >1 s (floor −60 dB)
→ chainGate ramp-mute (0.02/3 τ), .watchdog-alert w/ human-only Restore
button (ramps to bypass-aware target), reportMutation source:'watchdog'
+ restore toast; latched (no auto-recover; buildGraph un-duck defeated
by rise-detection re-mute); thresholds derived from AudioGraph constant.

**Validation**: /tmp/few3-harness.js **59/59** (full matrix: 200ms no-trip
vs >250ms trip; howl rise/noise/flat; threshold follows stub constant;
trip side effects; restore; latch integrity incl. foreign gain rise;
no-restore-path grep; buffer identity; feed math); /tmp/few3-combined-
check.js **9/9** (real meters.js + meter-taps.js together). Regression:
MC-4 64/64, MC-5 39/39, MC-6 75/75, VIS-3 60/60, VIS-5 42/42, VIS-4
83/84 (the 1 = its frozen git-status snapshot vs uncommitted cycle-2
tree — false negative, all behavioral checks pass; documented). node
--check clean.

**Deviations (accepted, documented)**: 4th file (script tag — module
unreachable without it); analyserOut.smoothingTimeConstant=0 (howl
detector needs raw FFT energy; time-domain metering unaffected);
bypass-aware restore target; latched-mute defense vs rebuild un-duck.

**Live check (user's flagged Chrome)**: refresh → Start → speak into mic
→ BOTH meters breathe with voice; OUT sits ~6 dB under IN per the
attenuator. Watchdog live-trip is QA-2's deterministic job (stub recipe
in harness).

**Commit/approval**: awaiting user approval.

---

## VIS-2 — Topbar → status LCD strip — `awaiting-approval`

**Date**: 2026-08-28 · **Delegation**: general-purpose subagent.

**Changed files** (exactly 2): `index.html` (topbar restructure — UI-1/UI-2
comments replaced by VIS-2 comment honoring their contracts; zero id/class
removals; new wrappers + readout group with FEW-2-reserved ids
#readout-sample-rate/#readout-latency/#readout-node-count, labels
RATE/LATENCY/NODES, values '—'), `styles/main.css` (strip styling; all
23 src/*.js md5-verified byte-identical).

**What shipped**: 64px wrap-enabled panel strip — silkscreen title legend;
status lamp (stopped muted → .status.live amber dot, rq5 LIVE-owns-amber);
mono LCD readout slots (tabular-nums + min-width 7ch/6ch/3ch — '—'→
'48.0 kHz' never shifts geometry); Start as the one amber primary
(:not(:disabled)-scoped so post-start recedes); bypass DOMINANCE (3rem
target, 700 weight, split-role red, largest element on the strip);
<900px wrap keeps identity/controls/chip/bypass on row 1; z-order
preserved (toasts 20 > harness 15 > bar 10); 9 transitions all 150ms.

**Validation**: /tmp/vis2-harness.js **59/59** — every pre-existing
id/class exactly once; #status structure + h1 copy verbatim; bypass last
direct child; **real agent-ui.js chip insertion executed against the
restructured topbar** (lands before bypass, renders AGENT —); CSS audit
zero new hex, braces 157/157. Regression: mc4 64/64, mc5 39/39, mc6 75/75,
vis3 60/60, vis5 42/42, few3 59/59, vis4 83/84 (documented false-negative
git-snapshot diff — VIS-2 contributes zero delta).

**Live check**: user's Chrome — strip layout rest/live/engaged; narrow
window wrap keeps Bypass visible.

**Commit/approval**: awaiting user approval.

---

## FEW-2 — Status readout wiring — `awaiting-approval`

**Date**: 2026-08-28 · **Delegation**: general-purpose subagent.

**Changed files** (3): `src/status-readouts.js` NEW (150 lines,
window.StatusReadouts {onEngineStarted, refreshNow, stop} — MeterTaps
pattern + contract header), `src/main.js` (hook L219–231 after MeterTaps
call, context via window.AudioEngine.audioContext), `index.html` (script
tag — necessary 3rd file, FEW-3 precedent).

**What shipped**: RATE '<n>.toFixed(1) kHz'; LATENCY
(baseLatency+outputLatency)*1000 '.1f ms' (undefined parts→0; both→'—' +
one info); NODES 1 Hz idempotent interval from
ChainCanvas.getCurrentModel() (array — returns length directly); diff
guard vs live element (no DOM churn, self-heals external resets);
getElementById-per-write (1 Hz — survives topbar re-renders).

**Validation**: /tmp/few2-harness.js **41/41**; regression sweep identical
pre/post (mc4 64, mc5 39, mc6 75, vis3 60, vis4 83/84 known false-neg,
vis5 42, vis2 59, few3 59). node --check clean. Deviations disclosed:
script tag necessity; 150 lines (header+guards); vis2 snapshot refresh
per established practice (stale md5 list, not pristine).

**QA-4 note**: LATENCY is the context's self-reported estimate — distinct
from cycle-1's slow-mo measured ~12 ms.

**Live check**: user's Chrome — Start → '48.0 kHz' / latency ms / NODES
follows chain edits at 1 Hz.

**Commit/approval**: awaiting user approval.

---

## VIS-6 — Agent feedback polish — `awaiting-approval` — **M4 assembled on approval**

**Date**: 2026-08-28 · **Delegation**: general-purpose subagent (2 files:
styles/main.css FEW-1 block upgraded in place, canvas.js purely additive
pulse listener).

**What shipped**: agentui:mutation → .agent-pulse on affected cards
(metachar-safe id scan, dedupe, animationend + 600ms fallback for
reduced-motion, double-init expando guard); toasts in console vocabulary
(bg-card, line-strong bezel, mono micro-notes w/ hairline seams, error
toasts = 2px red-edge full bezel via :has() — NO border-left, no red
small text); undo button ink-on-amber + focus-ring-on-accent; chip
3-state (quiet unavailable / amber tools-ready w/ status square / acting
+ guarded 1.2s breathing); toast entrance 180ms guarded; exit instant by
FEW-1 construction (documented); animation inventory: 3 items, all inside
prefers-reduced-motion:no-preference; meters untouched.

**Validation**: /tmp/vis6-harness.js **80/80**; FEW-1's original JS
harness re-run passes (agent-ui.js hash-verified untouched); sweep green:
mc4 64, mc5 39, mc6 75, vis2 59*, vis3 60, vis4 83/1 (known false-neg),
vis5 42, few2 41, few3 59 — identical to pre-change baseline. Deviations
disclosed: exit-animation impossibility (FEW-1 synchronous removal);
vis2/vis4 snapshot-ratchet convention applied; :has() for error bezel
(Chrome-only app).

**Live check**: user's Chrome + ?dev — run set_param on a node → card
pulses amber, styled toast w/ amber Undo; fire a bad call → red-bezel
refusal toast; chip states across a tool run.

**Notes carried**: QA-4 reduced-motion spot-check steps scripted (subagent
report); POL-1 critique list (toast 3-stack density, error-bezel vs
watchdog-ring family consistency, note-seam rhythm).

**Commit/approval**: awaiting user approval.

---

## QA-2 — Adversarial tool matrix — `awaiting-approval` (one user step pending)

**Date**: 2026-08-28 · **Delegation**: general-purpose subagent + master
repair.

**Driver**: /tmp/qa2-matrix.js (vm sandboxes; real mcp-tools/agent-ui/
preset-schema/audio-graph/audio-bypass/meter-taps/mcp-harness; fake clock
+ canned analysers + write recorders). **Record**:
[qa/qa-2-adversarial-matrix.md](qa/qa-2-adversarial-matrix.md).

**Results**: **220/220 PASS** — A 126 (14 params × 9 attacks), B 22
(no prototype pollution), C 19 (100-node cap; 1MB param no-hang), D 5,
E 3 (50-call burst ≡ sequential replay, single-writer, no torn writes),
F 3 (drag queue/BUSY/post-settle snapshots), G 2 (cap/exhaustion), H 9
(watchdog trip/no-trip boundaries, mid-trip latch re-mute, bypass-during-
trip isolation, restore-under-bypass), I 10 (host-owned), J fuzz (seed
20260828: 500 calls, 0 violations, bit-identical rerun), K 20. Bypass +
attenuator writes across everything: **0**. Unhandled: **0**.

**Master repair**: unbounded chain.name (1MB into toast/undo labels)
→ now rejected >80 chars; re-verified mc4 64/64, mc5 39/39, qa2 220/220.

**Pending user (bundled with QA-1 Part B)**: real-browser
verifyAttenuatorOffline console step (expect ≈0.50, assert <0.6).

**Commit/approval**: awaiting user (with QA-1 batch).

---

## QA-4 — Accessibility verification (automated portion) — `awaiting-approval` (user checks bundled)

**Date**: 2026-08-28 · **Delegation**: general-purpose subagent (audit) +
master repairs (3 product fixes + tool ratchets).

**Record**: [qa/qa-4-accessibility.md](qa/qa-4-accessibility.md) · Tool:
/tmp/qa4-audit.js (parses main.css directly; throws on drift).

**Findings → fixed in product (master, same day)**:
- V1 (real, 1.4.3): CLIP readout text in meter-clip (4.01) → text-primary;
  red state stays on canvas pin/dot (triple redundancy).
- V2 (real, focus): ink focus rings on amber fills drew OUTSIDE the fill
  (1.14–1.27, keyboard focus invisible) → outline-offset −2px on all three
  sites (#start-button, toast Undo, control :active:focus-visible) — ring
  now on amber = 8.46.
- V3 (minor): chip 1px hover lift → guarded under no-preference.

**Final automated verdict: PASS** — text 79 pairs (70 PASS / 9 classified
exceptions: disabled/inert/UA/latent / 0 FAIL); boundaries 40/40 (39 +
N10 by-design split-role); reduced-motion 15/15 post-V3; keyboard/focus
8/8 (+1 documented cycle-1 carryover: drag is pointer-only — NOT a
regression); ARIA 19/19. CSS truth verified independently (brace balance,
guard containment analysis, offset placements).

**Tooling ratchets (dated, in-tmp)**: qa4 audit (C15 expectation, F5–F7
fixed-geometry model, N10/P6.7 classification overrides); vis4 guard
scanner → union-of-all-guard-blocks; vis2 src snapshot (path-format fix
+ QA-2 name-bound delta); vis6 file check → presence-based; vis4 git
baseline → current tree. **Board: 11 harnesses + qa2 matrix + qa4 audit,
zero failures.**

**Pending user (bundled with QA-1 batch)**: keyboard-only script,
reduced-motion DevTools emulation, ~2 m distance check.

**Commit/approval**: awaiting user (batch).

---

## VIS-7 — Vertical canvas + collapsible cards + density (2026-08-28 user-directed amendment) — `awaiting-approval`

**Delegation**: general-purpose subagent. **Files**: src/canvas.js +
styles/main.css ONLY (index.html byte-identical — DOM order already
encoded top-down; arrows rotated via CSS; param-controls.js md5-identical
— wrap-after-render kept the streak).

**What shipped**: top-down signal flow (MIC IN bar w/ meter → ↓ arrows →
full-width stacked cards → dashed empty slot → OUT bar w/ meter +
safe-output note; canvas scrolls internally, page never grows —
canvas-panel max-height calc(100vh−7.5rem)); collapsible cards (header:
grip/label + chevron aria-expanded + ×; params in .node-params wrapper;
grid-rows 1fr→0fr collapse + visibility for tab-order/a11y-tree exit;
180ms guarded, instant under reduce; collapsed ≈39px slim row w/ family
edge; session-only — rebuilds re-expand, documented+asserted); ~90%
density (paddings 6/12, 18px chip, 12×18 fader cap at the pinned 18px
floor, readouts 11.2px — text floors ≥11px enforced, AA pairs unchanged,
hit targets ≥24px). SortableJS vertical drag VERIFIED config-untouched
(no axis keys; detectDirection reads the column flex).

**Validation**: /tmp/vis7-harness.js **114/114**; board ALL GREEN — mc4
64, mc5 39, mc6 75, vis2 59, vis3 60, **vis4 92/92** (+8 new structure
assertions), vis5 42, few2 41, few3 59 + combined PASS, vis6 81,
qa2-matrix exit 0, **qa4 audit updated+PASS** (81 text pairs 72/9exc/0
FAIL; 41 boundaries 0 FAIL). Ratchets all dated: vis4 structure/size
pins, vis6 expected-fail 1→0 + additive→anchor-line check, vis2 src
snapshot refresh, qa4 map (chevron pairs/bezel/aria entries). Deviations:
index untouched (justified); chevron transition guarded; pre-existing
sub-11px prints on non-VIS-7 surfaces left to their owners (noted).

**Live check (user's Chrome)**: vertical flow + internal scroll; chevron
collapse/expand all 6 types; keyboard chevron; vertical grip drag; meters
at the two bars; long chain doesn't grow the page.

**Commit/approval**: awaiting user approval — then the browser batch
validates the FINAL surface.

---

## VIS-7b — Flow-direction toggle (2026-08-28 user direction, added at VIS-7 gate) — `awaiting-approval`

**Executed directly by master** (logged deviation per MC-0 precedent: task
smaller than delegation overhead). **Files**: src/canvas.js (initFlowToggle
~75 lines, guarded like the pulse block incl. the querySelector-undefined
case caught by the vis7 stub loader), styles/main.css (VIS-7b block).

**What shipped**: FLOW: VERTICAL / FLOW: HORIZONTAL toggle button (real
button, aria-pressed [vertical=pressed], aria-label, .control vocabulary,
mono micro-label) appended under the canvas; class flip .flow-horizontal
on the canvas panel scopes ALL orientation rules (canvas/chain-list row,
arrows upright, anchors back to compact stacked blocks w/ meters beneath,
cards content-width 13–19rem, panel un-bounds — faithful cycle-1
behavior); choice persisted under karaoke-flow-orientation-v1 (house key
naming, try/catch one-warn, garbage values fall back vertical); default
vertical. SortableJS needs nothing (detectDirection reads the flipped
flex-direction).

**Validation**: /tmp/vis7b-checks.js **30/30** (default/click cycles ×2
w/ persistence, stored-horizontal at load, garbage fallback, throwing
storage no-crash + visual flip still works, missing panel no-crash,
queryless-document guard, CSS scope audit: all 7 rules scoped, zero hex,
no keyframes, braces balanced). **Board ALL GREEN**: mc4 64, mc5 39, mc6
75, vis2 59, vis3 60, vis4 92, vis5 42, few2 41, few3 59, vis6 81,
vis7 114, qa2 exit 0, **qa4 audit 81+41 pairs 0 FAIL** (toggle inherits
.control's audited pair). One master fix during build: querySelector
guard added after the vis7 stub loader exposed the throw path.

**Live check (user's Chrome)**: toggle under the canvas flips flow and
survives reload (persisted); drag works in both modes; meters follow the
anchors.

**Commit/approval**: awaiting user approval.

---

## DOC-1 — README agent section + accuracy pass — `awaiting-approval`

**Date**: 2026-08-28 · **Delegation**: general-purpose subagent. **File**:
README.md only (33+/2−; safety/Python/event sections verbatim).

**What shipped**: new "🤖 Agent control (optional, experimental)" section
— plain-voice what-it-is, CAN/CANNOT lists (safety limits incl.
watchdog-human-restore), Chrome enable steps (flag → DevTools WebMCP pane
→ Inspector extension), the RQ-2/D2-mandated **honest Gemini status**
(does not consume WebMCP as of late Aug 2026 + re-check link), ?dev
harness mini-demo, toast/Undo/refusal explanation; manual-first framing
throughout. Accuracy pass: top-down flow + FLOW button (persisted),
chevron collapse keeps effect working, meters bullet, status-strip
sentence.

**Validation (subagent, grep-verified against records + code)**: flag
name / pane path / extension name / ?dev URL exact; tool count 8 matches
defs; zero registerMcpServer; Gemini sentence present + accurate; undo
shortcut/watchdog/limiter/ceiling claims traced to source lines; no
benchmark/user/Gemini-works claims. Master spot-check: README diff is the
only README change in the tree.

**Live check (user)**: read the section; walk the enable steps + ?dev
demo once — doubles as QA-3 prep.

**Commit/approval**: awaiting user approval.

---

## QA-1 / QA-2 / QA-4 + DOC-1 — user results (2026-08-28)

- **QA-1 PASS** (user, both flag modes — "everything passed"). Completed.
- **QA-2 PASS** (user console step: verifyAttenuatorOffline peak **0.476**
  ≈ −6.45 dBFS on the −1 dBFS square wave — limiter engaging under the
  −6 ceiling; assertion <0.6 met; under-nominal is the safe direction).
  Completed.
- **QA-4 PASS** (user, three browser checks — "everything looked good").
  Completed.
- **DOC-1 completed** (approved by progression — user moving to QA-3 on
  the README's instructions).
Remaining: QA-3 (live 5-prompt, user-judged) → POL-1.

---

## PS-4 — Factory preset library (2026-08-28 user-directed amendment 3) — `awaiting-approval`

**Delegation**: general-purpose subagent. **Files**: factory-presets.js
NEW (6 presets: Classic Karaoke verbatim + the QA-3 five byte-match),
presets-ui.js (Factory/Yours optgroups, namespaced values, factory
Load/Delete semantics, quiet .preset-note refusal), mcp-tools.js
(list_presets factory group + capabilities disclosure; save_preset
user-namespace), main.css (optgroup silkscreen), index.html (tag).
**preset-store.js byte-identical** (seam: runtime merge at presentation
surfaces; fresh profiles get the library with zero storage seeding).

**Validation**: /tmp/ps4-harness.js **66/66** (content fidelity incl.
byte-match vs qa3-driver CHAINS; factory Load via loadModel w/ zero
store calls; Delete refusal + store byte-unchanged; user flows intact;
Save-As collision creates user preset, factory untouched; degrade path
= PS-3 flat list; MCP grouping). **Full board green**: mc4 64, mc5 39,
mc6 75, vis2 59, vis3 60, vis4 92, vis5 42, vis6 81, few2 41, few3 59,
vis7 114, vis7b 30, qa2 220. Ratchets dated (vis2 src snapshot, vis4
git baseline, vis7 changed-set + index witness; mc5 needed NONE).
**Known intentional consequence**: on fresh profiles Classic Karaoke
appears in both groups (factory + PS-3's seeded user copy) — storage
behavior preserved by design. Master: syntax ×3 + README factory-library
sentence added (subagent's draft).

**Live check (user)**: fresh-dropdown grouping, load one factory preset,
try Delete on it (quiet note), save your own.

**Commit/approval**: awaiting user approval — then POL-1.
