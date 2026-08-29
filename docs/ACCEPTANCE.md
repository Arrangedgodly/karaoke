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
| `tests/test-preset-persistence-honesty.js` | `save_preset` reports storage failures truthfully (issue #8) |
| `tests/test-param-only-mutation.js` | `set_param` rides the parameter-only path (no rebuild, no gate duck) and every AudioParam write is a scheduled 10–20 ms ramp (issue #5) |

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
- [ ] **Large-jump click check (issue #5 — ramps shipped, physical listen
      still required)**: the published policy (`get_capabilities` →
      `host-param-ramps`) promises every param change ramps over 10–20 ms
      with no instantaneous jump. The ramps ARE in the build now (every
      live AudioParam write in the six node handlers is a scheduled 15 ms
      ramp via `src/audio-param-ramp.js`, and `set_param` applies in place
      with no card rebuild and no chain-gate duck — both proven
      headlessly by `tests/test-param-only-mutation.js`, including a
      math-level discontinuity probe). What automation CANNOT prove is
      the sound in the room. Walk it with LARGE jumps at event volume:
      `set_param` gain −24 → +12 dB, reverb mix 0 → 100, delay time
      300 → 750 ms, compressor threshold −8 → −40 — plus one full
      min→max slider drag per effect — listening for any click, pop, or
      zipper. **Any audible click on this line is a hard FAIL.**
- [ ] Reordering/removing nodes mid-signal: no pop, no dropped audio.
- [ ] Date / operator / result: ____________

## 3. Hidden-tab watchdog behavior (issue #7 — protection active while hidden)

Issue #7 moved watchdog detection OFF the paint loop: an
AudioWorkletProcessor (`src/watchdog-worklet.js`, 'watchdog-tap') samples
the final output on the **audio thread** (which never pauses for tab
visibility) and posts block peaks to the main thread, where a
`setInterval` latch makes the trip decision whenever rAF cannot (tab
hidden, or the frame loop stalled). rAF now drives only the meters — and
the visible-cadence watchdog pass. Trip thresholds, the latch, and the
human-only **Restore output** button are unchanged
(`tests/test-hidden-tab-watchdog.js` proves the DSP/decision math
headlessly, including the hidden sustained-peak and rising-howl trips).

**Honest cadence disclosure (worklet mode):** browsers clamp background-tab
timers to ≥ ~1 s (audio-playing tabs are exempt from intensive
throttling, and this app plays audio). While hidden, the peak rule
therefore evaluates at ~1 s granularity — a sustained hot signal trips in
~1–2 s instead of ~250 ms, same threshold — and the howl rule uses a
reduced bar (8 strictly rising band samples over the last 10 ticks ≈
10 s of monotonic rise; a howl that saturates faster parks the output
above the ceiling and is caught by the peak rule). Documented and
deliberate; never silently equivalent.

**Fallback mode (no `audioWorklet` / `addModule` fails — old browser,
`file://` context):** the watchdog reverts to rAF-only sampling with NO
hidden-tab protection, and the interim mitigation fires: a non-modal
warning — *“Keep this tab visible during the show — protection is reduced
while hidden.”* — appears for exactly as long as the page is hidden while
the engine is live. **Operator rule in fallback mode: keep the tab
visible (or on a second screen) during the event.** When the worklet is
live there is no warning — protection is active, only the cadence is
reduced (disclosed above).

Physical walk (the stubs prove the math; this proves the real browser's
schedulers and the real audio thread):

- [ ] Start the engine, then switch to another tab/window for ~30 s with
      program running: on return, meters resume immediately, no stale
      readings, no error in the console.
- [ ] Console shows NO fallback warning was raised (the worklet loaded);
      if it did appear, note the browser — you are in rAF-only mode and
      the operator rule above applies.
- [ ] **Sustained hot signal while hidden**: with the tab visible and an
      above-ceiling test tone running, switch the tab away for ~10 s.
      On return the watchdog has TRIPPED (alert visible, output muted)
      and only the human **Restore output** button reopens it.
- [ ] **Rising howl while hidden**: walk a mic toward the speakers until
      a howl starts building, then switch tabs away. On return the
      watchdog has tripped (howl or peak reason). Restore, then verify
      the warning-free worklet mode again.
- [ ] Fallback spot-check (optional, e.g. an old browser): confirm the
      “Keep this tab visible” warning appears when the tab is hidden
      with the engine live, and clears when the tab comes back.
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
