# Karaoke Chain Builder

**Live: https://karaoke.arrangedgodly.com/**

A live karaoke vocal chain in your browser: mic in → effects (reverb, delay, compression, EQ) → PA out. Zero install, works fully offline, and an AI agent in the browser can build and edit the chain from plain language via [WebMCP](https://developer.chrome.com/docs/ai/webmcp).

![Karaoke Chain Builder — the dark pro-audio console: status strip on top, effects rack left, chain canvas middle, presets right](docs/screenshot.png)

The console's dark pro-audio look — amber lamps, legible from two meters — as it sits before you press Start, with the default chain ready to go.

## For judges: the 60-second path

Everything below works on the deployed site, no local setup, no Chrome flags.

1. Open **https://karaoke.arrangedgodly.com/** in the Codex (or ChatGPT) in-app browser.
2. Ask the agent, in plain language: *"Set up a warm ballad vocal with light reverb."* Watch the chain rebuild itself, a plain-English summary toast of every change, and a one-click **Undo** on the toast.
3. Ask for something unsafe: *"Remove the limiter."* The agent is refused by the app's built-in policy — you get a refusal toast showing what was asked versus what's allowed. The limiter stays.
4. Safety stays human: the red **Bypass** button (or the **spacebar**) always works and no agent can touch it.

**No agent handy?** Open **https://karaoke.arrangedgodly.com/?dev** — an **Agent Harness** panel appears where you can run all 10 WebMCP tools directly with example inputs and watch change summaries, refusals, and Undo live. Start with `get_capabilities`, then `set_chain` (prefilled with a valid example), then hit Undo.

### No MCP server or side package

This is browser-native **WebMCP**, not a conventional local or remote MCP server. The top-level page registers its tools directly with `document.modelContext.registerTool(...)` during normal page load. A supported ChatGPT/Codex built-in browser discovers those page-scoped tools automatically while the page is open.

Judges do not need an MCP package, manifest, connector, API key, local process, browser extension, `?dev`, or separate connection. The Devpost Plugin helps with the competition workflow, and Chrome's Model Context Tool Inspector helps developers inspect tools. Neither is part of this app's runtime.

The implementation is split into two plain browser scripts:

- `src/mcp-server.js` is the small in-page WebMCP registration adapter. Despite the historical filename, it is not a server and has no transport.
- `src/mcp-tools.js` defines the ten page tools and connects each tool to the same visible model, canvas, audio graph, policy, toast, and Undo paths used by the human interface.

See [RQ-6: WebMCP competition and judge-client contract](docs/ultron/research/rq6-webmcp-competition-client.md) for the source-backed architecture review.

### Optional Chrome diagnostics

These steps are useful for development, but they are not the competition's built-in-browser path and are not prerequisites for judges:

1. Go to `chrome://flags/#enable-webmcp-testing`, set it to **Enabled**, and restart Chrome.
2. Open the app as usual.
3. Open DevTools (**F12**) → **Application** → **WebMCP** — you should see the app's 10 tools listed there, and you can run any of them by hand.
4. Optionally install the **Model Context Tool Inspector** Chrome extension to exercise the tools through a development agent.

Chrome's flag, DevTools pane, Inspector extension, and this project's `?dev` harness are independent diagnostic paths. Passing one of them does not by itself prove that the ChatGPT/Codex built-in browser discovered and used the tools.

## Who controls what

**A human can do everything:** build, reorder, tune, save, start/stop the engine, pick the mic, hit Bypass.

**An agent can:**
- Read the current chain, the presets, and what the app is capable of.
- Add, remove, and reorder effects, and set parameters — within published safety limits.
- Retrieve and load presets (factory or saved), and save new ones.

**An agent cannot (human-only):**
- Touch **Bypass** — it works from the button or the **spacebar**, always.
- Start or stop the engine.
- Pick the microphone device.

**Hard invariants, for everyone:**
- Every chain keeps its **limiter** as the terminal node — remove requests are refused.
- A fixed **−6 dBFS host attenuator** (output ceiling) is always on and not adjustable.
- A **watchdog** mutes the output if something starts to howl — restoring it is a human-only action.
- Every agent mutation gets a change-summary toast with one-click **Undo** (or **Ctrl/Cmd+Z** while the toast is visible).

## The ten WebMCP tools

Registered by the app for in-browser agents (see `src/mcp-tools.js`):

| Tool | Kind | What it does |
| --- | --- | --- |
| `get_capabilities` | read | Everything the app offers an agent: valid node types, param names, units, ranges, chain rules. |
| `get_chain` | read | The live chain, serialized in the exact shape `set_chain` accepts, with engine/preset context. |
| `set_chain` | write | Replace the whole chain in one validated pass (also the preset-loading path). |
| `add_node` | write | Insert one effect node (position optional). |
| `remove_node` | write | Remove one node — refused if it breaks a chain rule (e.g. the limiter). |
| `set_param` | write | Set a single parameter with a policy-checked, param-only ramp. |
| `list_presets` | read | Factory library plus the user's saved presets. |
| `get_preset` | read | One listed preset's complete nodes, without loading it (namespace explicit when a name exists in both groups). |
| `load_preset` | write | Load a listed preset as the live chain — same policy and visible UI path as `set_chain`, with summary toast and Undo. |
| `save_preset` | write | Save the current chain as a named preset. |

## Shared-state architecture

Agent and human drive the **same model, UI, and audio graph** — agent mutations land through the UI path, not a parallel channel, so the canvas, meters, and physical Web Audio graph are always one consistent state. Every mutation produces a change summary plus one-click Undo; a watchdog guards the output; the chain auto-saves. The app itself is **LLM-free**: no API keys, no cloud calls — all the intelligence runs in the agent's (or the human's) hands, and the app just enforces its safety contract.

## Verification

```sh
node tests/run.js
```

Zero dependencies — needs only Node, works from a clean clone; exit code 0 means green. The suite covers: 10-tool registration, policy round-trips of all factory presets, safety refusals, the node-reuse type guard, watchdog tap/latch, mutation + undo, persistence honesty, param-only ramps, and the preset retrieve/load tools.

**Honest boundaries:** automation does not prove the physical mic → PA path, audible DSP quality, or hidden-tab watchdog behavior. Those live in [docs/ACCEPTANCE.md](docs/ACCEPTANCE.md).

## Running it locally / at an event

The operator manual — everything below is for running a real karaoke show on a laptop. The app is identical to the deployed site; this section just covers getting it onto the machine at the venue (which may have no internet).

### Before the event

- Use this laptop's **Chrome** browser. (Other browsers haven't been tested — Chrome is the one to use.)
- Plug in your mic and speakers/PA before you start.
- You'll need **Python** installed on this laptop. Just try the start file below first — if it shows an error about Python not being found, download it free from [python.org/downloads](https://www.python.org/downloads/) — on Windows, tick "Add Python to PATH" during install — then try again.

### Starting it up

1. **Windows:** double-click `start.bat`.
   **Mac:** double-click `start.command`. (First time only, macOS may block it — right-click it and choose "Open" instead of double-clicking. If it says "permission denied," open Terminal, type `chmod +x ` (with a space after), drag `start.command` into the window, and press Enter — then try double-clicking again.)
2. A window will pop up and run in the background, and your browser should open to the app automatically. **Don't close that window while you're using the app** — closing it shuts the whole thing down. If the browser doesn't open by itself, just open Chrome and go to `http://localhost:8000`.
3. Click the **Start** button in the top left. Your browser will ask for microphone permission — click **Allow**.
4. If you've got more than one mic plugged in, pick the right one from the dropdown next to Start.

Across the top, the status strip shows whether the engine is **Stopped** or **Live**, along with small readouts for sample rate, latency, and how many effects are in your chain.

### Building your sound

- The left panel has your effects (Gain, Compressor, EQ, Delay, Reverb, Limiter). **Drag one into the middle column** to add it to the chain — or just click it (Tab to it and press Enter works too; new effects are added just before the limiter so it stays last). The chain flows top to bottom by default, mic in at the top and sound out at the bottom. Prefer the old left-to-right view? The **FLOW** button under the chain flips it back, and it remembers your choice.
- The meters on the **MIC IN** and **OUT** bars show your incoming and outgoing levels at a glance, and the small **OUT** readout pinned at the bottom of the chain area shows your output level even when the chain is too long to fit on screen.
- **Drag to reorder** — grab a card by its `⋮⋮` handle and drop it where you want.
- Click the **×** on a card to remove it.
- Use the sliders under each effect to tune it. Click a card's chevron (**▾**) to collapse it — its controls tuck away, but the effect keeps working.

### Saving your setup

The right panel is **Presets**, and it ships with a built-in factory library — Classic Karaoke, Warm Ballad, Rock Night, Phone Call Gag, Big Room, and Clean Speech — load-only starting points grouped above your own saved presets, so a fresh install has good sounds before you save anything. Once you've got a sound you like, hit **Save As…**, type a name right there in the panel, and press **Save** — it's stored for next time. Use the dropdown + **Load** to bring one back, or **Delete** to remove one you don't need anymore (click it twice — the first click just asks "DELETE?" and backs off if you change your mind). Your chain also auto-saves as you go, so if you close the app by accident, reopening it picks up right where you left off.

### Agent control (optional, experimental)

Everything in the judges' section above also works locally: the app exposes its chain-building controls as WebMCP tools, so you can ask in plain language — "give me a warm ballad vocal with light hall reverb" — and watch the chain build itself, with a plain summary of every change and one-click **Undo**. This is entirely optional, and manual control always remains the primary way to work the app, especially for live events. See **Optional Chrome diagnostics** above for the Chrome path, or open `http://localhost:8000/?dev` for the Agent Harness.

### ⚠️ If something sounds wrong — Emergency Bypass

The big red **Bypass** button (top right) instantly cuts every effect and sends the raw, clean mic signal straight through. Use it the moment anything sounds off — feedback, a glitch, an effect that's too much. It works from the button, or just **hit the spacebar** — no need to click anything, so you can hit it fast from across the room if someone else has the laptop. Hit it again (or spacebar again) to bring your effects back.

**When in doubt, hit Bypass first and figure out the problem after** — better a plain mic than a bad sound in front of a room full of people.

### If something's not working

- **No sound at all:** check the mic dropdown has the right device selected, and that your browser actually got mic permission (look for a camera/mic icon in the address bar).
- **Browser didn't open on its own:** open Chrome yourself and go to `http://localhost:8000`.
- **"Python not found" message:** see the Python note above.
- **Still stuck:** hit Bypass so the show can go on with a clean mic, then sort it out at the break.

## Demo video

<!-- RECORDING PLACEHOLDER — user's manual step -->

**[YouTube link goes here — under 3 minutes, with audio]** (not recorded yet)

Recording checklist (the judge script above doubles as the shot list):

1. Open the live URL in the in-app browser; show the console and status strip. (~10 s)
2. Ask the agent for a warm ballad vocal with light reverb; show the chain building, the summary toast, one-click Undo. (~40 s)
3. Ask the agent to remove the limiter; show the refusal toast. (~20 s)
4. Show `?dev` Agent Harness: run `get_capabilities`, then `set_chain`, then Undo. (~40 s)
5. Brief manual pass: drag a node, move a slider, hit Bypass (spacebar), engine Start with real mic audio. (~50 s)

## License & credits

This project is open source under the MIT License — see [LICENSE](LICENSE).
Two bundled third-party pieces ship under their own terms, detailed in
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md): **Sortable.js 1.15.7**
(MIT, vendored for drag-and-drop) and the **reverb impulse response**
"IR Rollo Transparent Plate" by Rollo145 (CC0 1.0, from Freesound).
