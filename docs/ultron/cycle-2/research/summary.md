# Cycle-2 Research Summary

Five questions, four parallel subagent tracks (T1 = RQ-1+RQ-2 WebMCP/Gemini;
T2 = RQ-3 loudness; T3 = RQ-4 meters; T4 = RQ-5 palette), all primary-source
grounded, 2026-08-27. Records: [rq1](rq1-webmcp-api.md) ·
[rq2](rq2-gemini-path.md) · [rq3](rq3-loudness-policy.md) ·
[rq4](rq4-meters.md) · [rq5](rq5-palette.md).

## Decision matrix

| ID | Decision | Priority | Status | User disposition |
|----|----------|----------|--------|------------------|
| D1 | Build on `document.modelContext.registerTool()` (+`navigator.modelContext` fallback); enable via `chrome://flags/#enable-webmcp-testing`; errors returned as descriptive result text; re-register per load | P0 | **committed** | approved 2026-08-27 |
| D2 | QA-3 retarget: validate today via DevTools WebMCP pane + Model Context Tool Inspector (NL agent, gemini-3-flash); Gemini-in-Chrome live acceptance becomes a **deferred** gate (revisit: recheck docs before QA-3/DOC-1); README documents current truth | P0 | **committed** | approved 2026-08-27 |
| D3 | Loudness policy per rq3: two-tier reject/clamp table; limiter-required-terminal; +12 dB gain budget; feedback ≤0.7; host-owned −6 dBFS output attenuator (new persistent node); runtime watchdog (peak/howl) with human-only restore | P0 | **committed** | approved 2026-08-27 |
| D4 | Meters: 2× AnalyserNode side-taps (off `sourceNode` + `chainGate`, created outside `buildGraph` — verified rebuild-safe), one shared rAF loop, canvas render, IEC PPM ballistics (12 dB/s fall, 1500 ms hold, clip latch ≥3 samples) | P1 | **committed** | approved 2026-08-27 |
| D5 | Palette: rq5 token table verbatim (warm charcoal neutrals, amber accent, split-role safety red, 6 family edges, focus tokens, meter stops — all ratios computed) | P1 | **committed** | approved 2026-08-27 |

**Whole-plan re-approval (required by D2's acceptance-criteria change):
granted 2026-08-27** — clear natural-language approval of D1–D5 and the
revised plan, no adjustments.

## Headline discoveries

1. **API correction (D1)**: `registerMcpServer` never shipped; the real API
   is per-tool `document.modelContext.registerTool()`. No server metadata,
   no connection concept → agent chip semantics become
   "tools ready / acting / unavailable".
2. **Gemini gap (D2)**: Gemini in Chrome does **not** consume WebMCP tools
   as of 2026-08-27 (last primary word: "soon", I/O 2026-05-19). Interim
   validated paths: DevTools WebMCP pane + Model Context Tool Inspector
   extension. The 5-prompt live acceptance needs retargeting to stay
   executable.
3. **Safety architecture (D3)**: spec-verified — compressor makeup gain is
   static and UA-variable (up to ~+14 dB), so the policy adds a host-owned
   post-limiter attenuator (−6 dBFS) + runtime watchdog; limiter becomes
   required-terminal in agent chains.
4. **Meter topology (D4)**: side-taps survive graph rebuilds by construction
   (verified against this repo's teardown code) — no re-tap logic needed.
5. **Palette (D5)**: full AA-verified token set incl. the mandatory
   split-role safety red; hairlines decorative-only.

## Contradictions / confidence

- RQ-1: spec example shows MCP-style `{content:[…]}` wrapper while spec text
  says "any JSON-serialized value" — plan: plain values, verify rendering in
  DevTools pane during MC-0. Confidence high overall; localhost-OT-token
  acceptance unverified (flag path avoids it).
- RQ-2: absence-of-evidence finding (high confidence as of today; could end
  any week — hence the revisit trigger, not a plan assumption).
- RQ-3: −6 dBFS / 0.7 / +12 dB are conservative practice numbers (medium);
  watchdog thresholds need live tuning (QA-2).
- RQ-5: all arithmetic exact; layer-separation and amber↔brass proximity
  carry pre-verified fallbacks.

## Plan consequences

Task-detail updates applied to plan.md (API correction, RQ-3 policy into
MC-4, RQ-4 spec into VIS-5/FEW-3, RQ-5 table into VIS-1, chip semantics into
FEW-1, MC-0 validation path, DOC-1 honesty, QA-2 watchdog tests) and QA-3
retargeted per D2 — acceptance-criteria change requiring whole-plan
re-approval at this gate.
