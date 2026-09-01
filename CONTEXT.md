# VOXCHAIN

The domain language of the karaoke vocal-effects chain builder: a web app where
humans assemble mic→effects→out chains on a free board, and WebMCP agents read
and edit the same chain through a shared, policy-gated surface.

## Language

### Presets

**Factory preset**:
A chain shipped with the app as a starting point; merged into the UI at runtime
and never persisted to the user's store.
_Avoid_: built-in preset, stock preset

**Default preset**:
The specific chain a fresh profile starts on (Classic Karaoke); a distinct
concept from the factory library it belongs to.
_Avoid_: default chain (that names the model, not the preset)

**User preset**:
A named chain a user saved into their own browser store; a separate namespace
that never shadows the factory library.
_Avoid_: saved chain (conflates with the autosave slot)

**Candidate**:
A generated chain awaiting audition; it becomes a factory preset only by
passing the audition gate.
_Avoid_: draft preset, generated preset

**Audition**:
The human listening pass every candidate must pass before entering the factory
library; the bar is "usable without edits."
_Avoid_: review, verification (automated checks also verify — only a human
auditions), quality check

**Provenance**:
The recorded origin and audition history of a factory preset.
_Avoid_: attribution, credit

**Coverage-driven**:
Sizing the library by "every plausible karaoke request finds a close preset"
rather than by a target count.
_Avoid_: exhaustive, complete library

**Seed batch**:
The first small set of candidates run end-to-end through the pipeline to prove
it before production batches.
_Avoid_: pilot, MVP presets

### Agent strategy

**Preset-first**:
Resolving a user request by loading the closest factory preset and adjusting
params, before building a chain from scratch.
_Avoid_: preset matching (names the agent's search step, not the strategy)
