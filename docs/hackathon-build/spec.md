# Technical spec

## Overview

VoxChain will ship as the existing static, single-page browser application. The contest work is a release pass, not a framework migration. It will preserve the tested audio engine, shared chain model, ten page-scoped WebMCP tools, local persistence, and current Cloudflare deployment path.

The release target is one short judge flow. A person starts the microphone, hears the default or restored chain, asks an external browser agent for a warmer and clearer karaoke vocal with light hall reverb and no loudness increase, watches the visible chain change, then demonstrates Undo, a limiter refusal, and Bypass.

The implementation priority is:

1. Protect startup, live audio, Bypass, limiter, watchdog, and the accepted mutation path.
2. Make module order and agent changes easy to read in the current interface.
3. Verify page-scoped WebMCP discovery and execution on the deployed URL.
4. Add safe personal-preset download and import without changing the ten-tool WebMCP contract.
5. Ship each Tone.js effect only after a real-microphone test and complete its license notice.
6. Capture reproducible contest evidence.

## Stack

| Area | Choice | Release reason |
| --- | --- | --- |
| Page | Vanilla HTML and CSS | The current page is complete and tested. A React or build-system migration would add risk without improving the judge path. |
| Application code | Plain JavaScript IIFEs exposed through narrow `window.*` namespaces | This matches the repository and keeps the app runnable without dependency installation or bundling. |
| Audio | Web Audio API, AudioWorklet, and MediaDevices | These APIs already power microphone input, DSP, meters, device changes, and the watchdog. |
| Optional DSP | Vendored Tone.js 15.1.22 | It backs Pitch Shift, Tremolo, Bitcrusher, and Phaser. Each effect has a physical release gate. |
| Agent control | Browser-native WebMCP through `document.modelContext` | The external browser agent discovers ten page-scoped tools from the normal page. No separate MCP server or extension is needed. |
| State | In-memory chain model plus `localStorage` | One accepted model drives audio, canvas, presets, Undo, and autosave. No server database is needed. |
| Tests | Zero-dependency Node test files loaded in isolated VM sandboxes | `node tests/run.js` works from a clean clone and covers the contracts that do not require a microphone or browser client. |
| Hosting | Existing Cloudflare Worker deployment with Git integration from `main` | Pushes deploy automatically. The repository does not need Wrangler or a new CI pipeline for the contest. |

No new framework, backend, model API, package manager, or state library will be added before submission.

## Architecture

### Startup and lifecycle controller

Implements: `prd.md > Epic 1: Safe microphone startup`

`src/main.js` owns the person-triggered Start flow and coordinates the modules that must become live together. `src/audio-engine.js` owns microphone permission, the `AudioContext`, active stream, device switching, and stream-loss events.

Before Start, `#chain-layout` keeps the board gated and empty. Read-only WebMCP tools may report capabilities or stopped state. Mutating tools return an engine-not-started refusal. After a successful user gesture, startup loads the last valid autosave or the built-in default, applies it through `ChainEditing`, connects Bypass and meters, then removes the gate.

Startup failures remain inline. The existing status sentence and Start hint explain permission denial, missing hardware, busy devices, browser security, and Retry steps. A new modal is not required for the contest. A device disconnect stops audio, restores the gate, and preserves the saved chain for the next Start.

### Shared chain mutation boundary

Implements: `prd.md > Epic 2: Understand and control the vocal chain`, `Epic 3: Collaborate with an external browser agent`, and `Epic 5: Preserve work and recover honestly`

`src/chain-editing.js` is the only accepted write path for startup restore, human edits, preset loads, agent calls, and Undo. Every caller supplies a source and a proposed change. The boundary validates session state, serializes overlapping operations, updates the live graph, renders the accepted state, updates preset display state, and attempts autosave.

Human gestures have priority. Agent work that arrives during an unfinished cord gesture waits until the human action commits or reverts. An accepted agent mutation stores one exact before-state in `AgentUI`. A refusal changes no graph, canvas, preset state, saved state, or Undo stack.

UI work must keep this boundary intact. It may change presentation and copy, but it must not create a second chain array or write directly to `AudioGraph` from a new control.

### Audio graph and effect registry

Implements: `prd.md > Epic 2: Understand and control the vocal chain`, `Epic 4: Protect the live output`, and `Epic 6 > Story 6.2: Release the Tone.js effects responsibly`

`src/audio-graph.js` owns the ordered model-to-audio translation. The logical node shape is `{ id, type, params }`. The graph reuses compatible live nodes, ducks the shared chain gate during structural rewires, disposes removed nodes, and keeps a protected output attenuator and terminal limiter rule.

Each `src/node-*.js` file registers its DSP factory with `AudioGraph` and its label, parameter contract, and live parameter writer with `NodeTypes`. `src/param-controls.js` can therefore render controls without effect-specific UI code. `src/audio-param-ramp.js` applies the common 15 ms parameter ramp.

`src/tone-adapter.js` connects Tone.js nodes to the app's authoritative `AudioContext`, wraps them in native input and output nodes, ramps supported Tone parameters, and disposes internal Tone resources. Removing one Tone-backed effect from the contest build requires removing only that effect's production `<script>` include from `index.html`. The registry-driven palette and WebMCP capability response will then omit it while the source and tests stay in the repository.

### Chain and studio interface

Implements: `prd.md > Epic 1`, `Epic 2`, and `Epic 3 > Story 3.2: Watch the agent work`

`index.html`, `styles/main.css`, `src/canvas.js`, `src/param-controls.js`, and `src/status-readouts.js` form the visible studio. The current two-deck structure remains. The release polish should improve signal-order reading, module labels, spacing, responsive behavior, focus treatment, and agent-state visibility without renaming established IDs or changing the order contracts used by JavaScript and tests.

The chain is the main proof of agent work. Accepted structural changes must be visible before decorative motion. Warm LCD styling and hardware cues are useful only when labels, order, values, input state, output state, and Bypass remain readable.

The current free-position board and cord-based reorder remain unless a reproducible judge-path failure forces a narrow repair. The release will not introduce a second board design.

### WebMCP registration and policy

Implements: `prd.md > Epic 3: Collaborate with an external browser agent` and `Epic 4: Protect the live output`

`src/mcp-server.js` adapts VoxChain definitions to the browser's `document.modelContext.registerTool()` API and reports registration state to `AgentUI`. `src/mcp-tools.js` owns the ten tool definitions, JSON schemas, descriptions, safety rules, structured results, and calls into `ChainEditing`.

The registered tool set is:

- Read-only: `get_capabilities`, `get_chain`, `list_presets`, `get_preset`.
- Mutating: `set_chain`, `add_node`, `remove_node`, `set_param`, `load_preset`, `save_preset`.

The tool policy protects the terminal limiter, rejects nodes after it, constrains parameter ranges, and keeps Start, microphone choice, Bypass, warning dismissal, and watchdog recovery outside agent authority. `src/mcp-harness.js` remains a `?dev` diagnostic only. It is not part of the contest judge path.

### Agent feedback and Undo

Implements: `prd.md > Epic 3 > Story 3.2`, `Story 3.3`, and `Story 3.4`

`src/agent-ui.js` owns ready, working, unavailable, accepted, refused, and Undo feedback. Each accepted agent action creates one summary and one Undo record. A manual edit after an agent action marks the record as conflicted, so restoring it requires explicit human confirmation. Failed Undo remains available for another attempt.

The release polish may clarify this feedback, but it must preserve exact transaction boundaries. A single tool call cannot create multiple Undo entries, and a refusal cannot create any.

### Safety, Bypass, meters, and watchdog

Implements: `prd.md > Epic 4: Protect the live output`

`src/audio-bypass.js` owns the independent dry microphone route and shared gate changes for the prominent button and spacebar shortcut. `src/meter-taps.js`, `src/meters.js`, and `src/watchdog-worklet.js` monitor and display input and output state.

When the watchdog detects a sustained peak or rising howl, it mutes the processed output and latches a reasoned warning. Only the person can press Restore Output. Bypass remains available as the dry emergency route. The contest release will not add automatic recovery because the current post-mute output tap cannot independently prove that the processed pre-mute signal is safe.

### Persistence and presets

Implements: `prd.md > Epic 5: Preserve work and recover honestly`

`src/persistence.js` stores the accepted chain and free-board layout under `karaoke-autosave-v1`. `src/preset-store.js` stores personal presets under `karaoke-presets-v1`. `src/preset-schema.js` validates and migrates stored data. `src/default-preset.js` provides the fresh-profile chain, while `src/factory-presets.js` provides shipped starting points. `src/presets-ui.js` renders factory and personal groups and tracks the current preset's modified state.

Autosave failure does not roll back live audio. It latches a visible reload-risk warning until a later verified save succeeds. Failed or rejected agent work never replaces the last accepted saved state.

### Preset file transfer

Implements: `prd.md > Epic 5 > Story 5.4: Share a personal preset`

`src/preset-transfer.js` will own browser file download and import. It will export the existing `PresetSchema.serialize()` result as formatted JSON, so local storage, WebMCP preset reads, and shared files use one versioned preset shape.

Import will read at most 64 KiB, parse JSON, call `PresetSchema.deserialize()`, reject duplicate node IDs and unavailable node types, then call a new pure `McpTools.validatePresetCandidate()` helper. That helper will reuse the existing host-owned checks, parameter policy, and full-chain rules without registering an eleventh tool or applying audio. Imported values that require clamping will be rejected instead of silently changing the shared sound.

`McpTools.validatePresetCandidate(nodes)` will return either `{ ok: true, nodes }` or `{ ok: false, error }`. The error uses the same stable code, reason, rule ID, and suggestion fields as a WebMCP refusal. `index.html` will load `preset-transfer.js` after `mcp-tools.js`, so the helper and all registered node types exist before transfer controls initialize.

After validation, the interface shows the name and effect count. A unique name can be saved through `PresetStore`. A collision opens an inline Rename, Replace, or Cancel choice. Successful import refreshes the personal preset list but does not load the chain. Download and import never call `ChainEditing`, so they do not change live audio or create chain Undo records.

The contest release will not encode presets into URLs. File transfer is anonymous, backend-free, inspectable, and small enough to attach to chat, email, or a community post. Link-based sharing remains later work.

### Release and deployment

Implements: `prd.md > Epic 6: Present a contest-ready release`

The release branch is `main`. The existing Cloudflare Worker project watches the repository and deploys a successful push to [https://voxchain.arrangedgodly.com/](https://voxchain.arrangedgodly.com/). Cloudflare configuration lives outside this repository, so deployment verification must confirm the dashboard integration still targets `main` and the expected production hostname.

The repository remains directly hostable as static files. No build command or Wrangler setup is part of the contest release.

## File structure

```text
voxchain/
|-- index.html                         # Stable page structure, startup gate, controls, script order, and Tone effect release switches.
|-- styles/
|   `-- main.css                       # Current studio visual system, responsive layout, gated states, focus, and safety styling.
|-- src/
|   |-- main.js                        # Start, Retry, device, lifecycle, Bypass button, restore, and module bootstrap orchestration.
|   |-- audio-engine.js                # AudioContext, microphone stream, device enumeration and switching, and stream-loss events.
|   |-- audio-graph.js                 # Ordered chain model, live node reuse, glitch-controlled rebuilds, gate, and output path.
|   |-- audio-bypass.js                # Independent dry route and human emergency Bypass state.
|   |-- audio-param-ramp.js             # Shared short ramp for click-resistant AudioParam changes.
|   |-- node-types.js                  # UI and agent metadata registry for effect labels, parameters, and writers.
|   |-- node-gain.js                   # Native gain DSP and parameter contract.
|   |-- node-compressor.js             # Native compressor DSP and parameter contract.
|   |-- node-eq.js                     # Native multi-band EQ DSP and parameter contract.
|   |-- node-delay.js                  # Native delay, feedback, and mix DSP contract.
|   |-- node-reverb.js                 # Convolution reverb and bundled impulse-response contract.
|   |-- node-limiter.js                # Protected terminal limiter DSP and ceiling controls.
|   |-- node-gate.js                   # Noise-gate worklet wrapper and parameter contract.
|   |-- node-distortion.js             # Distortion curve, tone, mix, and output contract.
|   |-- node-chorus.js                 # Native stereo chorus DSP and parameter contract.
|   |-- node-autotune.js               # Experimental pitch-correction worklet wrapper and controls.
|   |-- node-pitchshift.js             # Tone-backed pitch-shift registration. Removable include if physical test fails.
|   |-- node-tremolo.js                # Tone-backed tremolo registration. Removable include if physical test fails.
|   |-- node-bitcrusher.js             # Tone-backed bitcrusher registration. Removable include if physical test fails.
|   |-- node-phaser.js                 # Tone-backed phaser registration. Removable include if physical test fails.
|   |-- tone-adapter.js                # Tone context bridge, wrapper nodes, parameter updates, and disposal.
|   |-- gate-worklet.js                # Audio-thread noise-gate processor.
|   |-- autotune-worklet.js            # Audio-thread pitch analysis and correction processor.
|   |-- watchdog-worklet.js            # Audio-thread output peak sampling while paint is throttled.
|   |-- canvas.js                      # Palette, free board, cords, layout, accessible order, and accepted model rendering.
|   |-- param-controls.js              # Generic controls generated from NodeTypes parameter metadata.
|   |-- chain-editing.js               # Sole accepted mutation queue and commit boundary for every control path.
|   |-- agent-ui.js                    # Agent state, summaries, refusal feedback, Undo, and conflict confirmation.
|   |-- mcp-server.js                  # Browser-native WebMCP registration adapter.
|   |-- mcp-tools.js                   # Ten schemas, policy validation, structured results, and mutation plans.
|   |-- mcp-harness.js                 # Development-only all-tools diagnostic shown with `?dev`.
|   |-- persistence.js                 # Autosaved chain and board-layout storage, migration, and failure latch.
|   |-- preset-schema.js               # Preset serialization, validation, and migration.
|   |-- default-preset.js              # Fresh-profile default chain.
|   |-- factory-presets.js             # Shipped read-only preset definitions.
|   |-- preset-store.js                # Personal preset storage with write/read-back verification.
|   |-- presets-ui.js                  # Preset lists, current preset, and modified indicator.
|   |-- preset-transfer.js             # Versioned preset download, import validation, collision UI, and storage commit.
|   |-- meters.js                      # Meter rendering and visible-cadence sampling.
|   |-- meter-taps.js                  # Input/output taps, watchdog latch, fallback warning, and human restore.
|   `-- status-readouts.js             # Sample rate, estimated latency, and live node count.
|-- vendor/
|   |-- tone.min.js                    # Vendored Tone.js 15.1.22 UMD bundle.
|   `-- Tone.js.LICENSE.txt            # Required full upstream MIT license text. Currently missing and must be added.
|-- assets/
|   |-- ir/plate-vocal.mp3             # CC0 convolution impulse response.
|   `-- test-vocal.mp3                 # CC0 fixed listening reference.
|-- tests/
|   |-- run.js                         # Discovers and isolates every `test-*.js` regression file.
|   |-- test-*.js                      # Headless contracts for audio, UI state, WebMCP, safety, persistence, and Undo.
|   |-- test-preset-transfer.js        # Export round-trip, hostile import, collision, and storage-failure contracts.
|   `-- qa-out/                         # Optional rendered audio and listening instructions for human A/B checks.
|-- docs/
|   |-- ACCEPTANCE.md                  # Manual mic, PA, hidden-tab, WebMCP-client, deployment, and video checks.
|   |-- WEBMCP-CHALLENGE.md            # Contest requirements tied to product and release decisions.
|   `-- hackathon-build/               # Scope, PRD, this spec, checklist, learner profile, and decision journal.
|-- README.md                           # Public project overview and final judge instructions.
|-- PRODUCT.md                         # Stable product intent and release boundaries.
|-- DESIGN.md                          # Current interface direction and protected visual contracts.
|-- LICENSE                             # VoxChain's MIT license.
`-- THIRD_PARTY_NOTICES.md             # Tone.js and CC0 dependency notices.
```

## Data flow

### Startup flow

1. The person presses Start in `index.html`.
2. `main.js` calls `AudioEngine.start()` under the required user gesture.
3. `AudioEngine` creates or resumes the `AudioContext`, requests the microphone, and exposes the active source node.
4. `Persistence` returns the latest valid autosave. If none exists, `DEFAULT_PRESET` supplies the chain.
5. `main.js` calls `ChainEditing.apply({ source: 'startup', ... })`.
6. `ChainEditing` validates the model, asks `AudioGraph` to build it, renders it through `ChainCanvas`, and aligns preset state.
7. `AudioBypass`, `MeterTaps`, `Meters`, and `StatusReadouts` attach to the live session.
8. Only after the live path succeeds does `main.js` remove the startup gate and report Live.

If any step fails, startup tears down the partial session, leaves the board gated, and places exact recovery copy in the existing status and Start-hint regions.

### Human edit flow

1. A palette activation, parameter control, cord relink, or preset action proposes a change.
2. The UI sends the proposal to `ChainEditing` and marks a multi-step gesture as in progress when needed.
3. `ChainEditing` serializes the operation and checks protected-chain rules.
4. Structural changes call `AudioGraph.buildGraph()`. Parameter-only changes update the existing node instance through `NodeTypes.applyParam()`.
5. The accepted model and visible canvas update from the same transaction.
6. `Persistence` attempts autosave. A failure raises the persistent warning without undoing the live result.
7. `AgentUI.noteHumanEdit()` marks any older agent Undo as conflicted.

### Agent mutation flow

1. The external browser agent discovers the page's tools through `document.modelContext`.
2. `McpServer` passes the tool input to the matching definition in `McpTools`.
3. `McpTools` validates the JSON schema, current engine state, effect registry, parameter ranges, limiter position, and agent authority.
4. Unsafe or invalid input returns a structured refusal and visible explanation with no side effects.
5. Valid work waits behind an active human gesture, then calls `ChainEditing`.
6. `ChainEditing` commits the graph, canvas, preset state, and autosave attempt as one logical mutation.
7. `AgentUI` displays one summary and records one exact Undo snapshot.
8. The tool returns a structured result describing what changed so the agent can continue from real state.

### Watchdog flow

1. The output tap sends block peaks from `watchdog-worklet.js` to `MeterTaps`.
2. `MeterTaps` evaluates sustained-peak and rising-howl rules even when visual animation is throttled.
3. A trip mutes the processed chain gate and latches the detected reason.
4. The interface keeps the warning visible and retains Bypass.
5. Only the person can press Restore Output. No WebMCP tool exposes this action.

### Persistence flow

1. Each accepted chain transaction produces a serializable `{ model, layout }` snapshot.
2. `Persistence` validates and writes the snapshot to `karaoke-autosave-v1`, then verifies the stored value.
3. Personal preset operations use `PresetSchema` and `PresetStore` under `karaoke-presets-v1`.
4. Reload does not immediately expose the saved board. Start must first establish a real audio session, then the saved state is applied through `ChainEditing`.

### Preset sharing flow

1. The host or agent saves the accepted prompted chain as a personal preset.
2. The host presses Download beside that preset.
3. `PresetTransfer` loads it from `PresetStore`, serializes the exact versioned preset object, creates a JSON `Blob`, and starts a browser download named `<safe-name>.voxchain-preset.json`.
4. A recipient starts VoxChain, presses Import in the Presets panel, and selects the file.
5. `PresetTransfer` checks the 64 KiB limit, parses the file, validates the schema, rejects duplicate IDs and unavailable effects, and asks `McpTools.validatePresetCandidate()` to apply the same policy used by `set_chain` and `load_preset` without mutating the app.
6. The interface previews the preset name and effect count. A name collision requires Rename, Replace, or Cancel.
7. `PresetStore.save()` commits the import and verifies the write. Only then does `PresetsUI.refreshPresetSelect()` reveal it.
8. The live chain stays unchanged until the person explicitly loads the imported preset through the existing policy-checked load path.

### Deployment flow

1. Release work lands on `main` after local automated and required physical checks.
2. Cloudflare's Git integration detects the push and updates the existing Worker deployment.
3. The team verifies the exact commit behavior at [https://voxchain.arrangedgodly.com/](https://voxchain.arrangedgodly.com/).
4. The supported built-in browser must discover all ten tools on the normal URL without `?dev`.
5. README, video, and Devpost instructions must describe the same deployed behavior.

## Data contracts and state ownership

### Chain model

```js
[
  {
    id: "stable-node-id",
    type: "eq",
    params: { low: 1.5, mid: 0, high: 2 }
  },
  {
    id: "terminal-limiter-id",
    type: "limiter",
    params: { ceiling: -3, release: 100 }
  }
]
```

`AudioGraph` owns the accepted ordered model and physical node instances. `ChainCanvas` renders copies of that model. Callers must not mutate either in place. The limiter must remain last.

### Board layout

The layout maps stable node IDs to visual position and size. It changes card placement only. Effect order comes from the chain model and cord route, not screen coordinates. Presets remain chain-only and receive fresh board positions when loaded.

### Mutation request

`ChainEditing.apply()` receives a source, the intended model or parameter change, optional layout and preset display state, an operation summary, and an optional abort signal. It resolves only after the logical commit succeeds or returns a typed failure. This is the seam every new UI control or WebMCP tool must use.

### Portable preset file

The file reuses the current `PresetSchema` version 1 object:

```json
{
  "schemaVersion": 1,
  "name": "Warm family karaoke",
  "nodes": [
    {
      "id": "eq-1",
      "type": "eq",
      "params": { "low": 1.5, "mid": 0, "high": 2 }
    },
    {
      "id": "limiter-1",
      "type": "limiter",
      "params": { "ceiling": -3, "release": 100 }
    }
  ]
}
```

Exports use two-space JSON formatting, UTF-8, `application/json`, and the `.voxchain-preset.json` suffix. The transfer contains no layout because presets are chain-only. It also omits audio, microphone identifiers, autosave data, client information, and timestamps.

Download filenames replace characters outside letters, numbers, `.`, `_`, and `-` with `-`, collapse repeated separators, and fall back to `voxchain-preset` when nothing remains. Import checks `File.size <= 65536` before reading. The importer rejects unknown top-level fields so a shared file has one inspectable contract.

### Persistence ownership

- `AudioGraph` owns accepted live chain state.
- `ChainCanvas` owns transient gesture state and the accepted board layout.
- `AgentUI` owns the latest agent Undo record and feedback state.
- `Persistence` owns autosave truth and its failure latch.
- `PresetStore` owns personal preset truth.
- `PresetTransfer` owns temporary file parsing and collision state. It owns no chain or preset after the operation finishes.
- `main.js` owns live or stopped session state.

No component should mirror another component's authoritative state without a documented read or event.

## External APIs and dependencies

### Browser-native WebMCP

VoxChain registers page-scoped tools through the current WebMCP API. The implementation should stay aligned with the [WebMCP draft specification and examples](https://github.com/webmachinelearning/webmcp). The competition client, not the development harness, is the final compatibility test.

### Web Audio and AudioWorklet

The browser provides microphone capture, the audio graph, worklet processors, and the destination. AudioWorklet behavior should follow [MDN's AudioWorklet reference](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorklet). Worklet files must remain same-origin and load over HTTPS in production.

### Tone.js

The four optional effects use [Tone.js](https://github.com/Tonejs/Tone.js) 15.1.22. The upstream project uses the [MIT license](https://github.com/Tonejs/Tone.js/blob/dev/LICENSE.md). Before release, add `vendor/Tone.js.LICENSE.txt` with the complete upstream text referenced by the vendored banner. Keep the version, role, path, and license in `THIRD_PARTY_NOTICES.md`.

### Cloudflare Workers Git integration

Deployment uses the existing Cloudflare dashboard connection. The relevant behavior is documented in [Cloudflare Workers Git integration](https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/). The team must verify the connected repository, production branch `main`, deployment result, and custom hostname. The repository itself contains no Wrangler contract to test.

## AI usage

VoxChain does not host or call a model. A WebMCP-capable external browser agent interprets plain language, chooses from the registered page tools, and receives structured state and policy results from VoxChain.

The app contributes the useful part of the interaction:

- It describes effects, parameters, presets, safety rules, and current state to the agent.
- It validates every tool input and refuses operations outside the published contract.
- It applies accepted agent work through the same mutation path as human edits.
- It makes the result visible, audible, explainable, and reversible.

The demo should name the external client and model used. Submission materials should also describe how Codex or other AI coding tools helped with planning, implementation, tests, and release work without implying that VoxChain contains a private AI service.

## Risks and verification

| Risk | Release response | Verification |
| --- | --- | --- |
| A UI polish edit breaks established wiring | Keep current IDs, script order, globals, and `ChainEditing` boundary. Prefer CSS and local markup changes. | Run `node tests/run.js`, then complete the affected browser and accessibility checks in `docs/ACCEPTANCE.md`. |
| A Tone.js effect sounds unstable with a real mic | Test each effect alone through the real microphone and PA. Remove only a failing effect's script include from `index.html`. | Confirm audible result, safe level, parameter control, Bypass, limiter, no unacceptable click, and omission from palette and `get_capabilities`. |
| The vendored library lacks its full notice | Add `vendor/Tone.js.LICENSE.txt` before release and keep `THIRD_PARTY_NOTICES.md` accurate. | Inspect the public repository and match the vendored banner to the full license file. |
| Headless tests pass but live audio is wrong | Treat physical listening as a separate hard gate. | Walk `docs/ACCEPTANCE.md` sections for real mic/PA, DSP, large parameter jumps, Bypass, reorder, and watchdog. |
| WebMCP works in `?dev` but not in the judging client | Test the normal deployed URL with the supported built-in browser. | Discover exactly ten tools, run the accepted prompt, Undo, refusal, and direct preset load. Record client version, model, date, and result. |
| A denied microphone produces a confusing dead screen | Preserve the gate and show exact inline recovery in the status sentence and Start hint. | Deny permission in a fresh profile, verify stopped state, Retry, and browser-setting instructions. |
| Autosave or preset storage lies after a write failure | Keep write/read-back verification and persistent warning behavior. | Run storage-failure tests and manually verify that failed work does not appear saved. |
| A shared preset file bypasses safety rules | Validate the file before storage with the same parameter and chain policy used by agent preset loading. Reject candidates that would clamp or name an unavailable effect. | Test malformed JSON, unsupported versions, unknown types, duplicate IDs, missing or misplaced limiter, unsafe gain, too many nodes, and hidden Tone effects. |
| Import overwrites a personal preset unexpectedly | Require an inline Rename, Replace, or Cancel decision for every name collision. | Test all three choices and confirm Cancel is byte-stable. |
| A download leaks local information | Export only `schemaVersion`, `name`, and `nodes`. | Inspect the file and test that layout, device, autosave, agent, and browser fields are absent. |
| Watchdog recovery reopens unsafe audio | Keep human-only Restore Output for the contest. | Trip peak and howl paths while visible and hidden. Confirm the latch, reason, Bypass, and lack of agent recovery. |
| Cloudflare deploys an older or wrong branch | Keep `main` as the only production branch and check deployment history after push. | Compare the live tool behavior and release marker with the tested local checkout. |
| Local Git commands are blocked by repository ownership checks | Do not weaken Git safety silently. Have the repository owner correct the safe-directory configuration before the release push if needed. | `git status` and the intended diff must work for the person performing the push. |
| Contest video and live app diverge | Record only after the production smoke test passes. | Repeat the README judge steps against the deployed URL immediately before publishing the video. |

### Automated gate

Run from the repository root:

```bash
node tests/run.js
```

The current baseline is 35 of 35 files passing with 2,560 checks. Any release change must keep the full suite green. A focused test may run during development, but the final gate is the unfiltered command.

### Physical gate

Automation cannot approve microphone permission, room feedback, PA gain, audible DSP, click behavior, hidden-tab scheduling, or competition-client discovery. Grady and his brother must date the relevant lines in `docs/ACCEPTANCE.md` before submission.

### Tone.js decision gate

For Pitch Shift, Tremolo, Bitcrusher, and Phaser, record one of two outcomes:

- Ship. The effect passes the live microphone and PA checks and stays included in `index.html`.
- Hide for contest. Remove only its production script include, rerun the full suite, verify that the palette and WebMCP capability list omit it, and confirm that no factory preset references it.

## Demo and submission flow

### Production judge path

1. Open [https://voxchain.arrangedgodly.com/](https://voxchain.arrangedgodly.com/) over HTTPS.
2. Show the empty gated board and press Start.
3. Grant microphone permission, speak a few words, and show Live, meters, and the default or restored chain.
4. In the external browser agent, ask: "Make this karaoke vocal warmer and clearer, with light hall reverb, without making it louder."
5. Keep the board visible while modules appear or reorder and parameters change.
6. Save the result as a personal preset and download its `.voxchain-preset.json` file.
7. Read the one-line summary, speak again, and use Undo to restore the prior chain.
8. Ask the agent to remove the terminal limiter. Show the refusal and unchanged chain.
9. Toggle Bypass with the button or spacebar to show immediate human authority.

### Submission evidence

- A public repository with `LICENSE`, `THIRD_PARTY_NOTICES.md`, the full Tone.js license, contest documentation, and readable post-August-25 WebMCP history.
- The live HTTPS URL and exact supported-browser judge steps.
- A public YouTube video under three minutes with audible owned or spoken audio.
- The client version, model, test date, ten discovered tool names, accepted prompt, refusal prompt, and outcomes.
- A dated `docs/ACCEPTANCE.md` pass for physical and deployed checks.
- A preset-file round trip that exports the prompted sound and imports it into a fresh browser profile without changing the live chain until Load.

Record the video only after the production smoke passes. The video should show the real external-agent workflow, not the `?dev` harness, and it should match the public README step for step.
