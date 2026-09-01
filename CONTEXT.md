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

**Axis**:
One of the four public tag dimensions a factory preset draws tags from —
genre, vibe, use-case, gag — combined freely, never exclusive folders; the
vocabulary is append-only (a tag is added only when a real request fails to
match).
_Avoid_: bucket, category, folder

**Primary tag**:
The single tag a preset declares for dropdown grouping, chosen at audition.
_Avoid_: main tag, group

**Technique axis**:
The internal tag dimension describing what the chain does (hard-tune, lo-fi,
ambience-long…); used for coverage and dedup only, never user-facing
grouping.
_Avoid_: effect tags

**Cleanup**:
The use-case for mic-repair presets — hiss, plosives, room noise — first-class
because users request it more fluently than any sound.
_Avoid_: polish-only, enhancement

### Agent strategy

**Preset-first**:
Resolving a user request by loading the closest factory preset and adjusting
params, before building a chain from scratch.
_Avoid_: preset matching (names the agent's search step, not the strategy)

**Closeness rule**:
A request is close enough to a preset when any of its tags matches the
request's dominant intent — load and tweak; otherwise build fresh. A request
that matches nothing is a coverage gap.
_Avoid_: fuzzy matching
