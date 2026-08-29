# ACCEPTANCE — the physical/human checklist

This file is the OTHER half of the safety contract. It exists because the
most important properties of a live karaoke vocal chain — what a real
microphone sounds like through a real PA, whether an edit clicks, what a
hidden browser tab does — **cannot be proven by automation**. Everything a
machine CAN prove runs in seconds from a clean clone:

```bash
node tests/run.js        # zero-dependency regression gate (issue #9)
```

| Automated gate (`node tests/run.js`) | Issue #9 criterion |
|---|---|
| `tests/test-tool-registration.js` | all eight WebMCP tools register with the intended schemas + annotations |
| `tests/test-factory-presets-policy.js` | the current chain and every factory preset round-trip `set_chain` (policy-conforming) |
| `tests/test-node-reuse-type-match.js` | a same-ID type change creates the correct physical AudioNode |
| `tests/test-safety-refusals.js` | limiter removal / a node after the limiter / an unsafe ceiling are refused, with nothing applied |
| `tests/test-mutation-undo.js` | one valid mutation applies, then Undo restores model + physical graph exactly |
| `tests/test-*.js` (future) | **DEFERRED — `save_preset` storage-failure truthfulness arrives with issue #8**; when its test file lands, the runner auto-discovers it |

Everything below is walked BY A HUMAN, with the actual equipment, before a
live event (and after any DSP-touching change). Print it, date it, keep the
filled copies with the event kit. A failed line on event day means: use
**Bypass** and a plain mic.

Setup for every section below unless noted: the app served locally
(`start.bat` / `start.command`, http://localhost:8000), Chrome, the real
microphone the event will use, and the real PA/speakers it will feed, at
event volume.

---

## 1. Real microphone through the PA

The one test no stub can replace: level and feedback behavior with the
actual mic and the actual room.

- [ ] Press **Start**, allow the mic, pick the right input device. The
      status strip reads **Live**, and the **MIC IN** meter moves when you
      speak.
- [ ] Speaking/singing at event distance, the chain's limiter is not
      constantly slammed (the OUT meter peaks around the ceiling on the
      loudest phrases, not pinned): level is usable.
- [ ] Walk the mic in front of the speakers at event distance: no howl
      develops at normal chain settings. If the watchdog trips, the app
      mutes output and shows the alert — and only the human **Restore
      output** button brings it back (never an agent, never a rebuild).
- [ ] **Bypass** (button or spacebar) from across the room: instant clean
      mic, and engage/disengage again mid-song with no glitch.
- [ ] Date / operator / result: ____________

## 2. Audible-DSP checks

Each effect must be audible, correct, and quiet-transitioning through the
PA. Start from the factory **Classic Karaoke** preset.

- [ ] **Gain**: +6 dB is clearly louder, −6 dB clearly quieter; no change
      in tone.
- [ ] **Compressor**: singing loud into it levels the vocal without
      audible pumping at default settings.
- [ ] **EQ**: +6 dB low = fuller, +6 dB high = brighter, −12 dB mid =
      noticeably hollow/telephonic.
- [ ] **Delay**: one distinct slap at 300 ms; feedback 60 % gives a
      decaying repeat tail, never a runaway build.
- [ ] **Reverb**: mix 40 % is clearly wetter than 20 %, and the dry vocal
      stays up front.
- [ ] **Limiter**: with the ceiling at −3 dB the loudest notes stay clean
      (no crunch), and the OUT meter never exceeds the ceiling.
- [ ] **Large-jump click check (issue #5 — pending)**: the published
      policy (`get_capabilities` → `host-param-ramps`) promises every
      param change ramps over 10–20 ms with no instantaneous jump. Until
      issue #5's ramps ship, verify the CURRENT behavior honestly: drag a
      slider from min to max in one gesture and listen for a click/zipper;
      record what you hear. When #5 lands, this line becomes a hard FAIL
      on any audible click.
- [ ] Reordering/removing nodes mid-signal: no pop, no dropped audio.
- [ ] Date / operator / result: ____________

## 3. Hidden-tab watchdog behavior (issue #7 — documented limitation)

Current documented behavior (src/meter-taps.js): the ONE rAF loop drives
both meters and the watchdog, and **rAF auto-pauses when the tab is
hidden** — while hidden, the meters decay to dark and the watchdog stops
sampling. No fallback timer exists by design. Issue #7 will move watchdog
detection onto the audio thread so protection continues in a hidden tab;
until then, verify the limitation is exactly as documented:

- [ ] Start the engine, then switch to another tab/window for ~30 s with
      program running: on return, meters resume immediately, no stale
      readings, no error in the console.
- [ ] With the tab visible, an above-ceiling sustained signal still trips
      the watchdog and latches (automated for the DSP math by
      `tests/test-watchdog-tap-and-latch.js`; this checks the real
      browser's rAF cadence).
- [ ] **Operator rule while #7 is open**: keep the karaoke tab visible
      (or on a second screen) during an event; do not background it
      behind a fullscreen lyrics window.
- [ ] When issue #7 ships: replace this section with the hidden-tab
      protection check (trip possible while hidden, restore still
      human-only).
- [ ] Date / operator / result: ____________

## 4. Real-browser WebMCP exercise of all eight tools

The committed registration/schema gate is automated
(`tests/test-tool-registration.js`); this walks the REAL browser surface
end to end. Chrome with `chrome://flags/#enable-webmcp-testing` Enabled.

- [ ] DevTools → **Application → WebMCP**: all 8 tools listed —
      `get_capabilities`, `get_chain`, `set_chain`, `add_node`,
      `remove_node`, `set_param`, `list_presets`, `save_preset` — each
      showing its input schema.
- [ ] `get_capabilities` → the policy tables (nodeTypes, chainRules)
      render; note the limiter ceiling range [−12, −3] dB for the next
      step.
- [ ] `get_chain` → the live chain JSON, round-trips.
- [ ] `set_chain` → apply a valid chain (e.g. the factory "Warm Ballad"
      nodes); toast appears, chain rebuilds audibly.
- [ ] `add_node` (mid-chain) → applies and the minted id is disclosed.
- [ ] `remove_node` on the limiter → **refused** (toast says so).
- [ ] `set_param` ceiling −1 dB → **refused** with the allowed range.
- [ ] `list_presets` → user + factory groups, correct counts.
- [ ] `save_preset` → saves; appears in the Presets panel; Undo removes
      it. (Honest-failure reporting of storage failures is issue #8 —
      when it ships, add: fill localStorage, save, and confirm the tool
      reports the failure instead of success.)
- [ ] Undo (toast button and Ctrl/Cmd+Z) after each applied mutation:
      chain and preset state return exactly (`get_chain` matches).
- [ ] Date / operator / result: ____________

## 5. Latency readout sanity

The status strip's LATENCY readout is the context-reported
`baseLatency + outputLatency` estimate (src/status-readouts.js) — sanity,
not a lab measurement.

- [ ] After Start, LATENCY shows a plausible value (typically ~5–50 ms on
      laptop hardware; **—** is acceptable only on browsers that report
      neither field — note the browser if so).
- [ ] Compare feel, not just the number: singing against the PA, the
      round trip is not an audible slap-back (a distracking echo means
      stop and re-check the PA path, whatever the readout says).
- [ ] Sample rate readout matches the hardware (e.g. 48.0 kHz), NODES
      matches the chain length.
- [ ] Date / operator / result: ____________

## 6. Live-deployment smoke — https://karaoke.arrangedgodly.com/

The deployed build must be the same app the local checks ran against.

- [ ] Loads over HTTPS with no console errors; Start works and the mic
      permission flow behaves.
- [ ] `get_chain` (DevTools WebMCP pane, or `?dev` harness) returns the
      default chain — the deployed build has its tools registered.
- [ ] One `set_param` + one Undo through the deployed app.
- [ ] Factory presets present in the Presets panel; autosave restores
      after a reload.
- [ ] Latency/meters live; Bypass works.
- [ ] Version sanity: the deployed chain behavior matches local (same
      refusals on the limiter/ceiling attempts from section 4).
- [ ] Date / operator / result: ____________

---

**Reminder on scope**: if a change touches `src/audio-graph.js`,
`src/node-*.js`, `src/mcp-tools.js`, or the watchdog, run
`node tests/run.js` AND re-walk sections 1–3 (physics and audibility)
before trusting it in front of an audience.
