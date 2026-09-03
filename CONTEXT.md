# VOXCHAIN

The domain language of the karaoke vocal-effects chain builder: a web app where
humans assemble mic→effects→out chains on a free board, and WebMCP agents read
and edit the same chain through a shared, policy-gated surface.

## Language

### Views

**Simple view**:
The preset-led presentation for a person who does not know audio engineering;
it centers finding, loading, and auditioning sounds while hiding manual chain
construction and parameter controls. It may name the devices a preset uses as
read-only context.
_Avoid_: beginner mode, basic mode

**Advanced view**:
The current hands-on chain-builder presentation, where a person can add,
remove, reorder, bypass, and tune individual effects.
_Avoid_: expert mode, pro mode

**Current sound**:
The persistent Simple-view area that names the chain playing right now and
carries the Previous/Next controls for stepping through the filtered library;
it names the live chain, which is not always a preset.
_Avoid_: now playing, active preset (the live chain may be unsaved or agent-built)

**Effect summary**:
The read-only, plain-language account of what a chain does, effect by effect —
the plain effect first with its technical name quietly after ("Evens out
loudness · Compressor"); it never shows parameter values.
_Avoid_: chain description (that names the preset's own prose), signal path

**Unsaved sound**:
A live chain that no longer matches the preset it was loaded from — the state
that makes "Save this sound" appear in Simple.
_Avoid_: dirty state, modified preset

**Custom sound**:
The live chain when it matches no preset — agent-built, or hand-edited in
Advanced. Simple names it "Custom sound", derives its effect summary from the
live chain rather than from a preset record, and offers Save this sound beside
the name.
_Avoid_: unsaved preset, draft (a candidate is the thing awaiting audition)

**Plain filter**:
A named query over existing preset tags, defined in the Simple view and stored
nowhere on presets ("Funny" resolves to the gag axis, "Clean & clear" to the
cleanup use-case). A plain filter that returns nothing is a visible coverage
gap.
_Avoid_: axis (that names the taxonomy dimension), category, folder

**Safety floor**:
The controls both views show at equal prominence — Start/Stop, microphone
selection, Bypass, and the input/output meters. Simple hides chain
construction, never the human's control over what reaches the speakers.
_Avoid_: transport, advanced controls

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

**Try a preset**:
Apply a preset to the live chain so the user can hear it and compare it with
other presets.
_Avoid_: audition (reserved for candidate approval), preview (implies the live chain is unchanged)

**Candidate**:
A generated chain awaiting audition; it becomes a factory preset only by
passing the audition gate.
_Avoid_: draft preset, generated preset

**Audition**:
The human listening pass every candidate must pass before entering the factory
library; the bar is "usable without edits." A candidate may also be deferred:
not judged, left pending for a later session. Deferring is not a third quality
tier — the bar stays binary.
_Avoid_: review, verification (automated checks also verify — only a human
auditions), quality check

**Deferred candidate**:
A candidate a human declined to judge in this session — kept pending in the pen,
distinct from a rejected one.
_Avoid_: skipped, maybe

**Provenance**:
The recorded origin and audition history of a factory preset.
_Avoid_: attribution, credit

**Coverage-driven**:
Sizing the library by "every plausible karaoke request finds a close preset"
rather than by a target count.
_Avoid_: exhaustive, complete library

**Capability gap**:
A real request no preset can answer because the effect catalog lacks the node
type — harmony, vocoder, formant shift. Recorded in the coverage report, never
papered over with an approximation.
_Avoid_: coverage gap (that names a missing preset, not a missing effect)

**Request corpus**:
The recorded list of plain-language requests the library is scored against; the
source of a candidate's admission evidence.
_Avoid_: user research, prompt list

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

### Persistence

**Recovery snapshot**:
The last autosaved model and layout kept available when startup cannot make
that chain live. It is not a backup; the next accepted edit replaces it.
_Avoid_: backup, recovery slot, recovered chain
