# Hackathon build notes

## Guided build onboarding

- Date: 2026-08-31
- Interview rounds: 3
- Project confirmed: VoxChain
- Primary user chosen: home karaoke host
- Core judge path: enable microphone access, test the default chain, load an agent, describe the desired vocal sound in plain language, then inspect and hear the complex chain produced through WebMCP.
- Release must-have: plain-language prompting through WebMCP.
- Initial Tone.js decision: defer the four new effects because of possible third-party and audio risk. The scope interview later superseded this after checking the live rules and MIT license.
- Visual direction: recording-studio atmosphere, Ableton and FL Studio influence, warm LCD-style hardware displays.
- Layout decision: cables are not protected scope. A clearer layout may remove them if signal order stays visible.
- Intended memorable moment: "WebMCP prompt simplicity to power ratio."

## Active shaping moments

- Grady replaced the broader creator-audience lead with the project’s real origin: a home karaoke host.
- Grady explicitly chose plain-language prompting as the release requirement.
- Grady cut the four new Tone.js effects from contest scope instead of defending sunk work.
- Grady made the cable concept optional, leaving room for a stronger production layout.

## Scope

- Date: 2026-08-31
- Mandatory interview batches: 4
- Deepening rounds: 1
- Estimated remaining capacity: 8 to 16 combined focused hours, with work divided by task between Grady and his brother.
- Primary release goal: show a home karaoke host using plain language in an external browser agent to build or tune the visible live vocal chain through WebMCP.
- Main demo prompt accepted: "Make this karaoke vocal warmer and clearer, with light hall reverb, without making it louder."
- First visible agent proof: modules appearing or reordering. Parameter movement, the change summary, and Undo follow.
- Failure behavior: if microphone permission or engine startup fails, stop and explain the required recovery. Do not offer a silent mutation demo before Start.
- Visual priority: chain readability outranks hardware character and agent animation when time forces a choice.
- Interface boundary: polish the newly landed interface. Do not start another redesign.
- Prompt boundary: use the external browser agent for contest execution. A displayed or copyable example prompt is allowed, but an in-app LLM connection is not contest scope.
- Tone.js rule check: the live contest rules allow open-source software when the entrant complies with its license. Tone.js is MIT-licensed.
- Tone.js release gate: ship each of Pitch Shift, Tremolo, Bitcrusher, and Phaser only after a focused real-microphone smoke test. Hide a failing effect from the contest registry and interface without deleting its implementation.
- Licensing follow-up: add the full `Tone.js.LICENSE.txt` notice referenced by `vendor/tone.min.js`; retain `THIRD_PARTY_NOTICES.md`.
- Personal motivation captured: "building my own audio utility from scratch is insanely cool to me."
- Scope document: `docs/hackathon-build/scope.md`

## Scope cuts

- No second redesign, in-app LLM integration, recording/export, accounts, analytics, cloud storage, new effect types, broad persona workflows, or browser-expansion work.
- No cable-system rebuild unless the current interaction blocks chain readability or the judge path.
- Streamers and gamers remain future-use evidence, not the lead demo audience.

## Scope active shaping moments

- Grady clarified that hardware homage is desirable. The design should not avoid hardware cues merely because Ableton uses a flatter software presentation.
- Grady changed the Tone.js decision after asking for a rule and license check. The effects moved from an automatic cut to a physical-test release gate.
- Grady accepted the external browser agent for the contest while preserving an in-app prompt experience as a later direction.
- Grady chose an honest hard stop when microphone startup fails instead of allowing a silent agent-edit shortcut.
- Grady chose chain readability as the first visual priority.

## Product requirements

- Date: 2026-08-31
- Mandatory interview batches: 5
- Deepening rounds: 0. Grady chose to write the PRD after the mandatory behavior and edge-case decisions.
- Startup hierarchy: Start is the dominant initial action. An opaque gate covers an empty, non-interactive board until microphone startup succeeds.
- Successful startup: remove the gate and load the last autosaved chain, or the built-in default chain on a fresh profile.
- Permission failure: explain why microphone access is required, offer Retry, and provide browser-permission recovery instructions.
- Missing microphone: keep the board locked, ask the user to connect a device, and offer Retry.
- Device disconnect: stop audio, lock the board again, preserve the chain, and explain how to reconnect and restart.
- Existing agent behavior is accepted as the product requirement: transactional mutations, visible one-line summaries, one Undo entry per accepted mutation, no changes or Undo for refusals, queued agent work during a human gesture, and confirmation before a stale Undo replaces newer human work.
- Autosave rule: restore the last accepted saved chain after Start. Use the default chain only for a fresh profile.
- Autosave failure: keep the live session working and show a persistent reload-risk warning.
- Prompt suggestion: defer the in-app copyable example prompt. The contest uses the external browser agent.
- Initial PRD watchdog direction: mute immediately, restore once automatically after the signal is safe, then require explicit human recovery after a quick repeat.
- Spec-stage correction: Grady accepted cutting automatic watchdog recovery after the architecture review showed that the muted output meter cannot prove the processed signal is safe. The contest build keeps the tested human-only Restore Output latch.
- PRD document: `docs/hackathon-build/prd.md`

## PRD active shaping moments

- Grady stopped the interview from re-specifying agent behaviors that the existing code already handles. The PRD treats those tested behaviors as requirements.
- Grady preserved autosave restoration and chose the default chain only for a fresh browser profile.
- Grady deferred the in-app prompt field to protect the 8 to 16 hour release budget.
- Grady explored conditional automatic watchdog recovery, then accepted moving it after the contest when the spec review exposed the required pre-mute monitor and added audio risk.

## Technical specification

- Date: 2026-08-31
- Mandatory interview batches: 5, completed across the existing stack, deployment, architecture, file structure, and data-flow review.
- Deepening rounds: 0. Grady accepted the final startup-recovery decision and moved to the document.
- Stack decision: preserve vanilla HTML, CSS, and JavaScript; Web Audio and AudioWorklets; browser-native WebMCP; localStorage; vendored Tone.js; zero-dependency Node tests; and the existing Cloudflare Worker Git deployment.
- Deployment decision: `main` is the production branch and [https://voxchain.arrangedgodly.com/](https://voxchain.arrangedgodly.com/) is the release URL. Cloudflare configuration remains outside the repository.
- Architecture decision: `src/chain-editing.js` remains the only accepted mutation boundary for startup, human edits, agent edits, preset loads, and Undo.
- Startup recovery decision: Grady accepted the existing inline status sentence and Start-hint recovery instead of adding a new modal. The message must explain the cause, preserve the stopped gate, offer Retry, and give browser-permission steps when needed.
- Watchdog decision: keep the tested human-only Restore Output latch. Automatic recovery stays after the contest because it needs an independent pre-mute monitor.
- Tone.js decision: ship each of the four effects only after a physical mic and PA test. A failed effect loses only its production script include and remains in source for later work.
- Confirmed release gaps: add `vendor/Tone.js.LICENSE.txt`, run physical tests, verify all ten WebMCP tools on the deployed normal URL, confirm Cloudflare's `main` deployment, and capture submission evidence.
- Baseline gate: `node tests/run.js` passed 35 of 35 files and 2,560 checks.
- Local release risk: Git currently rejects repository inspection because of an ownership or safe-directory mismatch. The person performing the push must correct this without weakening repository safety globally.
- Specification document: `docs/hackathon-build/spec.md`

## Spec active shaping moments

- Grady rejected unnecessary re-specification of tested behavior. The plan maps existing modules and focuses implementation work on confirmed gaps.
- Grady accepted inline microphone recovery, so the contest plan does not add a modal solely to satisfy earlier wording.
- Grady kept the free-board interface as the release base while making chain readability the first polish criterion.
- Grady added preset sharing as a must-ship release feature after the first spec was written. The contest implementation is portable download and import files. Server-backed links and a public preset community stay later work.
- Preset transfer decision: reuse the existing versioned `PresetSchema` JSON shape, cap imports at 64 KiB, validate the full safety policy before storage, require an explicit collision choice, and leave the live chain unchanged until Load.
- WebMCP boundary: preset transfer does not add an eleventh tool. The existing agent can save the prompted chain, then the person downloads it from the Presets panel.

## Build checklist draft

- Date: 2026-09-01
- Planning owner: Codex. Grady handed off sequencing and task design.
- Proposed build mode: autonomous.
- Proposed verification pauses: preset-transfer UI, chain-readability review, physical audio and Tone.js decision, and deployed WebMCP judge path.
- Proposed check-in cadence: speed-run, with updates only at named pauses or genuine blockers.
- Confirmed wow moment: plain-language prompt to visible and audible complex chain to saved downloadable preset.
- Draft size: 12 atomic items. Risky shared preset-policy validation comes before transfer UI. Physical audio and production verification come after the code freeze. Devpost handoff is last.
- Deepening rounds: 0 on the handoff path. The required workload gut-check remains open before the checklist is locked.
- Draft checklist: `docs/hackathon-build/checklist.md`
