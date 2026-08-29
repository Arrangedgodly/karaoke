# Karaoke Chain Builder — How to Run It

This turns your laptop into a live vocal effects box for karaoke: mic in, effects (reverb, delay, compression, EQ) applied live, sound out to your speakers. No internet needed once it's on your laptop.

## Before the event

- Use this laptop's **Chrome** browser. (Other browsers haven't been tested — Chrome is the one to use.)
- Plug in your mic and speakers/PA before you start.
- You'll need **Python** installed on this laptop. Just try the start file below first — if it shows an error about Python not being found, download it free from [python.org/downloads](https://www.python.org/downloads/) — on Windows, tick "Add Python to PATH" during install — then try again.

## Starting it up

1. **Windows:** double-click `start.bat`.
   **Mac:** double-click `start.command`. (First time only, macOS may block it — right-click it and choose "Open" instead of double-clicking. If it says "permission denied," open Terminal, type `chmod +x ` (with a space after), drag `start.command` into the window, and press Enter — then try double-clicking again.)
2. A window will pop up and run in the background, and your browser should open to the app automatically. **Don't close that window while you're using the app** — closing it shuts the whole thing down. If the browser doesn't open by itself, just open Chrome and go to `http://localhost:8000`.
3. Click the **Start** button in the top left. Your browser will ask for microphone permission — click **Allow**.
4. If you've got more than one mic plugged in, pick the right one from the dropdown next to Start.

Across the top, the status strip shows whether the engine is **Stopped** or **Live**, along with small readouts for sample rate, latency, and how many effects are in your chain.

## Building your sound

- The left panel has your effects (Gain, Compressor, EQ, Delay, Reverb, Limiter). **Drag one into the middle column** to add it to the chain — the chain flows top to bottom by default, mic in at the top and sound out at the bottom. Prefer the old left-to-right view? The **FLOW** button under the chain flips it back, and it remembers your choice.
- The meters on the **MIC IN** and **OUT** bars show your incoming and outgoing levels at a glance.
- **Drag to reorder** — grab a card by its `⋮⋮` handle and drop it where you want.
- Click the **×** on a card to remove it.
- Use the sliders under each effect to tune it. Click a card's chevron (**▾**) to collapse it — its controls tuck away, but the effect keeps working.

## Saving your setup

The right panel is **Presets**, and it ships with a built-in factory library — Classic Karaoke, Warm Ballad, Rock Night, Phone Call Gag, Big Room, and Clean Speech — load-only starting points grouped above your own saved presets, so a fresh install has good sounds before you save anything. Once you've got a sound you like, hit **Save As…**, give it a name, and it's saved for next time. Use the dropdown + **Load** to bring one back, or **Delete** to remove one you don't need anymore. Your chain also auto-saves as you go, so if you close the app by accident, reopening it picks up right where you left off.

## 🤖 Agent control (optional, experimental)

The app can expose its chain-building controls as tools for an AI agent in your browser (via WebMCP, a new web standard). So you can ask in plain language — "give me a warm ballad vocal with light hall reverb" — and watch the chain build itself, with a plain summary of every change and one-click **Undo**. This is entirely optional, and manual control always remains the primary way to work the app — especially for live events.

**An agent can:**
- Read your current chain, your presets, and what the app is capable of.
- Add, remove, and reorder effects, and set parameters — within safety limits. Loud values are refused or toned down; every chain keeps its limiter; a hard output ceiling is always on; and a watchdog mutes the output if something starts to howl — bringing it back is a human-only job.

**An agent cannot:**
- Touch **Bypass**, start or stop the engine, or pick the mic device. Safety is always yours.

**Turning it on (Chrome):**

1. Go to `chrome://flags/#enable-webmcp-testing`, set it to **Enabled**, and restart Chrome.
2. Open the app as usual.
3. Open DevTools (**F12**) → **Application** → **WebMCP** — you should see the app's 8 tools listed there, and you can run any of them by hand.
4. To chat with a natural-language agent today: install the **Model Context Tool Inspector** Chrome extension (it's separate from Gemini) and prompt it there.

**Honest status:** Gemini in Chrome does not yet talk to WebMCP tools (as of late August 2026 — Google says it's coming). Everything above works today with the DevTools pane and the Inspector extension; when Gemini support ships, the same steps apply. Worth re-checking [developer.chrome.com/docs/ai/webmcp](https://developer.chrome.com/docs/ai/webmcp) now and then.

**Try it without any agent:** open `http://localhost:8000/?dev` — an **Agent Harness** panel appears where you can run any tool with example inputs, and watch change summaries, refusals, and Undo live.

- Run **get_capabilities** — see everything the app offers an agent.
- Run **set_chain** (it comes prefilled with a valid example) — watch the chain rebuild and a summary toast appear.
- Hit **Undo** — the chain snaps back to exactly what you had.

Every agent change shows a toast with an **Undo** button (or press **Ctrl/Cmd+Z** while a toast is still visible). Refused requests get a toast too, showing what was asked versus what's allowed.

## ⚠️ If something sounds wrong — Emergency Bypass

The big red **Bypass** button (top right) instantly cuts every effect and sends the raw, clean mic signal straight through. Use it the moment anything sounds off — feedback, a glitch, an effect that's too much. It works from the button, or just **hit the spacebar** — no need to click anything, so you can hit it fast from across the room if someone else has the laptop. Hit it again (or spacebar again) to bring your effects back.

**When in doubt, hit Bypass first and figure out the problem after** — better a plain mic than a bad sound in front of a room full of people.

## If something's not working

- **No sound at all:** check the mic dropdown has the right device selected, and that your browser actually got mic permission (look for a camera/mic icon in the address bar).
- **Browser didn't open on its own:** open Chrome yourself and go to `http://localhost:8000`.
- **"Python not found" message:** see the Python note above.
- **Still stuck:** hit Bypass so the show can go on with a clean mic, then sort it out at the break.

## Tests

Run the whole suite with **`node tests/run.js`** — it needs only Node (zero dependencies, no install, no build) and works from a clean clone. It discovers every `tests/test-*.js` file, runs each in its own process, and covers the safety contract (refusals and physical-graph fidelity), WebMCP tool registration, and the earlier issue regressions — exit code 0 means green. Run one file with a filter, e.g. `node tests/run.js safety-refusals`. Physical checks a machine can't prove — real mic through the PA, audible DSP, hidden-tab behavior, the live site — live in [docs/ACCEPTANCE.md](docs/ACCEPTANCE.md).

## License & credits

This project is open source under the MIT License — see [LICENSE](LICENSE).
Two bundled third-party pieces ship under their own terms, detailed in
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md): **Sortable.js 1.15.7**
(MIT, vendored for drag-and-drop) and the **reverb impulse response**
"IR Rollo Transparent Plate" by Rollo145 (CC0 1.0, from Freesound).
