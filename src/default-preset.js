// PX-3's committed default chain, instantiated as real, loadable data.
//
// Loaded as a plain (non-module) <script> — this file is a static data
// literal, not an IIFE-wrapped module: there's no function/state to keep
// private here, just one global, window.DEFAULT_PRESET, so a closure would
// add nothing.
//
// Node order (Gain -> Compressor -> EQ -> Delay -> Reverb -> Limiter, per
// docs/ultron/cycle-1/design/px3-default-chain-and-preset.md's rationale),
// ids ("n1".."n6") and node types are PX-3's committed spec; the params were
// its spec verbatim until issue #2's amendment. The shipped values for n2
// and n6 now CONFORM to the WebMCP policy get_capabilities publishes (the
// original -24 dB / -1 dB pair violated it: ceiling -1 sits outside the
// published [-12, -3] dB limiter range, and the gain-budget estimate
// 0.57*|-24| + 0.57*|-1| = 14.25 dB busted the +12 dB cap, so even a
// no-op get_chain -> set_chain round-trip was rejected). The amended pair
// keeps the sound as close as the policy allows: ceiling -3 dB is the
// LOUDEST legal ceiling (closest to -1; the host's fixed -6 dBFS output
// attenuator follows the limiter either way), and threshold -16 dB keeps
// the compressor's character with headroom — budget = 0 (gain) +
// 0.57*|-16| + 0.57*|-3| = 10.83 dB <= +12 dB, margin 1.17 dB.
// src/factory-presets.js's library copy carries this same amendment,
// applied in the same edit: the two chains stay byte-identical (PS-4).
//
// Consumed by src/persistence.js: PS-2's loadInitialModel() falls back to
// window.DEFAULT_PRESET.nodes whenever nothing has been autosaved yet (fresh
// profile, cleared localStorage, or corrupt/invalid autosaved data), per
// px3's own "First-run behavior" section — a first-run host gets an
// immediately usable vocal chain rather than an empty canvas.
window.DEFAULT_PRESET = {
  name: 'Classic Karaoke',
  nodes: [
    { id: 'n1', type: 'gain',       params: { gainDb: 0 } },
    { id: 'n2', type: 'compressor', params: { threshold: -16, ratio: 4, attack: 0.01, release: 0.25 } },
    { id: 'n3', type: 'eq',         params: { lowGain: 0, midGain: 0, highGain: 0 } },
    { id: 'n4', type: 'delay',      params: { timeMs: 300, feedback: 25, mix: 25 } },
    { id: 'n5', type: 'reverb',     params: { mix: 20 } },
    { id: 'n6', type: 'limiter',    params: { ceiling: -3, release: 50 } }
  ]
};
