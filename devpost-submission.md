# Title

VoxChain

## One-line Summary

VoxChain lets a karaoke host describe a vocal sound in plain language while a WebMCP agent safely tunes the same live chain they can hear, inspect, edit, and undo.

## Problem

A home karaoke host may know that a singer should sound warmer, clearer, or more spacious without knowing how to turn that request into EQ, compression, reverb, gain, and routing decisions. During a live setup, they also need immediate control over the microphone, loudness, and feedback risk.

## Solution

VoxChain runs a live vocal-effects chain in the browser. A person can work directly in Simple or Advanced view, or ask an external browser agent for a sound in ordinary language. The agent reads and edits the page through ten WebMCP tools. VoxChain applies accepted work to the visible and audible chain, explains the change, and offers Undo.

## Why This Matters

VoxChain gives a karaoke host useful sound design without hiding the audio decisions. The person and agent work on one shared chain. Microphone access, engine start, Bypass, and watchdog recovery remain human-only, so the agent can help without taking over the safety controls.

## How We Used AI

VoxChain does not host a model or send audio to an AI service. The Codex in-app browser interprets the person's request, reads the effect catalog and current chain, and calls ten tools registered directly by the page. VoxChain returns structured audio capabilities and current state, validates each requested change, enforces the limiter and gain rules, and runs the real-time audio locally.

The agent follows a preset-first strategy. It browses the factory library, loads the closest sound when one fits, and adjusts that chain. If no preset matches the request, it can build a fresh chain. This turns a phrase such as "make my voice really big and echoey, but keep it clear" into visible effect choices without requiring the person to know compressor, EQ, delay, or reverb settings.

## How We Used Codex

Codex helped shape VoxChain around its real use case: running the microphone at home karaoke parties. It helped write the scope, product requirements, technical spec, architecture decisions, and release checks under `docs/hackathon-build/` and `docs/adr/`.

During implementation, Codex helped define the ten WebMCP tool contracts and safety refusals, keep human and agent edits behind one transaction boundary, build and audit the Simple and Advanced views, grow and test the preset-first factory library, add the local Auto Gain setup utility, and debug rapid preset and parameter interactions. It also helped build the regression suite and judge-facing documentation. The final local run on September 3 passed 52 test files and 5,584 checks.

## Key Features

- A local browser audio engine with 14 vocal effects plus an optional Auto Gain setup utility.
- Simple view for finding and trying sounds, plus Advanced view for building and tuning a chain by hand.
- Ten page-scoped WebMCP tools for inspecting, building, tuning, loading, and saving vocal chains.
- Visible agent activity, plain-language change summaries, and Undo.
- Safety rules that keep the limiter last, cap output, and refuse unsafe agent work.
- Human-only Start, microphone selection, Bypass, and watchdog recovery.
- Thirty-three factory presets, browser-local personal presets, and shareable preset links.

## Architecture

VoxChain is a static vanilla JavaScript app. Web Audio and AudioWorklets run the microphone chain locally. `src/mcp-server.js` registers WebMCP tools, `src/mcp-tools.js` defines their schemas and policy, and `src/chain-editing.js` is the shared mutation boundary for human edits, agent edits, preset loads, and Undo. The effect catalog drives both the visible controls and the tool descriptions. The app stores chains and personal presets in localStorage and deploys through a Cloudflare Worker.

## Testing Instructions

1. Open <https://voxchain.arrangedgodly.com/> in the supported WebMCP-capable browser.
2. Press Start, allow microphone access, and confirm the Live state and moving meters.
3. Ask the browser agent: "Make my voice really big and echoey, but keep it clear."
4. Confirm that the visible chain changes, the page reports the action, and Undo restores the prior chain. On the September 3 pass, the agent loaded the six-node factory preset `Noraebang Echo`.
5. Ask the agent to remove the terminal limiter. Confirm that VoxChain refuses and leaves the chain unchanged.
6. Toggle Bypass off and on, then press Stop. Confirm that immediate output control remains with the person and Stop silences everything.

Automated tests run with `npm test`. The September 3 release run passed 52 of 52 test files and 5,584 checks. After adding the required Tone.js license file, `npm run build` completed and produced 64 public files.

The deployed page was checked in the Codex in-app browser on September 3. It loaded over HTTPS, advertised all ten tools, and returned valid results from `get_capabilities` and `get_chain` before Start. Grady Wasil then passed the five-step judge path with a real microphone: Live state and moving meters, a visible and audible `Noraebang Echo` preset load, Undo, terminal-limiter refusal, Bypass, and Stop. The dated result is recorded in `docs/ACCEPTANCE.md`.

## Public Demo Link

<https://voxchain.arrangedgodly.com/>

## Public Repository Link

<https://github.com/ArtofFish/voxchain>

Verified public on September 3. GitHub displays the repository's MIT license in the About area.

## Demo Video

<https://youtu.be/chm-IvQGqzQ>

- Published title: `VOXCHAIN Web App / WebMCP Demo`
- Verified runtime: 2:56.482
- Verified accessible on September 3, 2026
- Audio: spoken narration with an auto-generated English transcript

### Published video outline

- `0:00` introduces VoxChain and its live vocal-chain workflow.
- `0:33` shows the first plain-language ChatGPT request.
- `0:42` applies the `Big Room` factory preset to the live chain.
- `1:05` introduces the built-in safety rules.
- `1:13` asks to remove the terminal limiter.
- `1:19` shows the refusal and confirms that the limiter stays last.
- `1:29` shows the preset-led Simple view.
- `1:45` shows Advanced view for direct parameter and chain-order control.
- `2:11` gives ChatGPT an exact request to build a chain from scratch.
- `2:27` shows the six-node `Low-End Grind` result.
- `2:36` shows Undo restoring the prior chain.
- `2:37` closes with all 15 included audio modules.

The video is 3.518 seconds under the official limit. Do not replace it with a longer cut.

## Screenshot Shot List

- `docs/screenshot-advanced.png`: Advanced view with the ordered chain, factory preset library, limiter, and effect palette.
- `docs/screenshot-simple.png`: Simple view with the Current sound stage, plain filters, factory library, effect summary, and safety controls.
- Capture from the published video: the WebMCP prompt beside the live app.
- Capture from the published video: the limiter refusal with the terminal limiter unchanged.
- Optional final image: the red Bypass control with the live safety state visible.

## Submission Readiness Notes

- Live Devpost requirements were checked on September 3, 2026. The deadline is September 3 at 1:00 PM Pacific, which is 2:00 PM Mountain time.
- Devpost sign-in and registration for The WebMCP Challenge were confirmed. Devpost accepted entry `1168509`, and a live readback showed the project as published at <https://devpost.com/software/voxchain-qh9pma>.
- The published video is accessible and runs 2:56.482. Its URL is now in this draft.
- The public repository and top-level MIT license are visible on GitHub.
- The live site loads over HTTPS and exposes all ten WebMCP tools in the Codex in-app browser. The two read checks passed without starting the microphone.
- The local release gate is green: 52 of 52 test files and 5,584 checks passed. The static build produced 64 public files after the full Tone.js license was added.
- The quick tracked-file scan found no `.env`, credential, or secret files. The only sensitive-term match was the documentation's statement that VoxChain needs no API key.
- Commit `644a19a` pushed the full Tone.js license, third-party notice update, README image references, this draft, and both screenshots to the public `main` branch. The three new public assets returned HTTP 200 after the push.
- The five-step judge-path smoke test passed with a real microphone on September 3. The broader event-volume PA, per-effect, latency, and hidden-tab watchdog checks remain separate acceptance work.
- All required official form fields now have confirmed answers in this draft.
- Portable preset-file transfer was planned but is not in the shipped code. The current build supports browser-local personal presets and shareable preset links, so this draft does not claim file import or download.

## Known Limitations

- Chrome and the competition's supported in-app browser are the intended paths. Broad browser support is not claimed.
- The app needs microphone permission and a real input device for the live demo.
- Autotune remains experimental.
- No third-party adoption or usage metrics are claimed.
- The published video is 2:56.482, leaving 3.518 seconds under the limit.
- The short judge path has a recorded physical-audio pass. The comprehensive event-volume PA, every-effect listening, latency, and hidden-tab watchdog checks remain open in `docs/ACCEPTANCE.md`.

## Official Form Fields

- Submitter Type: Team of Individuals
- Country of residence: United States
- App Status: New
- Existing-project work completed during the submission period: Not applicable. The repository's first commit is dated August 27, 2026, and the published video describes VoxChain as a new project built over seven days.
- Live URL: <https://voxchain.arrangedgodly.com/>
- Private testing instructions for judges: Open the live URL in the Codex in-app browser or WebMCP-enabled Chrome. Use headphones. Press Start, confirm the headphone check, allow microphone access, and choose the correct input. Ask "Make my voice really big and echoey, but keep it clear." Confirm that the agent chooses or builds a sound, the visible chain changes, and Undo restores the prior state. Then ask "Remove the terminal limiter" and confirm that VoxChain refuses without changing the chain. No account or credentials are required.
- Public repository URL: <https://github.com/ArtofFish/voxchain>
- WebMCP agent or client tested: Codex in-app browser, September 3, 2026. All ten tools were discovered on the deployed URL. `get_capabilities` and `get_chain` returned valid results before Start; a live preset load, Undo, and terminal-limiter refusal were then confirmed with the microphone running.
- AI tools used: Codex, Claude, and GLM.
- Learning level: Significant
- Career AI value: Yes
- Public YouTube video URL: <https://youtu.be/chm-IvQGqzQ>
