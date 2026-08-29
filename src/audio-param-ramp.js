// Shared click-safe AudioParam scheduling helper (issue #5).
//
// Loaded as a plain (non-module) <script> — same IIFE + single `window.X`
// export pattern as the rest of this project — exposing one namespace,
// `window.AudioParamRamp`, with ONE function: schedule(param, target).
//
// Why this file exists: the agent capability response promises every
// parameter change ramps over 10-20 ms ("host-param-ramps" in
// src/mcp-tools.js's CHAIN_RULES — "no instantaneous jumps, so edits never
// click"). Until issue #5, that promise was false: the per-type applyParam
// handlers in src/node-*.js assigned directly to `AudioParam.value`, which
// takes effect at the next render quantum — an instantaneous jump that
// clicks on any large move (a gain jump mid-waveform discontinuously
// rescales the samples around it). This helper is the ONE shared place
// that promise is kept: every live AudioParam write performed by a node
// handler now goes through schedule().
//
// The pattern is deliberately the house style already proven by
// rampGateTo() in src/audio-graph.js (the chain gate's glitch-free
// duck/un-duck), which Chromium-safe and cross-browser:
//   1. cancelScheduledValues(now)  — drop any automation still in flight
//      (e.g. the previous step of a slider drag) so schedules never stack;
//   2. setValueAtTime(param.value, now) — pin the param at its CURRENT
//      value at `now`, so the ramp below starts exactly where the audio
//      actually is, not where some stale schedule left it;
//   3. linearRampToValueAtTime(target, now + RAMP_S) — a linear ramp over
//      RAMP_S seconds.
// cancelAndHoldAtTime() would be marginally tidier for step 1+2 but is
// Chromium-only; setTargetAtTime() never actually REACHES its target (it
// is exponential, so a plain .value read-back would drift from the model).
// The cancel + setValueAtTime + linearRamp triple is the portable,
// reachable-target form this project already uses.
//
// RAMP_S is 0.015 (15 ms): inside the published 10-20 ms window, the same
// figure as audio-graph.js's FADE_S (its own, separate constant — the two
// are equal by policy, not by sharing, so neither file's ramp behavior can
// be changed by editing the other).
//
// Defensive by contract: schedule() never throws (a missing method or a
// damaged engine read degrades to the best schedule it can still make, or
// to a plain .value write as the last resort — still applying the change,
// just less gracefully), because its callers (applyParam handlers) run in
// the live audio-edit path where a throw would break a mutation midway.

(function () {
  'use strict';

  // 15 ms — the middle of the 10-20 ms ramp window get_capabilities
  // promises (CHAIN_RULES 'host-param-ramps'). Exposed read-only for tests
  // and disclosure so the promise and the implementation can be checked
  // against the same constant.
  var RAMP_S = 0.015;

  /**
   * Resolve the schedule origin: the live AudioContext's currentTime, or 0
   * when the engine/context is absent or damaged (bare harnesses). A
   * constant 0 is a valid schedule origin — every Web Audio method called
   * below accepts it.
   *
   * @returns {number}
   */
  function nowTime() {
    try {
      var ctx = window.AudioEngine && window.AudioEngine.audioContext;
      if (ctx && typeof ctx.currentTime === 'number' && isFinite(ctx.currentTime)) {
        return ctx.currentTime;
      }
    } catch (err) {
      // Fall through to 0 — scheduling from 0 is always legal.
    }
    return 0;
  }

  /**
   * Schedule `param` from its current value to `target` over RAMP_S
   * seconds — the click-safe write every live AudioParam change in the
   * node handlers (src/node-*.js applyParam) and the agent set_param fast
   * path (src/mcp-tools.js) funnels through.
   *
   * Never throws. Preference order:
   *   1. cancelScheduledValues + setValueAtTime + linearRampToValueAtTime
   *      (the house rampGateTo() pattern — portably click-safe, and the
   *      ramp actually reaches `target`, so a .value read-back matches the
   *      model afterwards);
   *   2. setTargetAtTime alone, when the ramp pair is unavailable but the
   *      exponential setter is not;
   *   3. a direct `.value = target` write as the absolute last resort —
   *      applying the change imperfectly beats silently dropping it.
   *
   * @param {AudioParam} param - the AudioParam to move.
   * @param {number} target - the value to ramp TO (already converted to
   *   the param's own unit by the caller — dB->linear, ms->s, %->gain).
   */
  function schedule(param, target) {
    if (!param || typeof target !== 'number' || !isFinite(target)) {
      return; // Nothing sane to schedule — leave the param untouched.
    }
    var now = nowTime();
    try {
      if (typeof param.cancelScheduledValues === 'function') {
        param.cancelScheduledValues(now);
      }
      if (typeof param.setValueAtTime === 'function') {
        param.setValueAtTime(param.value, now);
      }
      if (typeof param.linearRampToValueAtTime === 'function') {
        param.linearRampToValueAtTime(target, now + RAMP_S);
        return;
      }
      if (typeof param.setTargetAtTime === 'function') {
        param.setTargetAtTime(target, now, RAMP_S / 3);
        return;
      }
    } catch (err) {
      // A damaged param — fall through to the last resort below.
    }
    try {
      param.value = target;
    } catch (err2) {
      // Not an AudioParam at all — nothing more this helper can do.
    }
  }

  window.AudioParamRamp = {
    schedule: schedule,
    RAMP_S: RAMP_S
  };
})();
