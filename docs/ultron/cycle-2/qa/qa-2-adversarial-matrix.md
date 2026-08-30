# QA-2 — Adversarial Tool Matrix (Cycle 2)

Covers plan.md task QA-2 / town-hall success measure 2: via the MC-6
harness path, out-of-range params, unknown node types, malformed chains,
5-limiter stacks, rapid-fire concurrent calls, calls mid-drag, undo-stack
exhaustion, and watchdog triggers — every case must resolve a structured
error or a clamped valid result per the rq3 treatment, the audio graph
must stay valid, and the bypass path must never be affected.

- **Run date:** 2026-08-28 · **Driver harness:** `/tmp/qa2-matrix.js`
  (one driver, two vm-sandbox flavors; machine-readable dump
  `/tmp/qa2-results.json`, generated tables `/tmp/qa2-tables.md`)
- **Verdict: 220/220 cases PASS. Zero unhandled rejections/throws. Zero
  writes to the bypass dry path or the host output attenuator across the
  entire matrix. No real failures found** (three non-blocking
  observations recorded below, surfaced for a master decision).
- Scaffolding reused and credited from the prior harnesses:
  enforcement/stub architecture + policy matrix (`/tmp/mc4-harness.js`),
  undo/save/snapshot cases (`/tmp/mc5-harness.js`), fake-clock +
  deterministic watchdog triggers + recording AudioParams
  (`/tmp/few3-harness.js`), `McpHarness.run` hook + ?dev panel path
  (`/tmp/mc6-harness.js`).

## Scope & environment honesty

The matrix runs in **Node vm sandboxes** — the same standing this
project's acceptance harnesses have used since MC-4. What is REAL vs
stubbed:

**REAL source files under test**
- `src/mcp-tools.js` — the 8 tool defs, validators, rq3 enforcement
  engine, MC-5 snapshots/undo/save (the primary target).
- `src/agent-ui.js` — real toasts, real 20-cap undo stack, real
  `agentui:*` events, real chip/toast DOM skeletons.
- `src/preset-schema.js` — real serialize/deserialize (state-validity
  oracle).
- `src/mcp-harness.js` — real `?dev` panel + `McpHarness.run` (used for
  the concurrency batch and one read-attack case).
- Watchdog sandbox additionally: `src/audio-graph.js` (real
  buildGraph deferred rewire/un-duck, real attenuator creation/wiring),
  `src/audio-bypass.js` (real engage/disengage dry-path ramps),
  `src/meter-taps.js` (the real watchdog state machine).

**Stubs** (per the mc4/mc5 patterns): `ChainCanvas` (model + the single
`loadModel` write path + `isDragActive`), `PresetsUI`, `PresetStore`
(real PresetSchema, backing object instead of localStorage),
`AudioEngine`, `Meters`, and — in the watchdog sandbox — a fake
`AudioContext` whose Analysers serve canned float/byte arrays and whose
GainNodes carry recording AudioParams. A **fake clock**
(`performance.now`/`Date`/`setTimeout`/`setInterval`/rAF) makes the 5 s
drag queue and the ~1 s howl window deterministic. A throwing
`localStorage` proxy trap is installed everywhere (mc6 pattern): it was
never touched.

**What only a real browser can prove** (deferred to PENDING-USER below):
the attenuator's actual DSP behavior on a hot square wave
(`OfflineAudioContext` does not exist in Node — `verifyAttenuatorOffline()`
resolves `null` in vm and is skipped), watchdog behavior against real
acoustic input, WebMCP transport/registration, and real SortableJS drag
serialization (QA-1 Part B covers the live-drag path). Everything
asserted here is logic-level: the decision tables, state transitions,
write paths, and latch defenses.

**Per-case invariants (every one of the 220 cases):**
(i) result is a structured error object (`error:true` + `code` +
non-empty `reason`, runtime rejects additionally `applied:null`) or an
applied/clamped result exactly per the rq3 treatment table; (ii) no
unhandled rejection or throw (process-level counter, asserted per case,
each case additionally capped at 2 s wall-clock); (iii) post-case state
valid — `PresetSchema.serialize→deserialize` round-trips deep-equal, all
types registered, all param values finite numbers, rejects leave the
model byte-identical to the pre-case snapshot; (iv) bypass dry-path
`bypassGain` and the host output attenuator gain params receive **zero
writes** (every param write on those nodes lands in a global recorder
log; final count asserted 0 across the whole run). Chain-gate writes are
separately tracked: the tools never write the gate in the MAIN sandbox
(asserted per case); in the watchdog sandbox the gate is the watchdog's
own actuator and its writes are asserted per case where expected.

## Totals

| Group | Cases | Passed |
|---|---|---|
| A — per-param range attacks (14 params × 9 values) | 126 | 126 |
| B — type/string attacks + prototype pollution | 22 | 22 |
| C — malformed chains | 19 | 19 |
| D — structure attacks (limiter protection) | 5 | 5 |
| E — concurrency (50-call batches) | 3 | 3 |
| F — mid-drag serialization | 3 | 3 |
| G — undo exhaustion + undo during BUSY | 2 | 2 |
| H — watchdog matrix | 9 | 9 |
| I — host-owned probes | 10 | 10 |
| J — seeded fuzz (500 args, 8 tools) | 1 | 1 |
| K — read-tool attacks | 20 | 20 |
| **Total** | **220** | **220** |

## A — Per-param range attacks (A1–A126)

Every agent-facing param of all 6 types (the 14 the live
`get_capabilities` publishes) × 9 attack values
{min−1, max+1, NaN, +Infinity, −Infinity, `'5'`, null, 1e308, −1e308}
via `set_param`, against an in-policy one-of-each-type chain. Expected
behavior is derived from the published policy itself (min/max/treatment
read out of `get_capabilities`, never re-typed). Numbering: A1–A9
`gain.gainDb`, A10–A18 `compressor.threshold`, A19–A27 `ratio`, A28–A36
`attack`, A37–A45 `release`, A46–A54 `eq.lowGain`, A55–A63 `midGain`,
A64–A72 `highGain`, A73–A81 `delay.timeMs`, A82–A90 `feedback`,
A91–A99 `delay.mix`, A100–A108 `reverb.mix`, A109–A117
`limiter.ceiling`, A118–A126 `limiter.release`; columns in the attack
order above.

| param (agent range · treatment) | min−1 | max+1 | NaN | +Infinity | −Infinity | `'5'` string | null | 1e308 | −1e308 |
|---|---|---|---|---|---|---|---|---|---|
| `gain.gainDb` (−24…12 · reject) | reject ✓ | reject ✓ | INVALID_ARGS ✓ | INVALID_ARGS ✓ | INVALID_ARGS ✓ | INVALID_ARGS ✓ | INVALID_ARGS ✓ | reject ✓ | reject ✓ |
| `compressor.threshold` (−40…−8 · reject) | reject ✓ | reject ✓ | INVALID_ARGS ✓ | INVALID_ARGS ✓ | INVALID_ARGS ✓ | INVALID_ARGS ✓ | INVALID_ARGS ✓ | reject ✓ | reject ✓ |
| `compressor.ratio` (1.5…12 · clamp) | clamp→1.5 ✓ | clamp→12 ✓ | INVALID_ARGS ✓ | INVALID_ARGS ✓ | INVALID_ARGS ✓ | INVALID_ARGS ✓ | INVALID_ARGS ✓ | clamp→12 ✓ | clamp→1.5 ✓ |
| `compressor.attack` (0.001…0.1 · clamp) | clamp→0.001 ✓ | clamp→0.1 ✓ | INVALID_ARGS ✓ | INVALID_ARGS ✓ | INVALID_ARGS ✓ | INVALID_ARGS ✓ | INVALID_ARGS ✓ | clamp→0.1 ✓ | clamp→0.001 ✓ |
| `compressor.release` (0.02…0.5 · clamp) | clamp→0.02 ✓ | clamp→0.5 ✓ | INVALID_ARGS ✓ | INVALID_ARGS ✓ | INVALID_ARGS ✓ | INVALID_ARGS ✓ | INVALID_ARGS ✓ | clamp→0.5 ✓ | clamp→0.02 ✓ |
| `eq.lowGain` (−12…9 · reject) | reject ✓ | reject ✓ | INVALID_ARGS ✓ | INVALID_ARGS ✓ | INVALID_ARGS ✓ | INVALID_ARGS ✓ | INVALID_ARGS ✓ | reject ✓ | reject ✓ |
| `eq.midGain` (−12…9 · reject) | reject ✓ | reject ✓ | INVALID_ARGS ✓ | INVALID_ARGS ✓ | INVALID_ARGS ✓ | INVALID_ARGS ✓ | INVALID_ARGS ✓ | reject ✓ | reject ✓ |
| `eq.highGain` (−12…9 · reject) | reject ✓ | reject ✓ | INVALID_ARGS ✓ | INVALID_ARGS ✓ | INVALID_ARGS ✓ | INVALID_ARGS ✓ | INVALID_ARGS ✓ | reject ✓ | reject ✓ |
| `delay.timeMs` (20…750 · clamp) | clamp→20 ✓ | clamp→750 ✓ | INVALID_ARGS ✓ | INVALID_ARGS ✓ | INVALID_ARGS ✓ | INVALID_ARGS ✓ | INVALID_ARGS ✓ | clamp→750 ✓ | clamp→20 ✓ |
| `delay.feedback` (0…70 · reject) | reject ✓ | reject ✓ | INVALID_ARGS ✓ | INVALID_ARGS ✓ | INVALID_ARGS ✓ | INVALID_ARGS ✓ | INVALID_ARGS ✓ | reject ✓ | reject ✓ |
| `delay.mix` (0…100 · clamp) | clamp→0 ✓ | clamp→100 ✓ | INVALID_ARGS ✓ | INVALID_ARGS ✓ | INVALID_ARGS ✓ | INVALID_ARGS ✓ | INVALID_ARGS ✓ | clamp→100 ✓ | clamp→0 ✓ |
| `reverb.mix` (0…100 · clamp) | clamp→0 ✓ | clamp→100 ✓ | INVALID_ARGS ✓ | INVALID_ARGS ✓ | INVALID_ARGS ✓ | INVALID_ARGS ✓ | INVALID_ARGS ✓ | clamp→100 ✓ | clamp→0 ✓ |
| `limiter.ceiling` (−12…−3 · reject) | reject ✓ | reject ✓ | INVALID_ARGS ✓ | INVALID_ARGS ✓ | INVALID_ARGS ✓ | INVALID_ARGS ✓ | INVALID_ARGS ✓ | reject ✓ | reject ✓ |
| `limiter.release` (50…300 · clamp) | clamp→50 ✓ | clamp→300 ✓ | INVALID_ARGS ✓ | INVALID_ARGS ✓ | INVALID_ARGS ✓ | INVALID_ARGS ✓ | INVALID_ARGS ✓ | clamp→300 ✓ | clamp→50 ✓ |

Reading: `reject` = `PARAM_OUT_OF_RANGE` with `allowed {min,max,unit}`
inline and the model byte-identical; `clamp→X` = `applied:true` with a
`clamped[]` entry and X landed in the model; `INVALID_ARGS` =
`INVALID_ARGUMENTS` (non-finite / non-number values are refused
structurally before policy). 1e308/−1e308 are finite doubles, so they
take the policy path (reject or clamp), NOT the structural path — both
behaviors verified per treatment.

## B — Type/string attacks (B1–B22)

All 11 type values × both `add_node` and `set_chain` (as
`nodes[0].type`). No case throws; every one resolves
`INVALID_ARGUMENTS` with the problem path; unknown-but-string types
carry the allowed list `["gain","compressor","eq","delay","reverb","limiter"]`
verbatim. `Object.prototype` / `Array.prototype` / `String.prototype`
own-property snapshots and the sandbox global key set are compared
before/after every case — **no prototype pollution from any input,
including `__proto__`, `constructor`, `toString`**.

| # | input | expected | actual | verdict |
|---|-------|----------|--------|---------|
| B1 | `add_node {type:"flanger"}` | INVALID_ARGUMENTS + allowed list (unknown string types); no prototype mutation | `INVALID_ARGUMENTS (type)` | PASS |
| B2 | `set_chain nodes[0].type="flanger"` | INVALID_ARGUMENTS + allowed list (unknown string types); no prototype mutation | `INVALID_ARGUMENTS (chain.nodes[0].type)` | PASS |
| B3 | `add_node {type:""}` | INVALID_ARGUMENTS + allowed list (unknown string types); no prototype mutation | `INVALID_ARGUMENTS (type)` | PASS |
| B4 | `set_chain nodes[0].type=""` | INVALID_ARGUMENTS + allowed list (unknown string types); no prototype mutation | `INVALID_ARGUMENTS (chain.nodes[0].type)` | PASS |
| B5 | `add_node {type:"GAIN"}` | INVALID_ARGUMENTS + allowed list (unknown string types); no prototype mutation | `INVALID_ARGUMENTS (type)` | PASS |
| B6 | `set_chain nodes[0].type="GAIN"` | INVALID_ARGUMENTS + allowed list (unknown string types); no prototype mutation | `INVALID_ARGUMENTS (chain.nodes[0].type)` | PASS |
| B7 | `add_node {type:"gain "}` | INVALID_ARGUMENTS + allowed list (unknown string types); no prototype mutation | `INVALID_ARGUMENTS (type)` | PASS |
| B8 | `set_chain nodes[0].type="gain "` | INVALID_ARGUMENTS + allowed list (unknown string types); no prototype mutation | `INVALID_ARGUMENTS (chain.nodes[0].type)` | PASS |
| B9 | `add_node {type:"gain\u0000"}` | INVALID_ARGUMENTS + allowed list (unknown string types); no prototype mutation | `INVALID_ARGUMENTS (type)` | PASS |
| B10 | `set_chain nodes[0].type="gain\u0000"` | INVALID_ARGUMENTS + allowed list (unknown string types); no prototype mutation | `INVALID_ARGUMENTS (chain.nodes[0].type)` | PASS |
| B11 | `add_node {type:"__proto__"}` | INVALID_ARGUMENTS + allowed list (unknown string types); no prototype mutation | `INVALID_ARGUMENTS (type)` | PASS |
| B12 | `set_chain nodes[0].type="__proto__"` | INVALID_ARGUMENTS + allowed list (unknown string types); no prototype mutation | `INVALID_ARGUMENTS (chain.nodes[0].type)` | PASS |
| B13 | `add_node {type:"constructor"}` | INVALID_ARGUMENTS + allowed list (unknown string types); no prototype mutation | `INVALID_ARGUMENTS (type)` | PASS |
| B14 | `set_chain nodes[0].type="constructor"` | INVALID_ARGUMENTS + allowed list (unknown string types); no prototype mutation | `INVALID_ARGUMENTS (chain.nodes[0].type)` | PASS |
| B15 | `add_node {type:"toString"}` | INVALID_ARGUMENTS + allowed list (unknown string types); no prototype mutation | `INVALID_ARGUMENTS (type)` | PASS |
| B16 | `set_chain nodes[0].type="toString"` | INVALID_ARGUMENTS + allowed list (unknown string types); no prototype mutation | `INVALID_ARGUMENTS (chain.nodes[0].type)` | PASS |
| B17 | `add_node {type:7}` | INVALID_ARGUMENTS + allowed list (unknown string types); no prototype mutation | `INVALID_ARGUMENTS (type)` | PASS |
| B18 | `set_chain nodes[0].type=7` | INVALID_ARGUMENTS + allowed list (unknown string types); no prototype mutation | `INVALID_ARGUMENTS (chain.nodes[0].type)` | PASS |
| B19 | `add_node {type:null}` | INVALID_ARGUMENTS + allowed list (unknown string types); no prototype mutation | `INVALID_ARGUMENTS (type)` | PASS |
| B20 | `set_chain nodes[0].type=null` | INVALID_ARGUMENTS + allowed list (unknown string types); no prototype mutation | `INVALID_ARGUMENTS (chain.nodes[0].type)` | PASS |
| B21 | `add_node {type:["gain"]}` | INVALID_ARGUMENTS + allowed list (unknown string types); no prototype mutation | `INVALID_ARGUMENTS (type)` | PASS |
| B22 | `set_chain nodes[0].type=["gain"]` | INVALID_ARGUMENTS + allowed list (unknown string types); no prototype mutation | `INVALID_ARGUMENTS (chain.nodes[0].type)` | PASS |

## C — Malformed chains via set_chain (C1–C19)

| # | input | expected | actual | verdict |
|---|-------|----------|--------|---------|
| C1 | `set_chain chain: 42 (number)` | INVALID_ARGUMENTS | `INVALID_ARGUMENTS (chain)` | PASS |
| C2 | `set_chain chain: "nope" (string)` | INVALID_ARGUMENTS | `INVALID_ARGUMENTS (chain)` | PASS |
| C3 | `set_chain chain: null` | INVALID_ARGUMENTS | `INVALID_ARGUMENTS (chain)` | PASS |
| C4 | `set_chain chain missing entirely` | INVALID_ARGUMENTS | `INVALID_ARGUMENTS (chain)` | PASS |
| C5 | `set_chain chain.nodes: "no" (string)` | INVALID_ARGUMENTS | `INVALID_ARGUMENTS (chain.nodes)` | PASS |
| C6 | `set_chain chain.nodes: {} (non-array object)` | INVALID_ARGUMENTS | `INVALID_ARGUMENTS (chain.nodes)` | PASS |
| C7 | `set_chain chain.nodes: null` | INVALID_ARGUMENTS | `INVALID_ARGUMENTS (chain.nodes)` | PASS |
| C8 | `set_chain duplicate ids` | INVALID_ARGUMENTS | `INVALID_ARGUMENTS (chain.nodes[1].id)` | PASS |
| C9 | `set_chain 100-node array` | node-count-cap (100 > 16) | `node-count-cap` | PASS |
| C10 | `set_chain missing schemaVersion` | INVALID_ARGUMENTS | `INVALID_ARGUMENTS (chain.schemaVersion)` | PASS |
| C11 | `set_chain schemaVersion: "1" (string)` | INVALID_ARGUMENTS | `INVALID_ARGUMENTS (chain.schemaVersion)` | PASS |
| C12 | `set_chain name: 42` | INVALID_ARGUMENTS | `INVALID_ARGUMENTS (chain.name)` | PASS |
| C13 | `set_chain name: ""` | INVALID_ARGUMENTS | `INVALID_ARGUMENTS (chain.name)` | PASS |
| C14 | `set_chain name: []` | INVALID_ARGUMENTS | `INVALID_ARGUMENTS (chain.name)` | PASS |
| C15 | `set_chain params: [] (array)` | INVALID_ARGUMENTS | `INVALID_ARGUMENTS (chain.nodes[0].params)` | PASS |
| C16 | `set_chain params: "x" (string)` | INVALID_ARGUMENTS | `INVALID_ARGUMENTS (chain.nodes[0].params)` | PASS |
| C17 | `set_chain deep-nested object as param value` | INVALID_ARGUMENTS | `INVALID_ARGUMENTS (chain.nodes[0].params.gainDb)` | PASS |
| C18 | `set_chain 1MB string param value` | INVALID_ARGUMENTS, no hang (≤2s) | `INVALID_ARGUMENTS (chain.nodes[0].params.gainDb)` | PASS |
| C19 | `set_chain 1MB chain name (observation)` | observation: structured error OR applied (no rule bounds set_chain names) — recorded | `applied (name length 1000000)` | PASS |

C9's 100-node array passes structural validation and is rejected by the
**policy** engine (`node-count-cap`, count 100 / limit 16, nothing
applied) — exactly the rq3 cap, not a crash or a hang. C18's 1 MB param
value is refused with a truncated, path-qualified problem in well under
the 2 s cap. C19 is recorded as an **observation** (see Findings).

## D — Structure attacks (D1–D5)

| # | input | expected | actual | verdict |
|---|-------|----------|--------|---------|
| D1 | `set_chain with 5 limiter nodes (cap: ≤2 compressor-type)` | structured chain-rule reject, state unchanged | `limiter-required-terminal (applied:null)` | PASS |
| D2 | `set_chain limiter at HEAD (non-terminal): [lim, gain, lim]` | limiter-required-terminal | `limiter-required-terminal (position 0)` | PASS |
| D3 | `remove_node the only limiter` | limiter-required-terminal (SAFETY LIMITER reason), state unchanged | `limiter-required-terminal (hard reject)` | PASS |
| D4 | `set_chain that de-terminalizes the limiter` | limiter-required-terminal | `limiter-required-terminal (limiter at position 0)` | PASS |
| D5 | `add_node (no position → append) behind terminal limiter` | limiter-required-terminal + "AFTER the terminal limiter" reason | `limiter-required-terminal (append blocked)` | PASS |

The 5-limiter stack (D1) is caught by `limiter-required-terminal`
(duplicate non-terminal limiters are enumerated before the
compressor-count rule in the engine's evaluation order); both are
published rules, the error is structured, and nothing is applied.

## E — Concurrency (E1–E3)

| # | input | expected | actual | verdict |
|---|-------|----------|--------|---------|
| E1 | `50 mixed valid/invalid execute() fired in ONE macrotask (defs-direct)` | all settle; zero unhandled/rejected; error shapes or applied; single-writer; final == last applied; undo ≤ 20 | `21 applied / 29 structured errors; 20 sequential writes; final == last write` | PASS |
| E2 | `same 50 calls replayed SEQUENTIALLY (fresh env)` | identical per-call outcomes + identical final model + identical apply count | `50/50 outcomes + final model identical to concurrent run` | PASS |
| E3 | `same 50 concurrent calls via window.McpHarness.run (?dev panel path)` | identical outcomes + final model; panel survives | `McpHarness.run: 50 settled, outcomes + final model identical` | PASS |

**Concurrency findings:** all 50 calls (set_param / add_node /
remove_node / set_chain / save_preset / reads, valid and invalid
interleaved) settle via `Promise.allSettled` with zero rejections and
zero process-level unhandled rejections. The single-writer invariant
holds under load: `ChainCanvas.loadModel` call boundaries are recorded
and **never nest** (apply depth stays 1; each mutation's plan→write→
snapshot→toast completes before the next begins — microtask ordering
makes the apply order equal the call order, deterministically). The
final model equals the LAST recorded write exactly (no torn/interleaved
writes), the write count equals the applied-mutation count (21 applied
mutations; save_preset writes via PresetStore, not loadModel), and the
undo stack depth equals the applied count within the 20 cap. A sequential
replay of the identical batch produces byte-identical per-call outcome
codes and an identical final model — the concurrent execution is
indistinguishable from serialized execution. The same batch through the
MC-6 `?dev` panel path (`McpHarness.run`) behaves identically.

## F — Mid-drag serialization (F1–F3)

| # | input | expected | actual | verdict |
|---|-------|----------|--------|---------|
| F1 | `isDragActive=true; 2 mutations fired; drag ends 200 ms later` | both queue (pending), then apply IN ORDER after settle; exactly one write each | `queued → applied in order (2 then 4), 2 writes, undo depth 2` | PASS |
| F2 | `drag held >5 s (fake clock pumped 5.1 s)` | BUSY {queuedMs:5000, retry:true}; nothing applied; no undo | `BUSY after 5 s queue bound; zero writes` | PASS |
| F3 | `queued mutation snapshots POST-SETTLE state (drag commits a different value mid-queue)` | undo restores the post-drag pre-mutation value, not the pre-drag one | `snapshot taken post-settle; undo → 1.5 (post-drag state)` | PASS |

Verified on a fake clock (the 50 ms poll interval and the 5 s deadline
are fake-time driven, so the BUSY path runs deterministically without
wall-clock waiting).

## G — Undo exhaustion + undo during BUSY (G1–G2)

| # | input | expected | actual | verdict |
|---|-------|----------|--------|---------|
| G1 | `25 applied mutations → undo stack; then 30 undo() calls` | stack capped at 20; exactly 20 successful undos then null x10; no errors; final model coherent (== state after 5th apply) | `cap 20; 20 undos + 10 nulls; final timeMs=170 (== apply #5)` | PASS |
| G2 | `undo() called while another mutation sits in the BUSY drag queue` | defined: undo acts on the stack independently (pops the PREVIOUS entry); queued mutation still applies after settle; each undo restores its own pre-state | `undo independent of queue; queued apply + undo both correct` | PASS |

**Documented behavior for undo-during-BUSY-queue (G2):** undo acts on
the committed stack only. A mutation sitting in the drag queue has
applied nothing and pushed nothing, so `AgentUI.undo()` pops the
PREVIOUS entry and restores its pre-state; when the drag settles the
queued mutation plans against the post-undo model (correct: its plan and
snapshot are computed post-settle by design, OQ-7/MC-5), applies on top,
and pushes its own undo entry, whose restore returns to the post-undo
state. No ordering hazard exists because the queued mutation cannot
interleave with the undo (single-writer path).

## H — Watchdog matrix (H1–H9)

Fake clock + canned analysers (few3 recipes) over the REAL
`meter-taps.js`, with the REAL `audio-graph.js` rebuild (deferred
rewire + un-duck) and REAL `audio-bypass.js` dry path in the same
sandbox.

| # | input | expected | actual | verdict |
|---|-------|----------|--------|---------|
| H1 | `peak trip: OUT at −5 dBFS (> −6+0.5) sustained 300 ms` | trip: chainGate setTargetAtTime(0) once (~20 ms ramp); alert + Restore button; reportMutation {source:"watchdog"}; attenuator + dry path ZERO writes | `tripped at ~283 ms: gate muted (setTarget 0), alert + button, watchdog event, dry/attenuator untouched` | PASS |
| H2 | `peak at −5 dBFS for 240 ms only (< the >250 ms sustain)` | NO trip (no mute, no alert, no event) | `no trip at 240 ms (sustain requirement holds)` | PASS |
| H3 | `howl rule: 1–8 kHz band rising monotonically ~1 s (peak quiet)` | trip via the howl rule (event names it); gate muted | `howl trip: Watchdog tripped — output muted (howling feedback (1–8 kHz rise))` | PASS |
| H4 | `flat loud band (no rise) for 1.5 s` | NO trip | `flat band: no trip` | PASS |
| H5 | `deterministic noise in the band (LCG) for 1.5 s` | NO trip (rising steps far below 55) | `band noise: no trip` | PASS |
| H6 | `restore (human button): click Restore output after a peak trip` | gate ramped back to 1 (~50 ms ramp); alert removed; second toast "Output restored by operator"; quiet after: no further writes | `restore: ramp→1, alert gone, operator toast, state reset` | PASS |
| H7 | `DURING trip: valid set_chain (chain editable) while output muted; buildGraph un-ducks the gate` | set_chain applies; the completed un-duck (gain.value→1) is RE-MUTED by the latch defense; attenuator + dry path zero writes | `set_chain applied while muted; un-duck re-muted by the latch` | PASS |
| H8 | `DURING trip: human bypass engage/disengage (dry path live)` | engage works; dry-path bypassGain receives ONLY the human ramp writes; watchdog never writes the dry path; gate re-mute still holds | `bypass usable during trip; dry path isolated from the watchdog` | PASS |
| H9 | `restore while bypass ENGAGED` | restore ramps the gate to 0 (mirrors buildGraph — never un-mutes under an engaged bypass) | `restore-under-bypass targets gate 0 (correct steady state)` | PASS |

Watchdog details verified: the mute is `chainGate`-only
(`setTargetAtTime(0, now, 20ms/3)` preceded by cancel+pin), the alert is
a real `.watchdog-alert` with `OUTPUT MUTED — <reason>` text and a real
`Restore output` button, the agent-visible event is
`{source:"watchdog", summary:"Watchdog tripped — …", nodeIds:[]}`, the
trip latches (idempotent — the mid-trip edit in H7 produces no second
watchdog event), restore ramps to 1 over ~50 ms/3 and emits the
operator toast, and restore-under-engaged-bypass correctly targets gate
0. In H7 the latch defense was exercised against the REAL buildGraph
un-duck: after `set_chain` applied mid-trip and the rebuild's un-duck
ramp completed (observed gate gain rising to 1), the watchdog re-applied
the 0-ramp on the next frames — the chain stays editable but the output
stays muted until the human restores. In H8 the dry-path `bypassGain`
saw exactly the human's engage/disengage writes (3 param calls each:
cancel+pin+ramp) and nothing from the watchdog; the attenuator saw zero
writes in every case.

## I — Host-owned probes (I1–I10)

| # | input | expected | actual | verdict |
|---|-------|----------|--------|---------|
| I1 | `set_param nodeId "output-attenuator"` | HOST_OWNED / host-output-attenuator | `HOST_OWNED (host-output-attenuator)` | PASS |
| I2 | `set_param nodeId "attenuator"` | HOST_OWNED / host-output-attenuator | `HOST_OWNED (host-output-attenuator)` | PASS |
| I3 | `set_param nodeId "__host" (no such node)` | NODE_NOT_FOUND + validIds | `NODE_NOT_FOUND` | PASS |
| I4 | `set_chain reverb params {normalize:false}` | HOST_OWNED / host-reverb-internals | `HOST_OWNED (host-reverb-internals)` | PASS |
| I5 | `set_chain reverb params {buffer:"x"}` | HOST_OWNED / host-reverb-internals | `HOST_OWNED (host-reverb-internals)` | PASS |
| I6 | `set_chain reverb params {ir:"x"} (not a known/host name)` | INVALID_ARGUMENTS (unknown param, allowed list) | `INVALID_ARGUMENTS` | PASS |
| I7 | `set_param limiter ratio 5` | HOST_OWNED / host-limiter-locks | `HOST_OWNED (host-limiter-locks)` | PASS |
| I8 | `set_param limiter attack 0.002` | HOST_OWNED / host-limiter-locks | `HOST_OWNED (host-limiter-locks)` | PASS |
| I9 | `set_chain limiter params {knee:6}` | HOST_OWNED / host-limiter-locks | `HOST_OWNED (host-limiter-locks)` | PASS |
| I10 | `remove_node "safe-output"` | HOST_OWNED / host-output-attenuator | `HOST_OWNED (host-output-attenuator)` | PASS |

Attenuator-name guesses (including `remove_node "safe-output"`) resolve
the structured HOST_OWNED error naming `host-output-attenuator`; unknown
host-ish ids like `__host` resolve NODE_NOT_FOUND with `validIds`
inline; reverb IR/normalize/buffer and limiter ratio/attack/knee are
refused as host-owned. No state changed in any case.

## J — Seeded fuzz (J1)

**PRNG seed: `20260828`** (mulberry32; generator + call list fully
deterministic — rerunning `node /tmp/qa2-matrix.js` reproduces the sweep
bit-for-bit).

| # | input | expected | actual | verdict |
|---|-------|----------|--------|---------|
| J1 | `500 seeded random JSON args (seed 20260828) across all 8 tools — nested/array/number-string/unicode/≤10 KB strings, ~12% plausibly-valid` | no throw/rejection; every result a structured error (error:true+code+reason) or a valid application; state valid after sweep; no prototype pollution | `500/500 clean — 54 applied, 331 structured errors, 115 read payloads; 0 pollution; 0 dry writes` | PASS |

Shapes drawn per call: nested objects/arrays to depth 4, numbers
(int/small/float/huge/±1e308), numbers-as-strings, NaN/±Infinity,
booleans, null, unicode and NUL strings, key names biased to the tools'
real envelope keys **plus** `__proto__`/`constructor`/`toString`, and
long strings up to 10 KB; ~12% of calls are plausibly-valid agent calls.
Per-tool outcome mix (calls → applied / structured errors / read
payloads):

| tool | calls | applied | errors | reads |
|---|---|---|---|---|
| set_param | 95 | 27 | 68 | 0 |
| remove_node | 61 | 7 | 54 | 0 |
| save_preset | 61 | 4 | 57 | 0 |
| add_node | 52 | 7 | 45 | 0 |
| list_presets | 68 | 0 | 22 | 46 |
| get_capabilities | 46 | 0 | 14 | 32 |
| set_chain | 54 | 9 | 45 | 0 |
| get_chain | 63 | 0 | 26 | 37 |

Every applied result left a serialize-round-trip-valid model; every
error carried `error:true` + `code` + `problems[]` (for
INVALID_ARGUMENTS) — zero shape violations, zero throws, zero prototype
mutations, zero dry-path/attenuator writes.

## K — Read-tool attacks (K1–K20)

| # | input | expected | actual | verdict |
|---|-------|----------|--------|---------|
| K1 | `get_chain(array)` | INVALID_ARGUMENTS; no throw, no state effect | `INVALID_ARGUMENTS ((input) must be an object)` | PASS |
| K2 | `get_chain(giant string (10 KB))` | INVALID_ARGUMENTS; no throw, no state effect | `INVALID_ARGUMENTS ((input) must be an object)` | PASS |
| K3 | `get_chain(number)` | INVALID_ARGUMENTS; no throw, no state effect | `INVALID_ARGUMENTS ((input) must be an object)` | PASS |
| K4 | `get_chain(boolean)` | INVALID_ARGUMENTS; no throw, no state effect | `INVALID_ARGUMENTS ((input) must be an object)` | PASS |
| K5 | `get_chain(null)` | payload (documented: null normalizes to {} like an omitted input); no throw, no state effect | `read payload returned` | PASS |
| K6 | `get_chain(NaN)` | INVALID_ARGUMENTS; no throw, no state effect | `INVALID_ARGUMENTS ((input) must be an object)` | PASS |
| K7 | `list_presets(array)` | INVALID_ARGUMENTS; no throw, no state effect | `INVALID_ARGUMENTS ((input) must be an object)` | PASS |
| K8 | `list_presets(giant string (10 KB))` | INVALID_ARGUMENTS; no throw, no state effect | `INVALID_ARGUMENTS ((input) must be an object)` | PASS |
| K9 | `list_presets(number)` | INVALID_ARGUMENTS; no throw, no state effect | `INVALID_ARGUMENTS ((input) must be an object)` | PASS |
| K10 | `list_presets(boolean)` | INVALID_ARGUMENTS; no throw, no state effect | `INVALID_ARGUMENTS ((input) must be an object)` | PASS |
| K11 | `list_presets(null)` | payload (documented: null normalizes to {} like an omitted input); no throw, no state effect | `read payload returned` | PASS |
| K12 | `list_presets(NaN)` | INVALID_ARGUMENTS; no throw, no state effect | `INVALID_ARGUMENTS ((input) must be an object)` | PASS |
| K13 | `get_capabilities(array)` | INVALID_ARGUMENTS; no throw, no state effect | `INVALID_ARGUMENTS ((input) must be an object)` | PASS |
| K14 | `get_capabilities(giant string (10 KB))` | INVALID_ARGUMENTS; no throw, no state effect | `INVALID_ARGUMENTS ((input) must be an object)` | PASS |
| K15 | `get_capabilities(number)` | INVALID_ARGUMENTS; no throw, no state effect | `INVALID_ARGUMENTS ((input) must be an object)` | PASS |
| K16 | `get_capabilities(boolean)` | INVALID_ARGUMENTS; no throw, no state effect | `INVALID_ARGUMENTS ((input) must be an object)` | PASS |
| K17 | `get_capabilities(null)` | payload (documented: null normalizes to {} like an omitted input); no throw, no state effect | `read payload returned` | PASS |
| K18 | `get_capabilities(NaN)` | INVALID_ARGUMENTS; no throw, no state effect | `INVALID_ARGUMENTS ((input) must be an object)` | PASS |
| K19 | `read tools with {} and with tolerated extra envelope keys ({evil:…})` | {} → full payload; extra keys tolerated (JSON-Schema default) and IGNORED — no throw, payload intact | `objects → payloads (extra keys ignored per the documented envelope tolerance)` | PASS |
| K20 | `get_chain("hostile") via window.McpHarness.run (?dev panel path)` | panel Run path returns the same INVALID_ARGUMENTS result, no throw | `McpHarness.run: INVALID_ARGUMENTS rendered + resolved` | PASS |

## Bypass / attenuator zero-write summary

Every AudioParam on the bypass dry-path `bypassGain` and the host output
attenuator was a recording proxy whose every method call
(cancel/setValue/setTarget/linearRamp) appended to a single global log
 spanning all 220 cases, all environments (MAIN and watchdog), including
the 500-call fuzz sweep. **Final log length: 0.** The only writes the
dry path ever received were the HUMAN toggles deliberately issued in H8
(exactly 3 param calls per toggle, asserted), and the attenuator was
never written by anything — including the watchdog (its emergency action
is the chain gate it owns) and the real buildGraph rebuilds in the
watchdog sandbox. The bypass path is unreachable from the agent surface,
as rq3 requires.

## Findings (non-blocking, surfaced for a master decision)

No case failed. Three behaviors were observed that no acceptance
criterion bounds; recorded here rather than fixed:

1. **C19 — `set_chain` accepts an unbounded `chain.name`.** A 1 MB name
   passes structural validation (non-empty string is the only rule) and
   APPLIES; the name lands in the success summary toast, the undo label,
   and (indirectly) preset display paths. No crash, no hang (case ran
   well under the 2 s cap), no policy breach — `save_preset` correctly
   bounds names at 1–40 trimmed chars, but `set_chain`'s display label
   has no length rule. Same class: unbounded node ids. Options for a
   master: leave as-is (agents are cooperative; the MC-2 schema could
   add maxLength), or add a modest cap (e.g. 120 chars) in a follow-up.
2. **`null` input is tolerated as "no arguments"** (`checkInputObject`
   normalizes `undefined` OR `null` to `{}`) — read tools return their
   payload for `null` rather than INVALID_ARGUMENTS. This is a
   deliberate, documented-in-code tolerance (K5/K11/K17 record it as
   such); arrays/strings/numbers/booleans/NaN all reject.
3. **Extra top-level envelope keys are ignored** for every tool
   (JSON-Schema default; the asymmetry vs. strict `params` key checking
   is intentional per the MC-2 contract). K19 records the behavior.

## Conclusions

- The rq3 reject/clamp treatment table is enforced exactly as published
  by `get_capabilities` for every agent-facing param under every attack
  value class (A1–A126), including the finite-but-huge 1e308 values that
  bypass structural validation and land in the policy engine.
- Structural validation refuses malformed chains with path-qualified
  problems and allowed lists, never throws, never hangs on 1 MB inputs,
  and cannot be prototype-polluted (B, C, J).
- Chain-structure protections hold: limiter required-terminal/removal/
  de-terminalization/append, node-count cap 16, compressor-type cap,
  duplicate ids (C8–C9, D1–D5).
- 50-call concurrent bursts are equivalent to serialized execution:
  single-writer, no torn writes, coherent final state, bounded undo (E).
- Drag serialization (queue → in-order apply; 5 s BUSY bound;
  post-settle snapshots) behaves per OQ-7 on a deterministic clock (F).
- Undo is bounded at 20, exhausts to `null` without errors, and is
  well-defined during a BUSY queue (G).
- The runtime watchdog trips exactly on its two rules (peak > ceiling
  +0.5 dB sustained >250 ms; ~1 s monotonic 1–8 kHz rise), latches
  against buildGraph un-ducks, never touches the dry path or the
  attenuator, and restores only via the human button — including the
  engaged-bypass steady state (H).
- Host-owned surfaces (output attenuator, reverb internals, limiter
  locks) are structurally unreachable (I).
- 500-call seeded fuzz across all 8 tools: zero shape violations, zero
  throws, zero pollution, zero safety-path writes (J).

Automated QA-2 is complete pending the one real-browser step below.

## PENDING-USER — real-browser step (the only thing vm cannot prove)

**P-1 (required): attenuator offline verification.** In Chrome at
`http://localhost:8000` (engine page loaded), press **Start**, then in
the DevTools console run:

```js
AudioGraph.verifyAttenuatorOffline().then(p => console.log('peak', p))
```

- Expected: `peak ≈ 0.50` (the −6 dBFS attenuator, 0.5012 linear) plus a
  few percent of limiter overshoot from the −1 dBFS square-wave test
  input.
- **Assert: `peak < 0.6`** (−4.4 dBFS — inside rq3's absolute
  never-exceed −3 dBFS headroom). Record the number here:
  - [ ] P-1 peak = ______ (< 0.6) — initials/date ______

**P-2 (optional, informational): live watchdog sanity.** With the engine
live and a normal speaking/singing voice near the mic, the watchdog must
NOT trip (normal levels sit far below −5.5 dBFS post-attenuator). No
assertion — just confirm no `OUTPUT MUTED` alert appears during a
minute of normal use. - [ ] P-2 observed no false trip — initials/date ______

---

## Post-run repair (2026-08-28, master)

Observation #1 (unbounded `chain.name`) was **fixed rather than noted**:
`set_chain` validation now rejects names > 80 chars with a structured
`INVALID_ARGUMENTS` problem (src/mcp-tools.js, QA-2 comment at the rule).
Re-verified: node --check clean; mc4 64/64; mc5 39/39; **qa2-matrix
re-run 220/220**. Observations #2 (null-as-no-args) and #3 (extra keys
ignored) accepted as documented design.

## Verdict

**PASS (pending the single real-browser step in PENDING-USER)** —
220/220 adversarial cases structured-error-or-clamped-valid; audio graph
valid throughout; bypass dry path + attenuator: zero writes across every
case including watchdog trips and mid-trip edits; no unhandled
rejections; fuzz seed 20260828 bit-identical on rerun.

## PENDING-USER resolved (2026-08-28)

`AudioGraph.verifyAttenuatorOffline()` → **peak 0.476** (linear ≈ −6.45
dBFS on the −1 dBFS square wave — the limiter engaging just under the
−6 ceiling; assertion was < 0.6 — **PASS**; being slightly UNDER nominal
is the expected direction of safety). **QA-2 complete: PASS.**
