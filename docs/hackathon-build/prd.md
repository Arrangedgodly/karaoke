# Product requirements document

## Product summary

VoxChain is a single-page live vocal-chain builder for people who know the sound they want but do not want to translate that idea into audio-engineering settings. A home karaoke host starts the microphone, tests the default or restored chain, and asks an external WebMCP-capable browser agent for a result in plain language. The agent reads the same live state the host sees and changes the same chain the host can edit by hand.

The product must make that collaboration easy to follow. The first visible proof is the chain itself changing. Module order, effect controls, agent status, a plain-language summary, and Undo explain what happened. Safety rules remain stronger than either control path. The person alone controls microphone access, device choice, engine start, Bypass, warning dismissal, and recovery after a repeated watchdog event.

The contest release is a focused polish and verification pass on the newly landed interface. It is not another redesign. Chain readability comes first, followed by the hardware-inspired studio character and agent feedback.

## Target user

The primary user is a home karaoke host preparing a live microphone for friends or family. They can describe a desired vocal result, such as warmer, clearer, wider, gritty, or more spacious, but may not know which effects or values will produce it.

The host needs to:

- Start a microphone session without wondering whether the browser is ready.
- Hear a useful default or previously saved chain immediately after startup.
- Ask for a sound using ordinary language through an external browser agent.
- See every accepted agent change on the mixing board.
- Reverse agent work without reconstructing the prior chain.
- Download a prompted result as a personal preset and import presets shared by other VoxChain users.
- Keep immediate control when audio becomes unsafe or simply sounds wrong.

Streamers, gamers, and other live-voice users remain part of the broader product story. They do not add separate contest requirements.

## Core user journey

1. The host opens VoxChain and sees a clear startup gate. Start is the dominant available action. The vocal board behind the gate is empty and cannot be edited.
2. The host presses Start. VoxChain requests microphone access and waits for a usable input.
3. On success, VoxChain removes the gate, marks the engine Live, activates the board, and shows moving input feedback when the host speaks.
4. A returning host receives the last autosaved chain. A fresh browser profile receives the built-in default chain.
5. The host speaks a few test words and can tune the chain manually or continue to the agent.
6. In the external browser agent, the host asks: "Make this karaoke vocal warmer and clearer, with light hall reverb, without making it louder."
7. The agent reads VoxChain's capabilities and current chain, then applies safe WebMCP changes. Modules appear or reorder on the board as accepted changes land.
8. VoxChain reports each accepted mutation in plain language and offers Undo. The host speaks again to hear the result.
9. The host saves the prompted result as a personal preset and downloads a portable preset file that another VoxChain user can import.
10. The host or judge asks the agent to remove the terminal limiter. VoxChain refuses, explains the rule, and leaves the chain unchanged.
11. The host demonstrates Bypass to prove that the person retains immediate authority over the live sound.

## Epics and user stories

### Epic 1: Safe microphone startup

#### Story 1.1: Start before editing

As a home karaoke host, I want VoxChain to guide me through microphone startup before it exposes the mixing board, so I do not edit a chain that is not connected to live audio.

Acceptance criteria:

- On first load, Start is the clearest available action.
- An opaque startup gate covers the vocal board.
- No effect modules or editable chain controls appear before successful startup.
- Mouse, touch, and keyboard input cannot edit the gated board.
- Read-only agent requests may describe capabilities or the stopped state.
- Agent mutation requests before Start are refused, change nothing, and tell the agent and host that a person must start the engine first.

#### Story 1.2: Successful startup

As a host, I want unmistakable confirmation that microphone startup succeeded, so I know when it is safe to test and edit the chain.

Acceptance criteria:

- Pressing Start triggers the browser microphone-permission request.
- The startup gate remains until microphone access and engine startup both succeed.
- After success, the gate disappears and the board becomes interactive.
- A returning session restores its last autosaved chain.
- A fresh session loads the built-in default chain.
- The engine status reads Live.
- The input meter responds when the host speaks.
- Effect controls, presets, and manual chain actions become available only after success.

#### Story 1.3: Startup recovery

As a host, I want specific recovery instructions when startup fails, so I can correct the problem without guessing.

Acceptance criteria:

- If the host denies microphone permission, VoxChain displays a prominent message explaining that microphone access is required.
- The permission message offers Retry.
- The message includes short instructions for reopening microphone permission in the current browser.
- If no microphone is available, the message asks the host to connect one and offers Retry.
- The board remains gated after every failed startup attempt.
- VoxChain never displays Live or active meters after a failed attempt.
- If a live microphone disconnects, audio stops, the board locks again, and the current chain remains preserved for the next successful start.
- A disconnect message tells the host to reconnect the device and restart the session.

### Epic 2: Understand and control the vocal chain

#### Story 2.1: Read the signal path

As a host, I want to understand effect order at a glance, so I can predict how the voice is being processed.

Acceptance criteria:

- The active modules are more visually prominent than secondary controls and decoration.
- Module order remains readable without requiring the user to understand cable-routing conventions.
- Every module shows its effect name and current values.
- The terminal limiter is visibly part of the chain.
- Input and output state remain visible while the host edits.
- Warm LCD-style displays, knobs, labels, and studio-console materials support readability rather than obscuring it.
- If limited time forces a tradeoff, chain order and module labels remain clear before adding animation or decorative hardware detail.

#### Story 2.2: Edit by hand

As a host, I want direct control over the same chain the agent changes, so I can make quick corrections without asking the agent again.

Acceptance criteria:

- The host can add, remove, reorder, and tune permitted effects after startup.
- Manual adjustments update the audible chain and visible values together.
- Moving or resizing a module for layout does not silently change effect order or sound.
- A completed reorder changes the visible order and audible processing order together.
- An abandoned reorder leaves the prior chain and sound unchanged.
- The terminal limiter cannot be removed or placed before another effect.
- Bypass remains reachable from the interface and keyboard during the live session.

### Epic 3: Collaborate with an external browser agent

#### Story 3.1: Describe a result in plain language

As a host, I want to ask for a vocal result without naming processors or parameter values, so I can build a useful chain using the language I already know.

Acceptance criteria:

- The contest path uses a WebMCP-capable external browser agent.
- VoxChain does not require an API key, account, browser extension, separate MCP server, or in-app model connection.
- The agent can discover what effects, parameters, presets, and safety rules VoxChain supports.
- The agent can read the current chain before deciding what to change.
- The accepted demo prompt can produce a warmer, clearer vocal with light hall reverb while respecting the request not to raise loudness.
- VoxChain remains fully usable by hand when no agent is present.
- A prompt box or copyable prompt inside VoxChain is deferred and is not required for contest readiness.

#### Story 3.2: Watch the agent work

As a host, I want accepted agent actions to appear on the board as they happen, so I can connect the plain-language request to the resulting audio decisions.

Acceptance criteria:

- Every accepted mutation changes the visible board and live chain together.
- Structural changes make added, removed, or reordered modules visible immediately after acceptance.
- Parameter changes update the affected control without replacing unrelated modules.
- The first visual proof is the changed module arrangement, followed by control values and the change summary.
- Agent activity has a visible state, so the host can tell whether tools are ready, active, unavailable, or rejected.
- An agent request arriving during an unfinished human reorder waits until the human action completes.
- Human and agent actions never produce two competing versions of the chain.

#### Story 3.3: Understand and undo agent changes

As a host, I want a concise explanation and reliable Undo after agent work, so I can experiment without losing control.

Acceptance criteria:

- Every accepted agent mutation produces a one-line summary naming the action and affected effect.
- Summaries include important values when a single parameter changes.
- Every accepted mutation creates one matching Undo action.
- Undo restores the exact prior chain order, module set, parameter values, and relevant preset state.
- Ctrl or Cmd plus Z can recover the newest available agent change after its notification disappears.
- If the host manually edits the chain after an agent change, Undo warns before replacing that newer human work.
- A conflicted Undo applies only after explicit human confirmation.
- If Undo fails, VoxChain says it failed and keeps the recovery action available for another attempt.

#### Story 3.4: Refuse unsafe or invalid requests

As a host, I want VoxChain to reject unsafe agent instructions visibly, so I can trust the agent without trusting every request.

Acceptance criteria:

- Removing the terminal limiter is refused.
- Values outside a hard safety range are refused or safely constrained according to the published rule for that control.
- A refusal changes no module, value, audible state, preset state, or saved state.
- A refusal explains what was requested and why VoxChain rejected it.
- A refusal does not create an Undo action because nothing changed.
- The agent receives enough information to make a corrected request.

### Epic 4: Protect the live output

#### Story 4.1: Keep safety under human authority

As a host, I want one immediate way to escape a bad sound, so the event can continue even if an effect or agent choice is wrong.

Acceptance criteria:

- Bypass is visually prominent whenever the engine is live.
- The host can toggle Bypass using the on-screen control or spacebar.
- Bypass changes the output immediately enough to function as an emergency action.
- The agent cannot start or stop the engine, choose a microphone, toggle Bypass, dismiss warnings, or perform repeated-trip recovery.
- The output ceiling remains active and unavailable for user or agent removal.
- Status text distinguishes normal processing, Bypass, muted output, and stopped audio.

#### Story 4.2: Recover from a watchdog event

As a host, I want VoxChain to remain muted after detecting an unsafe signal until I choose to restore it, so it cannot automatically reopen into the same feedback or peak condition.

Acceptance criteria:

- When VoxChain detects an unsafe peak or howl condition, it mutes output immediately.
- The warning describes the detected reason and does not call every watchdog event a crash.
- The warning remains visible until a person acts on it.
- The warning clearly states why VoxChain muted the output.
- Output remains muted until the host presses Restore Output or chooses Bypass for the dry microphone path.
- The agent cannot restore output or dismiss the warning.
- Bypass remains available throughout watchdog handling.

### Epic 5: Preserve work and recover honestly

#### Story 5.1: Restore the last session

As a returning host, I want VoxChain to remember my chain, so I do not rebuild the setup before every karaoke session.

Acceptance criteria:

- Accepted chain edits save automatically during the session.
- Reloading and starting again restores the last successfully saved chain and its layout.
- A fresh profile loads the built-in default chain instead.
- The restored chain obeys the same limiter and parameter rules as a newly built chain.
- Failed or rejected agent work does not replace the last accepted saved state.

#### Story 5.2: Warn about persistence failure

As a host, I want to know when changes cannot be saved, so I do not assume they will survive a reload.

Acceptance criteria:

- If autosave fails, the live audio session and accepted chain continue to work.
- A persistent warning says that current changes may not survive a reload.
- The warning clears only after saving succeeds again or the session ends.
- VoxChain does not claim that a failed save succeeded.
- Undo remains associated with the live accepted change even when its save failed.

#### Story 5.3: Use factory and personal presets

As a host, I want reliable starting points and reusable personal chains, so setup does not begin from an empty board.

Acceptance criteria:

- Factory presets remain available on a fresh profile.
- Loading a preset replaces the visible and audible chain together.
- The interface shows which preset is loaded and whether the chain has unsaved manual changes.
- The host can save, load, overwrite, and delete personal presets.
- Agent preset actions produce the same visible result, safety checks, summaries, and Undo behavior as direct actions.
- A failed preset save does not appear in the list or clear an unsaved indicator.

#### Story 5.4: Share a personal preset

As a host, I want to download and import personal preset files, so I can share a sound created through prompting without requiring an account or server.

Acceptance criteria:

- Every saved personal preset has a clearly labeled Download action.
- Download creates a human-readable JSON file named with the preset name and the `.voxchain-preset.json` suffix.
- The file contains a format version, preset name, ordered effect nodes, and parameter values. It contains no microphone details, audio, board positions, autosave history, browser data, or account information.
- The Presets panel has an Import action after the engine starts.
- Import accepts one JSON file no larger than 64 KiB and shows the preset name and effect count before saving it.
- VoxChain validates the file version, structure, node types, parameters, terminal limiter, node count, gain budget, and other published chain rules before changing storage.
- A malformed, unsupported, unsafe, or currently unavailable effect is rejected with a specific explanation. Nothing is saved or loaded.
- A duplicate personal preset name requires the host to rename the import, explicitly replace the existing preset, or cancel.
- A successful import appears in the personal preset list but does not change the live chain until the host presses Load.
- Import failure or storage failure does not create a partial or phantom preset.
- Import and Download do not add WebMCP tools, start audio, change Bypass, or create a chain Undo entry.
- A downloaded file from the contest build can be imported into a fresh contest build and then loaded to reproduce the same ordered chain and values.

### Epic 6: Present a contest-ready release

#### Story 6.1: Complete the judge path

As a judge, I want a short path from opening the page to seeing WebMCP control a real audio utility, so I can understand the project without setup archaeology.

Acceptance criteria:

- The deployed page loads over HTTPS and presents Start without an account or API key.
- The normal deployed page exposes the documented WebMCP capabilities to the supported judging browser.
- The judge can start a microphone, hear the default or restored chain, run the accepted demo prompt, see visible changes, use Undo, and trigger a limiter refusal.
- The live behavior matches the public video and written judge instructions.
- The main demonstration fits within a public video shorter than three minutes and includes audible speech.
- The video uses spoken or owned audio and does not depend on copyrighted karaoke music.

#### Story 6.2: Release the Tone.js effects responsibly

As a host, I want optional voice effects to ship only when they behave safely with a real microphone, so contest breadth does not weaken the core demo.

Acceptance criteria:

- Pitch Shift, Tremolo, Bitcrusher, and Phaser each receive an individual real-microphone smoke test.
- Each shipped effect produces an audible result, remains controllable, and does not introduce an unacceptable click, runaway level, broken Bypass, or broken limiter path.
- An effect that fails its smoke test is absent from the contest palette and agent capability list.
- No contest preset depends on a hidden effect.
- Hiding a failing effect does not remove its implementation from later development work.
- The repository includes the full MIT license notice referenced by the vendored Tone.js file.
- The public third-party notice identifies Tone.js, its version, its license, and its role in VoxChain.

## Edge cases

- Before Start, read-only agent requests work, but every mutation is refused without changing the empty board.
- Permission denial, no connected microphone, startup failure, and mid-session device disconnection each keep or return the product to a truthful stopped state.
- A returning session restores its autosaved chain only after successful startup. A fresh session receives the default chain.
- If the host abandons a reorder, the prior order and audio remain unchanged.
- If an agent request arrives during a human reorder, it waits rather than interleaving with the gesture.
- If the host edits after an agent mutation, Undo asks before overwriting the newer human state.
- Invalid or unsafe agent input produces a visible refusal and no Undo entry.
- If autosave fails after a live change, the change remains audible and visible while the warning explains the reload risk.
- A watchdog event remains muted until a person restores output or uses Bypass.
- If a Tone.js effect fails physical testing, the contest build hides that effect everywhere a host or agent could select it.
- Importing a file with invalid JSON, an unsupported format version, duplicate node IDs, a missing or non-terminal limiter, an unavailable effect, or values outside the accepted policy saves nothing.
- Importing a preset whose name already exists never overwrites it without explicit human confirmation.
- Canceling the file picker or duplicate-name prompt changes nothing.
- A chain reduced to the required limiter remains valid, but the interface must still make the near-empty signal path understandable.

## What we are building

- A gated, microphone-first startup experience.
- Clear startup, permission, missing-device, disconnect, Live, Bypass, and watchdog states.
- A readable studio-style chain whose modules and order remain the primary information.
- Direct human editing and external-agent editing of one shared chain.
- Plain-language WebMCP control with visible accepted changes, refusals, summaries, and reliable Undo.
- Autosave, factory presets, personal presets, and honest save-failure feedback.
- Download and import of validated personal preset files, with no account or backend.
- Conditional release of the four Tone.js effects after physical testing and license completion.
- The existing watchdog latch with explicit human recovery.
- A deployed, documented, reproducible contest demo.

## What we would add with more time

- An in-app prompt field connected to a chosen model or browser-agent handoff.
- Copyable prompt suggestions and guided sound recipes inside VoxChain.
- Dedicated workflows for streaming, games, podcasting, and voice-character effects.
- Recording, before-and-after playback, and audio export.
- Accounts and optional cloud preset synchronization.
- Shareable preset URLs, public preset pages, searchable community libraries, ratings, and moderation.
- Broader browser support and mobile-specific layouts.
- More effects, routing options, and advanced multi-chain workflows.
- A larger redesign or cable-system rethink after the contest evidence is secure.
- Conditional watchdog auto-recovery backed by an independent pre-mute safety monitor.

These items stay out because the remaining 8 to 16 combined hours must protect live audio, WebMCP discovery, chain readability, deployment, and the demo.

## Submission proof points

- A fresh judge can open the deployed page and understand that Start is required before editing.
- A real microphone activates the board, meters, default or restored chain, and live status.
- The external browser agent can read capabilities and current state through WebMCP.
- The accepted karaoke prompt produces visible modules, audible processing, a readable summary, and Undo.
- A limiter-removal request produces a visible refusal and no state change.
- A prompted chain can be saved, downloaded, imported in a fresh browser profile, and loaded with the same safe order and values.
- Manual controls and agent actions change the same board rather than separate hidden state.
- Bypass proves immediate human authority.
- The public video demonstrates the complete path with audio in under three minutes.
- Dated documentation and commit history separate the pre-existing audio utility from the WebMCP work added during the contest period.
- The public repository contains its own open-source license and complete notices for shipped third-party components.
