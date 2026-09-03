# Title

VoxChain

## One-line Summary

VoxChain is a browser-based live vocal-chain builder where a home karaoke host can describe a desired sound in plain language and watch a WebMCP-capable agent safely build or tune the same chain they can hear, inspect, undo, and control by hand.

## Problem

A home karaoke host may know that a singer should sound warmer, clearer, or more spacious without knowing how to turn that request into EQ, compression, reverb, gain, and routing decisions. During a live setup, they also need immediate control over the microphone, loudness, and feedback risk.

## Solution

VoxChain runs a live vocal-effects chain in the browser. A person can work directly in Simple or Advanced view, or ask an external browser agent for a sound in ordinary language. The agent reads and edits the page through ten WebMCP tools. VoxChain applies accepted work to the visible and audible chain, explains the change, and offers Undo.

## Why This Matters

VoxChain gives a non-audio-engineer access to sophisticated sound design without hiding what the agent did. The person and agent work on one shared chain, while microphone access, engine start, Bypass, and watchdog recovery remain under human control.

## How We Used AI

VoxChain does not host a model or send audio to an AI service. A WebMCP-capable external browser agent interprets the person's request, reads the effect catalog and current chain, and calls the page's registered tools. The app provides structured audio capabilities, current state, validation, safety rules, and the local real-time audio engine.

TODO: Name the exact external client, model, version, and test date used for the final recorded demo.

## How We Used Codex

Codex helped turn the existing project into a focused hackathon entry. It helped define the home-karaoke use case, write the scope and product requirements, map the existing architecture, identify release risks, and produce the build and verification checklist. The project records those decisions under `docs/hackathon-build/`.

TODO: Add concrete implementation, debugging, and testing examples from the final build work.

## Key Features

- A local browser audio engine with 14 vocal effects.
- Simple view for finding and trying sounds, plus Advanced view for building and tuning a chain by hand.
- Ten page-scoped WebMCP tools for inspecting, building, tuning, loading, and saving vocal chains.
- Visible agent activity, plain-language change summaries, and Undo.
- Safety rules that keep the limiter last, cap output, and refuse unsafe agent work.
- Human-only Start, microphone selection, Bypass, and watchdog recovery.
- Thirty-three factory presets and browser-local personal presets.

## Architecture

VoxChain is a static vanilla JavaScript app. Web Audio and AudioWorklets run the live microphone chain locally. `src/mcp-server.js` registers the WebMCP tools, `src/mcp-tools.js` defines their schemas and policy, and `src/chain-editing.js` is the shared mutation boundary for human edits, agent edits, preset loads, and Undo. The app uses localStorage for persistence and deploys as a Cloudflare Worker.

## Testing Instructions

1. Open <https://voxchain.arrangedgodly.com/> in the supported WebMCP-capable browser.
2. Press Start, allow microphone access, and confirm the Live state and moving meters.
3. Ask the browser agent: "Make this karaoke vocal warmer and clearer, with light hall reverb, without making it louder."
4. Confirm that the visible chain changes, the page reports the action, and Undo restores the prior chain.
5. Ask the agent to remove the terminal limiter. Confirm that VoxChain refuses and leaves the chain unchanged.
6. Press Bypass or the spacebar and confirm that immediate output control remains with the person.

Automated tests run with `npm test`. Physical microphone, PA, deployed-client, and final video checks remain recorded separately in `docs/ACCEPTANCE.md` and must be completed before the entry is called ready.

## Public Demo Link

<https://voxchain.arrangedgodly.com/>

## Public Repository Link

<https://github.com/Arrangedgodly/voxchain>

TODO: Confirm the repository is public and the license is visible in the repository About area before submission.

## Demo Video

Target runtime: 2:35 to 2:45. Leave at least 15 seconds of margin under the three-minute limit.

### Recording setup

- Open VoxChain in the real WebMCP-capable client, not the `?dev` harness.
- Start the microphone before recording, select Advanced view, and place the agent beside the app so the prompt, tool activity, and changing chain can appear in one frame.
- Use headphones to avoid feedback. Record a spoken phrase or owned audio only.
- Rehearse the accepted prompt and limiter refusal on the deployed site before the final take.

### Timed script and screen actions

**0:00-0:15 | Open on the result, not a title card**

Screen: VoxChain is already Live. Speak one short test phrase so the meters move.

Narration: "This is VoxChain, a live vocal-effects board for home karaoke. I may know I want a warmer, clearer voice, but I should not need to understand EQ, compression, or reverb settings to get there."

**0:15-0:35 | State the WebMCP fit and enter the prompt**

Screen: Show the external browser agent and enter: "Make this karaoke vocal warmer and clearer, with light hall reverb, without making it louder."

Narration: "VoxChain registers ten tools directly with the browser through WebMCP. There is no model or API key inside the audio app. The browser agent supplies the language understanding, while VoxChain supplies the real audio controls, current state, and safety rules."

**0:35-1:20 | Let the agent change the chain**

Screen: Keep the agent activity and Advanced chain visible. Let the agent inspect capabilities and current state, then apply the change. Point out modules that appear or move, changed controls, and the summary with Undo.

Narration: "The agent can inspect the available effects and the chain that is live right now. It starts with the closest sound when one fits, then safely adjusts the same chain I can edit by hand. The modules and controls update as the accepted calls land, and VoxChain summarizes exactly what changed."

**1:20-1:42 | Prove the audible result and shared state**

Screen: Speak the same short phrase again. Briefly adjust one visible control by hand if the timing is reliable.

Narration: "That change is audible, visible, and still mine to control. There is one chain and one state, whether the change comes from me or the agent. Nothing is hidden behind a chat response."

**1:42-2:00 | Show Undo**

Screen: Click Undo and show the prior chain return.

Narration: "Every accepted agent change has a matching Undo, so experimenting with a sound does not mean surrendering control."

**2:00-2:25 | Show a policy refusal**

Screen: Ask the agent: "Remove the terminal limiter." Keep the limiter and refusal visible.

Narration: "The tools are useful, but they are not unrestricted. If I ask the agent to remove the terminal limiter, VoxChain refuses the request and leaves the live chain unchanged. The same page that exposes the controls also enforces the audio policy."

**2:25-2:42 | Close on human authority**

Screen: Toggle the red Bypass button or press the spacebar. End on the live app and moving meters.

Narration: "Start, microphone choice, emergency Bypass, and watchdog recovery stay human-only. VoxChain makes WebMCP a second control path for a real audio tool, while the person running the show keeps final authority."

### If the agent takes longer than expected

Use a clean jump cut during tool execution, but keep the prompt and final change in the same truthful sequence. Do not speed up the narration. Cut the optional manual control adjustment first.

## Screenshot Shot List

- VoxChain Live in Advanced view with moving meters and a readable ordered chain.
- The external agent prompt beside the visible chain.
- An accepted WebMCP change with the summary and Undo visible.
- The limiter-removal refusal with the unchanged terminal limiter.
- The red Bypass control with the live safety state visible.

## Submission Readiness Notes

- Live Devpost requirements were checked on 2026-09-03. The event requires a public video under three minutes with audio, a working live URL, a public licensed repository, a written WebMCP explanation, and form answers naming the tested client and AI tools.
- The video script emphasizes the four equally weighted judging criteria, with most time spent on WebMCP leverage and execution. It also states the real karaoke-host problem and the human-safety distinction.
- The portable preset transfer flow appears in planning documents but is not present in the current code, so this draft does not claim or demonstrate it.

## Known Limitations

- Chrome and the competition's supported in-app browser are the intended paths. Broad browser support is not claimed.
- The app needs microphone permission and a real input device for the live demo.
- Autotune remains experimental.
- No third-party adoption or usage metrics are claimed.
- Physical audio, deployed WebMCP-client, and final video checks are still unchecked in `docs/ACCEPTANCE.md`.

## TODO Official Form Fields

- Submitter Type: TODO
- Country of residence: TODO
- App Status: Existing
- Existing-project work completed during the submission period: TODO
- Live URL: <https://voxchain.arrangedgodly.com/>
- Private testing instructions for judges: TODO after the deployed smoke test
- Public repository URL: <https://github.com/Arrangedgodly/voxchain>
- WebMCP agent or client tested: TODO with exact client, model, version, and date
- AI tools used: Codex, plus TODO for any others
- Learning level: TODO
- Career AI value: TODO
- Public YouTube video URL: TODO
