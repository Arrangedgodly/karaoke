# Project scope

## Project name candidates

- VoxChain, confirmed

## One-line summary

VoxChain is a browser-based live vocal-chain builder where a home karaoke host can describe a desired sound in plain language and watch a WebMCP-capable agent build or tune the same safe chain they can hear, inspect, undo, and control by hand.

## Target user

The primary contest user is a home karaoke host. They know how they want a singer to sound but may not know how to translate "warmer," "clearer," or "more spacious" into EQ, compression, gain, reverb, and limiter settings.

Streamers, gamers, and other live-voice creators are credible future users, but they will not drive the contest demo or the remaining release work.

## Problem

Building a good live vocal chain requires audio vocabulary, routing knowledge, and careful parameter tuning. That complexity gets worse during karaoke setup, where the operator also has to manage microphone permission, live levels, feedback risk, and the pressure to keep the show running.

Most assistant experiences hide their processing choices. VoxChain lets an agent change the visible chain through WebMCP while the page enforces audio rules. The person still owns microphone access, engine start, Bypass, device selection, manual edits, and Undo.

## Core workflow

1. The host opens the deployed VoxChain page in the ChatGPT in-app browser or a supported WebMCP-enabled Chrome build.
2. The existing single-page studio interface shows a startup gate with Start as the dominant action. The board is empty and cannot be edited before startup.
3. The host presses Start and grants microphone permission. On success, the gate disappears and VoxChain loads the last autosaved chain, or the built-in default chain on a fresh profile. If startup or permission fails, VoxChain stops and explains what the host must fix. It does not pretend that live audio is working.
4. In the external browser agent, the host asks: "Make this karaoke vocal warmer and clearer, with light hall reverb, without making it louder."
5. The agent reads VoxChain's capabilities and current chain, then uses WebMCP tools to apply safe changes.
6. The judge first sees modules appear or reorder. Control changes, agent activity, a plain-language change summary, and Undo make the result traceable.
7. The host hears the changed signal, inspects or adjusts the controls, and can undo the mutation or hit the human-only Bypass at any time.
8. After saving the prompted result as a personal preset, the host can download a portable preset file. Another VoxChain user can import that file into their personal preset list without an account or server.
9. A short refusal example, such as asking the agent to remove the terminal limiter, proves that WebMCP access cannot break the safety contract.

## What we are building

- A contest-ready polish pass on the newly landed VoxChain interface, with chain order and module readability as the first visual priority.
- A recording-studio visual language influenced by Ableton and FL Studio, with warm LCD-style readouts and clear hardware homage.
- A stable microphone-to-output path with truthful startup, permission, meter, output, Bypass, and watchdog states.
- One shared chain state for direct manipulation and the existing ten WebMCP tools.
- Visible agent mutations. Modules appearing and reordering are the primary proof, followed by parameter changes, a change summary, and one-click Undo.
- A plain-language WebMCP demo through the external browser agent. VoxChain may display and copy a suggested prompt, but it will not add its own LLM connection for the contest.
- The ten established effects already covered by the product contract.
- The four Tone.js effects, Pitch Shift, Tremolo, Bitcrusher, and Phaser, only if each passes a focused real-microphone smoke test. Any failing effect will be hidden from the contest registry and interface while its implementation remains available for later work.
- Complete Tone.js MIT compliance in the public repository, including the full license notice referenced by the vendored bundle and the existing third-party notice.
- Portable personal-preset sharing through versioned JSON files. A user can download a saved preset and import a shared preset after VoxChain validates it. This must not add an account, cloud store, or new WebMCP tool.
- A deployed judge path that behaves as shown in the video and requires no account, API key, extension, or separate MCP server.
- A focused release completed within an estimated 8 to 16 combined work hours, with extra time treated as contingency rather than new-feature capacity.

## What we are not building

- A second full interface redesign before submission.
- An in-app chatbot, model API integration, API-key flow, or cloud inference service.
- New effect types beyond the four already implemented with Tone.js.
- Recording, audio export, user accounts, analytics, or cloud preset storage.
- Server-backed preset links, public preset pages, community browsing, ratings, or moderation. These need hosting and abuse controls that do not fit the contest release.
- Separate workflows for streamers, gamers, podcasters, or professional studios.
- Broad browser support beyond the competition's supported judging paths.
- A new cable or routing system. Existing cable behavior changes only if it blocks chain readability or the judge path.
- Silent editing before the audio engine starts. WebMCP mutations remain gated until the host starts the engine.
- Shipping a Tone.js effect that fails the physical microphone smoke test.

These cuts protect the one interaction that matters most: a judge gives a simple request and watches VoxChain turn it into a complex, audible, safe, and reversible vocal chain.

## Inspiration and references

- Ableton Live's ordered device chain is the reference for legible signal flow and compact parameter access. VoxChain can go further in its hardware styling.
- FL Studio's mixer and effect slots are the reference for approachable structure, strong module identity, and a studio-console personality.
- iZotope Nectar's vocal-assistant idea proves the value of translating intent into processing. VoxChain differentiates itself by exposing the result through open WebMCP tools and the same visible controls the human uses.
- Physical rack processors and grooveboxes inform the warm displays, labeled sections, knobs, and deliberate control density. The interface pays homage to hardware without claiming to be a literal hardware replica.

## Demo path

The video and live judge path should fit inside three minutes:

1. Open the deployed page and show the gated board with Start as the required first action.
2. Press Start, grant microphone permission, show the default or restored chain appear, and speak through it.
3. Ask the external browser agent for a warmer, clearer karaoke vocal with light hall reverb and no loudness increase.
4. Keep the chain on screen while modules appear or reorder and parameters change.
5. Save the prompted chain as a personal preset and download its portable preset file.
6. Show the change summary and Undo, then speak again so the result is audible.
7. Ask the agent to remove the terminal limiter and show the refusal.
8. Close on Bypass and the safety state, proving that the host retains immediate control.

If live microphone startup fails during judging, VoxChain must display a specific recovery message. The submission video remains the guaranteed audible proof.

## Submission story

VoxChain began as a personal solution for hosting karaoke. Its contest story is not a generic AI audio assistant. It is a working browser audio utility built from scratch, extended so a non-technical host can use plain language to control a real vocal chain through WebMCP.

The memorable contrast is the prompt-to-power ratio. A short request produces a sophisticated set of visible audio decisions, while VoxChain keeps the limiter, loudness constraints, engine start, microphone choice, Bypass, change summary, and Undo under explicit rules. The finished sound does not have to stay trapped in one browser. A saved personal preset can leave as a small file that another VoxChain user imports.

The submission will distinguish the pre-existing audio application from the WebMCP work added during the contest period using dated documentation and commit history. The final proof consists of the public repository, deployed page, sub-three-minute video with audio, visible WebMCP interaction, and a reproducible judge path.
