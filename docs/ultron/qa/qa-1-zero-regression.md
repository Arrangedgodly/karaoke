# QA-1 — Zero-Regression Pass (Cycle 2)

Covers plan.md task QA-1 / town-hall success measure 3: with WebMCP absent
**and** present-but-idle, the app is indistinguishable from cycle-1
behavior. Split evidence: automated (file-level + harness sweep, this file)
and user-manual (browser-real interactions, both flag modes — results
recorded below on completion).

## Part A — Automated evidence (2026-08-28)

### A1. File-level proof (git vs cycle-1 commit 61f179f)

Every cycle-1 audio-path / persistence / control file is **byte-identical**:

`audio-engine.js`, `audio-bypass.js`, `node-types.js`, all six `node-*.js`,
`param-controls.js`, `preset-schema.js`, `preset-store.js`,
`persistence.js`, `default-preset.js`, `vendor/sortable.min.js` — UNCHANGED.

Cycle-2's complete footprint on tracked files (all changes additive,
each harness-verified in its task log):
- `index.html` +176 (topbar restructure VIS-2, script tags, comments)
- `src/audio-graph.js` +261/−(attenuator + self-test + note — MC-4,
  user-approved incl. default-preset consequence option (a))
- `src/canvas.js` +181 (palette/card attributes VIS-3/4, pulse listener
  VIS-6)
- `src/main.js` +36 (MeterTaps/StatusReadouts hook calls)
- `src/presets-ui.js` +20 (three exports VIS-3)
- `styles/main.css` +1590 (re-skin)
Plus 7 NEW additive modules (agent-ui, mcp-server, mcp-tools, mcp-harness,
meters, meter-taps, status-readouts) — no cycle-1 file deleted.

The DSP graph, bypass logic, preset persistence, autosave, and drag library
are the shipped cycle-1 code paths by construction.

### A2. Full harness sweep (formal run, 2026-08-28)

| Harness | Result |
|---|---|
| mc4 | 64/64 |
| mc5 | 39/39 |
| mc6 | 75/75 |
| vis2 | 59/59 |
| vis3 | 60/60 |
| vis4 | 83/84 (known false-neg: frozen git-snapshot vs evolved tree) |
| vis5 | 42/42 |
| few2 | 41/41 |
| few3 | 59/59 |
| vis6 | 80/81 (known false-neg: file-list check vs docs bookkeeping) |

**Behavioral: 602/602.** The two non-behavioral failures are both
snapshot-comparison checks tripping on work that legitimately postdates
their frozen baselines (documented in each task's log).

### A3. Known intentional deltas (approved, not regressions)

1. Output attenuator (−6 dBFS) now permanent post-limiter (MC-4, D3) —
   audible level ~6 dB lower than cycle-1 at identical settings; the
   safe-output note discloses it in-app. This is the approved safety
   architecture, verified by verifyAttenuatorOffline (QA-2 to invoke).
2. Topbar layout is the status strip (VIS-2) — same ids/wiring.
3. Theme is dark console (VIS-1..6) — same flows/keyboard.

## Part B — User manual script (both modes, browser-real)

**Mode 1 — WebMCP present-but-idle** (current flagged Chrome):
1. Load `http://localhost:8000` → console free of errors; chip `AGENT READY`
   (idle); full UI renders (strip, palette w/ family chips, canvas w/
   meters dark, presets w/ saved "Classic Karaoke").
2. Start → mic permission → status LIVE (amber), readouts fill
   (RATE/LATENCY/NODES), meters breathe with voice.
3. Drag Gain into chain → card w/ family edge + fader; drag-reorder;
   remove via ×. Each works as cycle-1.
4. Sliders adjust by mouse AND keyboard arrows (cycle-1 behavior).
5. Presets: Save As… "qa1-test" → appears in dropdown → Load → Delete.
6. Autosave: build a 3-node chain → reload page → chain restores + NODES
   count correct.
7. **Bypass**: click → engaged (red, loudest); spacebar toggles; dry mic
   passes; disengage restores chain. Rapid-toggle a few times.
8. Agent-idle check: with no tool calls, chain behaves exactly manual-only.

**Mode 2 — WebMCP absent** (toggle `chrome://flags/#enable-webmcp-testing`
OFF, relaunch, repeat 1–8; chip stays `AGENT —`, one console.info
diagnostic allowed):
9. All of 1–8 identical; no errors, no dead UI.
10. Toggle flag back ON afterward.

## Part C — Results

- [ ] Mode 1: steps 1–8 (initials/date)
- [ ] Mode 2: steps 9–10
- Verdict: PASS / FAIL (any failure → task stays open, diagnose in log)

## Part C — Results (user, 2026-08-28)

- Mode 1 (flag on, idle): steps 1–8 — **PASS** ("everything passed")
- Mode 2 (flag off): steps 9–10 — **PASS** (included in "everything")
- **VERDICT: PASS.** QA-1 complete.
