# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two confirmed users, both known personally (a two-person real-world product,
not a fabricated audience):

1. **The developer** (product owner) — uses the app as a portfolio /
   tech-credibility piece demonstrating production-grade vanilla web
   engineering and, as of cycle 2, agent-controllable web apps (WebMCP).
2. **The brother** — karaoke-event operator; a non-audio-engineer who runs
   the app live at events on a laptop with a mic and PA. Does not know (or
   need to know) signal-engineering vocabulary.

## Product Purpose

Turns a laptop into a live vocal effects box for karaoke: mic in → a
user-composed chain of Web Audio effects (gain, compressor, EQ, delay,
reverb, limiter) → speakers out, in the browser, fully offline. Success
means: a show that never breaks because of the app (emergency bypass is
always one human action away), a sound the operator can shape without
engineering knowledge (cycle 2: by plain-language prompting through an
in-browser AI agent), and a piece the developer is proud to show as
portfolio work.

## Positioning

A zero-install, browser-based live vocal chain builder that (a) runs with
**zero runtime internet dependency** — a deliberate contrast to every
cloud/plugin DAW and web-audio toy — and (b) as of cycle 2 exposes its whole
chain-building surface as **WebMCP tools, so an in-browser agent (Gemini in
Chrome) can build and edit chains from natural language** while the app
itself stays LLM-free. Neighboring products could copy one of these truths;
the combination (offline-safe live tool + agent-controllable) is the claim.

## Operating Context

- **Event mode**: dark venue, laptop + USB mic + PA, Chrome-only (explicitly
  recommended; other browsers untested by scoped decision). Setup happens in
  the window before doors; during the show nobody touches anything but
  Bypass (button or spacebar). Running via `start.bat` / `start.command`
  (local `python http.server`, port 8000).
- **Rituals**: "when in doubt, hit Bypass first"; presets saved per event
  type; chain autosaves to localStorage.
- **Portfolio mode**: a fresh Chrome profile following the README (cycle 2
  adds an agent-enable section) on localhost; a dev test harness doubles as
  the agent-free demo path.
- **Terminology in-viewport today**: MIC IN / OUT anchors, Palette, chain,
  presets, Bypass: ON/OFF, Start/Stopped status.

## Capabilities and Constraints

Confirmed functionality: 10 node types (gain, compressor, EQ, delay, reverb,
limiter, plus cycle-3's noise gate, distortion, chorus, autotune — autotune
flagged experimental in the UI and the agent capabilities readout) registered
through a type registry; drag-and-drop build/reorder (vendored SortableJS
1.15.7); per-node param sliders plus dropdown selects for discrete params
(autotune's key/scale); named presets + autosave (localStorage); emergency
bypass (audio path + spacebar); gated disabled-until-started states.

Cycle-2 additions (approved scope): WebMCP server shim (feature-detected,
silent no-op when unavailable), 10 tools (`get_capabilities`, `get_chain`,
`set_chain`, `add_node`, `remove_node`, `set_param`, `list_presets`,
`save_preset`, plus `get_preset`/`load_preset`, which joined the planned
eight during cycle-2 production) with validation/loudness clamps; auto-apply
+ change summary + one-click undo; agent-activity chip; input/output meters;
status readouts. Cycle 3 extended the same tools to discrete string params
(key/scale) and added the experimental badge to the capabilities readout —
no new tools.

Hard constraints (user-approved, cycle 1 & 2): vanilla JS, **no build step**;
zero runtime internet dependency; localStorage persistence; no in-app LLM /
API keys / cloud calls; agent never controls bypass, engine start/stop, or
mic device selection; no new effect node types this cycle; Chrome-only
recommendation stands; no layout/IA redesign (3-column arrangement and all
existing flows persist).

Explicitly undecided product facts (recorded, not invented):

- **Brand voice** — current copy is plain-friendly (see README); a
  terse hardware-manual voice was flagged as an open direction, undecided.

## Brand Commitments

- Product name (chosen by the user 2026-08-29): **"VOXCHAIN"**
  — shown in the top bar and README.
- No logo, mark, or visual brand assets exist. **Absence is real: do not
  fabricate brand imagery, testimonials, users, or metrics.**
- Approved design direction (cycle-2 town-hall): dark pro-audio console —
  this is the one binding visual-world commitment.

## Evidence on Hand

- `README.md` — real end-user documentation (event-operator voice).
- `docs/ultron/` — approved cycle-2 scoping brief; `docs/ultron/cycle-1/` —
  full cycle-1 record: plan, production log, QA scripts (including the
  Chrome-only cross-browser decision and its replayable script), research.
- `assets/ir/plate-vocal.mp3` — real reverb impulse-response asset (license
  provenance recorded in cycle-1 research).
- `vendor/sortable.min.js` — vendored dependency (MIT).
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
5. **Brother-usable.** Every capability must survive a non-engineer
   operating it alone at setup time, under time pressure.
6. **One page.** The app is and stays a single page — no routes, no
   sub-pages (the ?dev harness is a gated overlay on the same page).
   Added 2026-08-28 by user direction.

## Accessibility & Inclusion

- WCAG **AA contrast is an approved acceptance gate** for the cycle-2 dark
  theme (all text labels), with visible focus states and preserved keyboard
  flows (incl. spacebar bypass) — approved in town-hall, non-negotiable.
- Distance readability in dark venues is a functional a11y requirement, not
  a nicety.
- Natural-language (agent) control is recognized as an accessibility win
   for non-technical operators (approved framing).

## Brand (user decision, 2026-08-30)

The product name is **VOXCHAIN** (displayed uppercase in the silkscreen
identity register). Prior working title "Karaoke Chain Builder" retired.
Deliberately unchanged: localStorage keys (`karaoke-*-v1` — renaming
would orphan saved chains/presets), the GitHub repo + Pages domain
(karaoke.arrangedgodly.com — infra rename is the owner's call), and the
genre word "karaoke" in prose.
