# PX-1 — Screen Layout & Visual Design Spec

Covers plan.md task PX-1. Informs UI-1 (Start/device picker), UI-2 (Bypass), UI-3 (canvas), UI-4 (parameter controls), PS-3 (presets).

## Screen regions

```
┌─────────────────────────────────────────────────────────────────────┐
│  App title      ● Live / ○ Stopped   [Start/Stop] [Device ▾]  [ BYPASS ] │  <- top bar, persistent
├───────────┬─────────────────────────────────────────────┬───────────┤
│  PALETTE  │                CHAIN CANVAS                  │  PRESETS  │
│           │                                               │           │
│  Gain     │  [Mic In] → [node] → [node] → ... → [Out]    │  My Preset│
│  Compress │                                               │  (unsaved)│
│  EQ       │                                               │           │
│  Delay    │                                               │  [Save]   │
│  Reverb   │                                               │  [Load ▾] │
│  Limiter  │                                               │           │
└───────────┴─────────────────────────────────────────────┴───────────┘
```

Three-column layout: fixed-width palette (left), flexible canvas (center, the primary work area), fixed-width presets panel (right). Top bar spans full width and is always visible — nothing scrolls it out of view, because it holds the two controls that matter most under pressure (Start/Stop, Bypass).

## Visual prominence hierarchy (most → least)

1. **Emergency Bypass button.** Largest, highest-contrast element on screen — bright, unambiguous color (e.g. red/orange fill), fixed in the top bar so it never scrolls away, large hit target, keyboard shortcut (e.g. spacebar) in addition to click. This is deliberate: per town-hall.md, there is no physical fallback, so this is the one control that must be found instantly, without reading, from across a room.
2. **Live/Stopped status + Start/Stop control.** Second-most prominent — a persistent status indicator (`● Live` in green / `○ Stopped` in gray) next to the Start/Stop button, both in the top bar.
3. **Chain canvas.** The primary work area, given the most screen space (center column, flexible width).
4. **Node palette.** Present but visually quieter than the canvas — a simple list, not competing for attention.
5. **Presets panel.** Similarly quiet — a list plus Save/Load, not a focal point.
6. **Permission/error/status messaging.** Present when relevant but never blocking or covering the Bypass button — inline or as a dismissible non-modal banner, never a full-screen modal.

## State-by-state treatment

Covers every state from town-hall.md § Important States:

| State | Treatment |
|---|---|
| **No/denied mic permission** | Before permission is granted (or if denied), the Start control shows an inline message below it (e.g. "Microphone access needed — click Start to allow") rather than a blocking modal. Bypass remains visible but inert/disabled (nothing to bypass yet) — never hidden. |
| **Multiple input devices** | A device-select dropdown appears next to Start, populated only after permission is granted (enumerateDevices requires a prior getUserMedia call to return real labels — see RQ-4). Single-device case: dropdown still present but effectively a no-op. |
| **AudioContext suspended vs. running** | The `● Live` / `○ Stopped` indicator in the top bar reflects this directly. Suspended = gray dot + "Stopped"; running = green dot + "Live". |
| **Empty vs. populated chain** | Empty: canvas shows `[Mic In] → [Out]` connected directly, plus a light dashed placeholder with hint text ("Drag an effect here to start building your chain"). Populated: real node cards fill the space between the two fixed anchors. |
| **Mid-drag** (audio unaffected until drop) | Dragged node card lifts slightly (shadow/opacity change) and follows the pointer; an insertion-line marker shows the target drop position between existing nodes. No audio-graph or status-indicator change during this — the rewire only happens on drop (per AE-4/UI-3), so the UI shouldn't visually imply anything audio-related is happening mid-drag. |
| **Bypass engaged vs. normal** | The Bypass button itself changes state visibly and unambiguously — e.g. toggles from an outlined/inactive look to a solid-filled, higher-contrast "ENGAGED" look (and could pulse gently), so it reads correctly even from a glance across the room. When engaged, the chain canvas is visually dimmed/desaturated (not disabled — the host can still edit it) to reinforce that the audible signal is currently bypassing whatever's shown there. |
| **Unsaved-changes vs. loaded-preset** | Presets panel shows the current preset's name if one is loaded, with a small indicator (e.g. a dot or "• unsaved changes") appended the moment any parameter or chain-order edit diverges from the loaded preset's saved state. A fresh/no-preset session shows "Unsaved chain" instead of a preset name. |
| **Input device disconnected / laptop sleep recovery** | A non-blocking, dismissible banner appears near the top (below the top bar, above the three-column layout) — e.g. "Input device disconnected — reconnect and click to resume" — without covering or disabling the Bypass button. The Live/Stopped indicator reflects the interruption (drops to Stopped) so the state is visible in two places, not just the banner text. |

## Rationale notes for later UI tasks

- Bypass's fixed top-bar position and dedicated visual language (distinct from every other control) is the single most load-bearing decision in this spec — it directly implements town-hall.md's "Emergency Bypass is the primary reliability safety net" and QA-6's independent-reliability-test requirement. Don't let later visual polish dilute its contrast or move it somewhere less immediately findable.
- The chain canvas dimming-on-bypass behavior is a recommendation, not a hard requirement from the brief — flag to the user for confirmation once UI-2/UI-3 are actually built and it can be seen in context, in case it reads as confusing rather than reassuring in practice.
- No visual treatment is specified here for individual node parameter controls (sliders/knobs) — that's UI-4's scope, informed by PX-2's per-node parameter data, not this layout-level spec.
