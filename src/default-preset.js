// PX-3's committed default chain, instantiated as real, loadable data.
//
// Loaded as a plain (non-module) <script> — this file is a static data
// literal, not an IIFE-wrapped module: there's no function/state to keep
// private here, just one global, window.DEFAULT_PRESET, so a closure would
// add nothing.
//
// This is the EXACT "Classic Karaoke" preset specified in
// docs/ultron/design/px3-default-chain-and-preset.md's "Serialized model"
// section, copied verbatim — same node order (Gain -> Compressor -> EQ ->
// Delay -> Reverb -> Limiter, per that doc's rationale), same ids
// ("n1".."n6"), same PX-2-specified default params for every node (no
// overrides). Until now that JSON only existed as design-doc prose; this is
// its first real, requirable form.
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
    { id: 'n2', type: 'compressor', params: { threshold: -24, ratio: 4, attack: 0.01, release: 0.25 } },
    { id: 'n3', type: 'eq',         params: { lowGain: 0, midGain: 0, highGain: 0 } },
    { id: 'n4', type: 'delay',      params: { timeMs: 300, feedback: 25, mix: 25 } },
    { id: 'n5', type: 'reverb',     params: { mix: 20 } },
    { id: 'n6', type: 'limiter',    params: { ceiling: -1, release: 50 } }
  ]
};
