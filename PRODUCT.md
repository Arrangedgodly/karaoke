# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two confirmed users are building and testing the product together:

1. **The developer** (product owner) uses the app as a working audio tool and
   as proof that a substantial browser app can expose safe, useful WebMCP
   controls.
2. **The brother** (collaborator and live-use tester) uses the app for karaoke
   and evaluates whether a non-audio-engineer can shape a voice without
   learning signal-processing vocabulary.

The intended audience is broader than the two confirmed users: streamers,
gamers, karaoke operators, and other creators who want to change or polish a
live voice. These are target use cases, not claimed third-party adoption.

## Product Purpose

VOXCHAIN turns a browser into a live vocal-chain builder. A person can shape
or transform a microphone for streaming, games, karaoke, or other live voice
work. They can edit the chain directly or ask a browser agent in plain
language, such as "make me sound warmer" or "give this a restrained robotic
effect." The app translates the resulting tool calls into the same visible,
safe controls the human uses.

Success means a non-technical person can reach a useful sound, understand
what changed, undo it, and retain immediate human control over Start, the
microphone, and Bypass. Live audio safety remains the hard limit.

The shipped interface has two presentations over the same live chain. Simple
view is the default and centers finding, loading, and trying sounds without
exposing chain construction or parameter controls. Advanced view exposes the
full hands-on chain builder. Start, microphone selection, Bypass, and the
input/output meters form the safety floor and remain equally available in both
views.

## Positioning

A zero-install live vocal-chain builder whose audio engine runs locally in the
browser. The page exposes its chain-building actions as WebMCP tools, so an
in-browser agent can turn plain-language intent into visible, reversible
changes while the app itself stays LLM-free. The product claim is concrete:
one chain, one state, two control paths.

## Operating Context

- **Live session**: stream, game, karaoke event, or rehearsal using a laptop,
  microphone, and headphones, interface, stream input, or PA. Chrome remains
  the tested browser. In a venue, setup happens before doors and Bypass stays
  one action away.
- **Event mode**: dark venue, laptop + USB mic + PA, Chrome-only (explicitly
  recommended; other browsers untested by scoped decision). Setup happens in
  the window before doors; during the show nobody touches anything but
  Bypass (button or spacebar). Running via `start.bat` / `start.command`
  (local `python http.server`, port 8000).
- **Rituals**: "when in doubt, hit Bypass first"; presets saved per event
  type; chain autosaves to localStorage.
- **Prompted setup**: the user describes a result in everyday words. The
  agent reads capabilities and current state, tries the closest factory preset
  first when one matches the dominant intent, then adjusts it through the same
  guarded edit paths the direct UI uses. A request with no matching preset is
  a coverage gap and may require a fresh chain.
- **Two-view workflow**: Simple view is the default preset-led presentation.
  It shows the current sound, plain filters, a searchable sound library,
  Previous/Next controls, and plain-language effect summaries. Advanced view
  provides direct chain construction, reordering, per-effect bypass, and
  parameter editing. Its chain register persistently names the clean loaded
  preset and changes to "Unsaved" after the first accepted adjustment or for
  a chain built without a saved preset. Switching views changes presentation
  only; the live chain, engine, and safety floor do not change.
- **Preset sharing**: after saving a prompted result, the user can copy a
  share LINK — the preset itself, compressed into the URL fragment. Opening
  that link on another machine (or in another browser) offers the sound as a
  one-click import into the personal preset list, without an account or
  server. Shared links contain chain data only, never audio, microphone
  identifiers, or local settings.
- **Judge/demo mode**: a fresh competition-capable browser follows the short
  README path on the deployed origin. The `?dev` harness is a fallback test
  surface, not the main WebMCP demonstration.
- **Terminology in the current production UI**: MIC IN / OUT anchors,
  Palette, chain, presets, Bypass: ON/OFF, Start/Stopped status. The endpoint
  anchors and free-cable layout are under active design review. Their current
  form is not a permanent product requirement.

## Capabilities and Constraints

Confirmed functionality: 14 node types registered through a type registry:
gain, compressor, EQ, delay, reverb, limiter, noise gate, distortion, chorus,
autotune, pitch shift, tremolo, bitcrusher, and phaser. Autotune remains
experimental in the UI and the agent capabilities readout. Advanced view
supports drag-and-drop building and reordering with hand-rolled pointer
gestures and a dashed ghost slot, per-node parameters, and per-effect bypass
that keeps the plugin and its settings in the chain. Simple view provides the
preset-led library and current-sound workflow over that same chain. The app
also has named presets, localStorage autosave, emergency bypass through the
audio path or spacebar, and disabled-until-started mutation gates.

Cycle-2 additions (approved scope): WebMCP server shim (feature-detected,
silent no-op when unavailable), 10 tools (`get_capabilities`, `get_chain`,
`set_chain`, `add_node`, `remove_node`, `set_param`, `list_presets`,
`save_preset`, plus `get_preset`/`load_preset`, which joined the planned
eight during cycle-2 production) with validation/loudness clamps; auto-apply
+ change summary + one-click undo; agent-activity chip; input/output meters;
status readouts. Cycle 3 extended the same tools to discrete string params
(key/scale) and added the experimental badge to the capabilities readout —
no new tools.

The contest release adds human-controlled personal-preset transfer through
share links: a personal preset encodes into the page URL itself, and opening
that link offers a one-click import (with rename/replace on a name
collision) that never loads the live chain. It reuses the existing preset
schema and safety policy. It does not add a WebMCP tool, cloud storage, or
public preset directory.

The factory preset library is coverage-driven data rather than hand-mirrored
loader code. Every factory preset must pass a human audition before shipping,
and its provenance records that accepted verdict. The public tag vocabulary is
append-only and grows when a real request exposes a coverage gap. Browser
agents follow a preset-first strategy: load and tune a close factory preset
before building a chain from scratch.

Hard constraints: vanilla JS, **no build step**;
zero runtime internet dependency; localStorage persistence; no in-app LLM /
API keys / cloud calls; agent never controls the emergency bypass, engine start/stop, or
mic device selection; no new effect node types this cycle; Chrome-only
recommendation stands. Layout and information architecture may now be
reconsidered, including the free board and MIC IN / OUT anchors, as long as
the audio, WebMCP, safety, persistence, keyboard, and shared-state contracts
survive.

Explicitly undecided product facts (recorded, not invented):

- **Brand voice** — current copy is plain-friendly (see README); a
  terse hardware-manual voice was flagged as an open direction, undecided.

## Brand Commitments

- Product name (chosen by the user 2026-08-29): **"VOXCHAIN"**
  — shown in the top bar and README.
- The user-supplied microphone-and-chain mark is the product logo. The app
  uses its neutral-gray version as a quiet chassis stamp and as the favicon.
  Do not fabricate additional brand imagery, testimonials, users, or metrics.
- Approved design direction (cycle-2 town-hall): dark pro-audio console —
  this is the one binding visual-world commitment.

## Evidence on Hand

- `README.md` — real end-user documentation (event-operator voice).
- `docs/ultron/` — approved cycle-2 scoping brief; `docs/ultron/cycle-1/` —
  full cycle-1 record: plan, production log, QA scripts (including the
  Chrome-only cross-browser decision and its replayable script), research.
- `assets/ir/plate-vocal.mp3` — real reverb impulse-response asset (license
  provenance recorded in cycle-1 research).
- Absences future work must not paper over: no third-party users, no
  analytics/telemetry of any kind, no performance benchmarks beyond cycle-1
  QA measurements.

## Product Principles

1. **The show comes first.** Safety and continuity outrank every feature;
   bypass is always one human action away, and no capability may ever put
   audio at risk mid-performance.
2. **Offline and agent-ready are not opposites.** Intelligence lives in the
   user's agent, never in a cloud dependency of the app itself.
3. **Look like what it is.** Pro-audio hardware credibility — utility,
   legibility at distance in dark rooms, zero decorative cosplay.
4. **Zero regression.** New capability layers never touch the core audio
   path's safety properties; absence of agent must equal the shipped app.
5. **Plain-language usable.** Every capability must survive a non-engineer
   operating it alone at setup time, under time pressure.
6. **One page.** The app is and stays a single page — no routes, no
   sub-pages (the ?dev harness is a gated overlay on the same page).
   Added 2026-08-28 by user direction.
7. **Sounds should travel.** A useful prompted chain can leave one browser
   as an inspectable preset file and reproduce the same safe settings in
   another VoxChain session.

## Accessibility & Inclusion

- WCAG **AA contrast is an approved acceptance gate** for the cycle-2 dark
  theme (all text labels), with visible focus states and preserved keyboard
  flows (incl. spacebar bypass) — approved in town-hall, non-negotiable.
- Distance readability in dark venues is a functional a11y requirement, not
  a nicety.
- Natural-language (agent) control is recognized as an accessibility win
   for non-technical operators (approved framing).

## Competition contract

VOXCHAIN is being submitted to The WebMCP Challenge. The official rules,
submission requirements, design implications, and per-change release gate are
recorded in [docs/WEBMCP-CHALLENGE.md](docs/WEBMCP-CHALLENGE.md). That document
and [docs/ACCEPTANCE.md](docs/ACCEPTANCE.md) are required reading before a
competition-facing UI or behavior change is called ready.

The product case for the competition is specific: non-technical people can
describe a vocal result in their own words, an agent can build or tune the
chain through WebMCP, and the human can see, undo, or override the result in
the same interface. WebMCP is part of the interaction, not a hidden demo
endpoint.

## Brand (user decision, 2026-08-30)

The product name is **VOXCHAIN** (displayed uppercase in the silkscreen
identity register). Prior working title "Karaoke Chain Builder" retired.
Deliberately unchanged: localStorage keys (`karaoke-*-v1` — renaming
would orphan saved chains/presets) and the genre word "karaoke" in
prose.

## Deployment (owner decision, 2026-08-31)

The repo is renamed **voxchain** and the deployment moves to a
**Cloudflare Worker** as the main serving path. GitHub Pages is retired:
the Pages site was deleted from the repo (it had been building from
`main` to `arrangedgodly.com/voxchain/` after the rename, custom domain
detached) and the `CNAME` artifact is removed. The Worker now serves the live
app at **https://voxchain.arrangedgodly.com/**.
