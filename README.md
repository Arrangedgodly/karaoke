# VOXCHAIN

**Live: https://voxchain.arrangedgodly.com/**

A live vocal chain in your browser for streaming, games, karaoke, and voice experiments: mic in → 14 effects (gain, compression, EQ, delay, reverb, limiter, noise gate, distortion, chorus, autotune, pitch shift, tremolo, bitcrusher, phaser) → your output. Zero install, works fully offline, and an AI agent in the browser can build and edit the chain from plain language via [WebMCP](https://developer.chrome.com/docs/ai/webmcp).

Competition work is governed by the [WebMCP Challenge brief and change gate](docs/WEBMCP-CHALLENGE.md). Physical audio and competition-client checks remain separate in [docs/ACCEPTANCE.md](docs/ACCEPTANCE.md).

![VOXCHAIN — the dark instrument console: system deck on top, palette / free cord board / presets on the voice deck below](docs/screenshot.png)

The console live: the default chain on the free board, cords carrying the signal left to right, meters reading real levels.

## For judges: the 60-second path

Everything below works on the deployed site, no local setup, no Chrome flags.

1. Open **https://voxchain.arrangedgodly.com/** in the Codex (or ChatGPT) in-app browser.
2. Ask the agent, in plain language: *"Set up a warm ballad vocal with light reverb."* Watch the chain rebuild itself, a plain-English summary toast of every change, and a one-click **Undo** on the toast.
3. Ask for something unsafe: *"Remove the limiter."* The agent is refused by the app's built-in policy — you get a refusal toast showing what was asked versus what's allowed. The limiter stays.
4. Safety stays human: the red **Bypass** button (or the **spacebar**) always works and no agent can touch it.

**No agent handy?** Open **https://voxchain.arrangedgodly.com/?dev** — an **Agent Harness** panel appears where you can run all 10 WebMCP tools directly with example inputs and watch change summaries, refusals, and Undo live. Start with `get_capabilities`, then `set_chain` (prefilled with a valid example), then hit Undo.

### No MCP server or side package

This is browser-native **WebMCP**, not a conventional local or remote MCP server. The top-level page registers its tools directly with `document.modelContext.registerTool(...)` during normal page load. A supported ChatGPT/Codex built-in browser discovers those page-scoped tools automatically while the page is open.

Judges do not need an MCP package, manifest, connector, API key, local process, browser extension, `?dev`, or separate connection. The Devpost Plugin helps with the competition workflow, and Chrome's Model Context Tool Inspector helps developers inspect tools. Neither is part of this app's runtime.

The WebMCP and shared-mutation implementation centers on three plain browser scripts:

- `src/mcp-server.js` is the small in-page WebMCP registration adapter. Despite the historical filename, it is not a server and has no transport.
- `src/mcp-tools.js` defines the ten page tools and their validation and safety policy.
- `src/chain-editing.js` is the one mutation interface shared by human gestures, WebMCP, preset loads, startup restore, and Undo. It commits the live audio graph and rendered canvas transactionally, preserves the parameter-only no-rebuild path, and reports autosave/rollback truthfully.

See [RQ-6: WebMCP competition and judge-client contract](docs/ultron/research/rq6-webmcp-competition-client.md) for the source-backed architecture review.

### Optional Chrome diagnostics

These steps are useful for development, but they are not the competition's built-in-browser path and are not prerequisites for judges:

1. Go to `chrome://flags/#enable-webmcp-testing`, set it to **Enabled**, and restart Chrome.
2. Open the app as usual.
3. Open DevTools (**F12**) → **Application** → **WebMCP** — you should see the app's 10 tools listed there, and you can run any of them by hand.
4. Optionally install the **Model Context Tool Inspector** Chrome extension to exercise the tools through a development agent.

Chrome's flag, DevTools pane, Inspector extension, and this project's `?dev` harness are independent diagnostic paths. Passing one of them does not by itself prove that the ChatGPT/Codex built-in browser discovered and used the tools.

## Who controls what

**A human can do everything:** build, reorder, tune, bypass individual effects, save, start/stop the engine, pick the mic, hit emergency Bypass.

**An agent can:**
- Read the current chain, the presets, and what the app is capable of.
- Add, remove, and reorder effects, and set parameters — within published safety limits.
- Retrieve and load presets (factory or saved), and save new ones.

Chain mutations are refused with a stable `ENGINE_NOT_STARTED` result until the operator presses Start — the human board is gated before the engine is live, so an agent edit would otherwise change state the operator cannot see. Reads work at any time.

**An agent cannot (human-only):**
- Touch the red emergency **Bypass** — it works from the button or the **spacebar**, always.
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
| `get_capabilities` | read | Focused policy ranges or a compact sound-design guide that maps plain-language goals to safe effects. |
| `get_chain` | read | The live chain, serialized in the exact shape `set_chain` accepts, with engine/preset context. |
| `set_chain` | write | Replace the whole chain in one validated pass (also the preset-loading path). |
| `add_node` | write | Insert one effect node (position optional). |
| `remove_node` | write | Remove one node — refused if it breaks a chain rule (e.g. the limiter). |
| `set_param` | write | Set a single parameter with a policy check — ramped over ~15 ms on every AudioParam-backed control (three Tone plain-property params are documented immediate-write exceptions). |
| `list_presets` | read | Factory library plus the user's saved presets. |
| `get_preset` | read | One listed preset's complete nodes, without loading it (namespace explicit when a name exists in both groups). |
| `load_preset` | write | Load a listed preset as the live chain — same policy and visible UI path as `set_chain`, with summary toast and Undo. |
| `save_preset` | write | Save the current chain as a named preset. |

`get_capabilities` has two focused responses. The default `policy` response
lists exact parameters, ranges, and chain rules. The optional `sound_design`
response translates language such as "deeper," "a little reverb," "ghostly,"
"warm," "clear," "thick," "gritty," "robotic," "transposed," "spacey,"
"warble," and "lo-fi" into safe starting ranges, and its verify workflow has
the agent read `get_chain`'s output authority (Bypass / watchdog mute) before
asking the human to listen. The browser agent still interprets the request.
The app supplies the audio vocabulary, enforces every resulting change, and
stays LLM-free.

## Shared-state architecture

Agent and human drive the **same accepted model, UI, and audio graph** through `ChainEditing`; neither the canvas nor WebMCP owns a competing mutation path. Structural edits stage and commit the audio graph before the canvas and autosave advance, while one-parameter edits keep their existing live ramp without rebuilding cards or ducking the chain. Every agent mutation produces a change summary plus one-click Undo; a watchdog guards the output; the chain auto-saves. The app itself is **LLM-free**: no API keys, no cloud calls — all the intelligence runs in the agent's (or the human's) hands, and the app just enforces its safety contract.

## Verification

```sh
node tests/run.js
```

Zero dependencies — needs only Node, works from a clean clone; exit code 0 means green. The suite covers: 10-tool registration, policy round-trips of all factory presets, safety refusals, the node-reuse type guard, watchdog tap/latch, mutation + undo, persistence honesty, param-only ramps, the preset retrieve/load tools, the four cycle-3 effects (Noise Gate, Distortion, Chorus, Autotune) and the four Tone.js effects (Pitch Shift, Tremolo, Bitcrusher, Phaser) — audio structure, palette cards, discrete key/scale params, agent string params, and preset round-trips — plus the 2026-08-31 submission-hardening round: pre-Start mutation refusal, crash rollback honesty, superseded-rebuild disposal, the autosave-failure latch, sound-design guide identity/direction/degraded-registry filtering, and the output-authority readout.

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

- The left panel has your effects — the originals (Gain, Compressor, EQ, Delay, Reverb, Limiter), the cycle-3 four (Noise Gate, Distortion, Chorus, Autotune), and the Tone.js four (Pitch Shift, Tremolo, Bitcrusher, Phaser). **Click a chip to add it** to the chain — Tab to a chip and press Enter works too, and new effects are added just before the limiter so it stays last. The board reads left to right, mic in on the left, sound out at the bottom-right port; nothing rearranges your cards but you.
- The meters on the **MIC IN** (top-left) and **OUT** (bottom-right) units show your incoming and outgoing levels at a glance; the **OUT** readout is pinned to the board's base plate so it stays visible even when the chain is longer than the screen.
- **Move a section** — drag it by its header anywhere on the board. Moving (or resizing) a section never changes your sound; the arrangement is saved automatically.
- **Resize a section** — drag the machined corner mark at its bottom-right to widen it; controls re-wrap to fill the wider card.
- **Reorder by cord** — drag from a jack point on one card to a jack point on another. The sound changes only when the link completes; drop the cord on empty space and it snaps back with nothing changed.
- Click **IN** on a card to bypass only that effect. It changes to **BYP** while the card, settings, and plugin stay in the chain; click again to return it to the signal path.
- Click the **×** on a card to remove it.
- Tune with the knobs and sliders under each effect — Autotune's **Key** and **Scale** are pressable pads instead of sliders. Click a card's chevron (**▾**) to collapse it — its controls tuck away, but the effect keeps working.

### The four newer effects — what they're for

**Noise Gate** — turns the mic down automatically whenever nobody is singing, and brings it straight back the moment someone does. Four controls: **Threshold** (how loud a sound must be to count as "singing" — raise it until the room stops getting through), **Attack** and **Release** (how fast the gate opens on a note and closes after it), and **Floor** (how far down it ducks between phrases — all the way down is fully muted). **Reach for it in noisy rooms** — bar chatter, fans, PA spill between songs — so the PA goes quiet between singers without you touching anything. The defaults are deliberately gentle; if it chops the ends off words, lengthen Release.

**Distortion** — adds grit and edge: a saturated, growly, "turned-up-too-loud" character over the voice. **Drive** is the amount (25 % is a light warmth, 100 % is a full roar), **Tone** rolls the brightness from dark to bright, **Output** sets the level — capped so that even at maximum it can't boost past unity and slam the chain (your limiter still has the last word). **Reach for it on rock numbers.** One honest note: unlike the other effects, Distortion has no perfectly clean "zero" — Drive at 0 still colors the sound slightly by design; the truly clean comparison is **Bypass**.

**Chorus** — thickens and widens the voice: two extra copies of the vocal, drifting slowly out of tune left and right around the original. **Depth** is how far they wander, **Rate** is how fast they wander, **Mix** is how much of the effect you hear. The defaults (Depth 3 ms, Rate 1.5 Hz, Mix 30 %) give a subtle widening; push Depth and Rate up for full seasick 80s warble. **Reach for it on ballads**, or to make one singer sound like two. It's a stereo effect — it shows best on headphones or a stereo PA — and it's built to stay safe even if the PA folds the signal down to mono.

**Autotune — Experimental** — listens to the pitch of the vocal and pulls each note toward the key and scale you pick. **Key** and **Scale** are dropdowns (any of the 12 keys; Chromatic, Major, or Minor), **Retune Speed** sets the character — 0 ms is the instant hard-tune "robot" snap, higher values (up to half a second) glide gently toward the right notes instead — and **Mix** blends the corrected voice with the original. **Reach for it as a deliberate effect**, and pick the song's actual key — a wrong key gives the classic wrong-key robot sound (which is a choice, if you mean it). Two things to know:

- It carries an **Experimental** badge — on its palette chip (as "EXP") and its card. It's the newest engine in the app and isn't in any factory preset yet; try it at rehearsal before a show.
- It adds a fixed **20 ms delay** (a fiftieth of a second) to the vocal. You won't notice it while singing, but if you A/B it against the dry sound the corrected voice lands a hair late. That's the engine's declared latency — expected behavior, not a fault.

**Want to hear all four before a show?** They were accepted on a fixed test vocal — `assets/test-vocal.mp3` (CC0; source credited in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)) — and you can reproduce exactly that demo yourself: with Node and ffmpeg installed, run `node tests/qa-out/run-qa1.js`, then follow the guided A/B listening order in [`tests/qa-out/LISTENING.md`](tests/qa-out/LISTENING.md). It renders before/after audio for every effect at default and extreme settings, offline, through the same node code the app runs live.

### The Tone.js four — what they're for

Four more effects (Pitch Shift, Tremolo, Bitcrusher, Phaser) built on the vendored [Tone.js](https://tonejs.github.io) 15.1.22 — promoted out of experimental status 2026-08-31.

**Pitch Shift** — the app's only *actual* pitch control: it moves the voice up or down in semitones (±12; keep |shift| ≤ 7 for intelligibility). "Take it up 2 semitones" when the backing track sits above the singer. **Mix** blends shifted and original.

**Tremolo** — volume wobble: amplitude dips and swells at an adjustable **Rate** (0.1–20 Hz) and **Depth**. Slow rates read as gentle breathing; mid rates are the classic 60s surf shimmer.

**Bitcrusher** — lo-fi digital grunge: it re-quantizes the signal to fewer **Bits** (1–8 — *fewer bits = more crushed*) and blends it with the clean signal via **Mix**. The factory "Phone Call Gag" preset uses the telephone-voice end of this range.

**Phaser** — a sweeping, spacey filter sweep: **Rate** sets how fast the notch rides (0.05–8 Hz), **Depth** how far (0–100 %), **Base** where the sweep starts (50–1500 Hz). Slower rates with high depth give the "spacey" vocal bed; like chorus it reads best in stereo. One honest note: pitch shift's `pitch` and phaser's `depth`/`baseHz` are Tone.js plain properties with no rampable AudioParam underneath — the app's published click-safe-ramp promise names exactly these three as immediate-write exceptions (see `get_capabilities`).

### Saving your setup

The right panel is **Presets**, and it ships with a built-in factory library — Classic Karaoke, Warm Ballad, Rock Night, Phone Call Gag, Big Room, and Clean Speech — load-only starting points grouped above your own saved presets, so a fresh install has good sounds before you save anything. Once you've got a sound you like, hit **Save As…**, type a name right there in the panel, and press **Save** — it's stored for next time, including each effect's IN/BYP state. Use the dropdown + **Load** to bring one back, or **Delete** to remove one you don't need anymore (click it twice — the first click just asks "DELETE?" and backs off if you change your mind). Your chain also auto-saves as you go, so if you close the app by accident, reopening it picks up right where you left off.

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
Bundled third-party pieces ship under their own terms, detailed in
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md): **Tone.js 15.1.22** (MIT,
vendored for the four Tone-backed effects), the **reverb impulse response**
"IR Rollo Transparent Plate" by Rollo145 (CC0 1.0, from Freesound), and the
**test vocal** by Ehved (CC0 1.0, from Freesound). (Sortable.js was retired
with the palette drag on 2026-08-31 and is no longer bundled.)
