# PX-3 — Default Shipped Chain Order & Initial Preset

Covers plan.md task PX-3. Feeds PS-2 (autosave needs a default when nothing is saved yet). Builds directly on PX-2's node types/param defaults.

## Default chain order

**Input → Gain → Compressor → EQ → Delay → Reverb → Limiter → Output**

Rationale for the order:
- **Gain first**: sets/trims input level before anything downstream processes it — the natural place to fix a hot or quiet mic before compression reacts to it.
- **Compressor early**: evens out dynamics before EQ and the time-based effects, so they work on a consistent signal rather than one swinging with every loud/quiet syllable.
- **EQ after Compressor**: shapes tone on the now-consistent signal.
- **Delay before Reverb**: the discrete echo repeats get their own sense of space from the reverb after them, producing one cohesive-sounding tail rather than two competing effects.
- **Limiter last, always**: final safety ceiling catching whatever the full chain produces — matches its role as the anti-clipping safety net from the town-hall brief, and standard practice of limiting is always the last stage.

## Starter preset

**Name: "Classic Karaoke"** (consistent with the example already shown in the approved [px1-mockup.html](px1-mockup.html) preset panel).

Uses the default chain order above with every node at its PX-2-specified default parameter values (no overrides) — Gain 0dB, Compressor -24dB/4:1/10ms/250ms, EQ flat, Delay 300ms/25%/25%, Reverb 20% mix, Limiter -1dB/50ms. This is deliberately the same "sounds reasonable untouched" set already validated per node in PX-2 — the starter preset doesn't invent new tuning, it's just PX-2's defaults assembled into the recommended order.

## Serialized model (contract for PS-2/PS-3 and the node-type registry)

```json
{
  "name": "Classic Karaoke",
  "nodes": [
    { "id": "n1", "type": "gain",       "params": { "gainDb": 0 } },
    { "id": "n2", "type": "compressor", "params": { "threshold": -24, "ratio": 4, "attack": 0.01, "release": 0.25 } },
    { "id": "n3", "type": "eq",         "params": { "lowGain": 0, "midGain": 0, "highGain": 0 } },
    { "id": "n4", "type": "delay",      "params": { "timeMs": 300, "feedback": 25, "mix": 25 } },
    { "id": "n5", "type": "reverb",     "params": { "mix": 20 } },
    { "id": "n6", "type": "limiter",    "params": { "ceiling": -1, "release": 50 } }
  ]
}
```

Type strings (`gain`, `compressor`, `eq`, `delay`, `reverb`, `limiter`) are the contract AE-5–AE-10 must each `AudioGraph.registerNodeType()` under, and the `nodes` array (minus the `name` wrapper) is exactly the shape `AudioGraph.buildGraph(model)` already expects — this preset's `nodes` value can be passed to `buildGraph()` directly.

## First-run behavior

When PS-2 (autosave) finds nothing saved, it should load this exact preset as the starting chain, rather than an empty canvas — a first-run host gets an immediately usable, tasteful vocal chain and can start performing right away, adjusting from there as needed.

## Decision priority/status

Design decision informed by standard live-vocal signal-chain practice and PX-2's own already-validated defaults — no blocking uncertainty. Not a research question.
