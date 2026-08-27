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

## Building your sound

- The left panel has your effects (Gain, Compressor, EQ, Delay, Reverb, Limiter). **Drag one into the middle column** to add it to the chain.
- **Drag to reorder** — grab a card by its `⋮⋮` handle and drop it where you want.
- Click the **×** on a card to remove it.
- Use the sliders under each effect to tune it.

## Saving your setup

The right panel is **Presets**. Once you've got a sound you like, hit **Save As…**, give it a name, and it's saved for next time. Use the dropdown + **Load** to bring one back, or **Delete** to remove one you don't need anymore. Your chain also auto-saves as you go, so if you close the app by accident, reopening it picks up right where you left off.

## ⚠️ If something sounds wrong — Emergency Bypass

The big red **Bypass** button (top right) instantly cuts every effect and sends the raw, clean mic signal straight through. Use it the moment anything sounds off — feedback, a glitch, an effect that's too much. It works from the button, or just **hit the spacebar** — no need to click anything, so you can hit it fast from across the room if someone else has the laptop. Hit it again (or spacebar again) to bring your effects back.

**When in doubt, hit Bypass first and figure out the problem after** — better a plain mic than a bad sound in front of a room full of people.

## If something's not working

- **No sound at all:** check the mic dropdown has the right device selected, and that your browser actually got mic permission (look for a camera/mic icon in the address bar).
- **Browser didn't open on its own:** open Chrome yourself and go to `http://localhost:8000`.
- **"Python not found" message:** see the Python note above.
- **Still stuck:** hit Bypass so the show can go on with a clean mic, then sort it out at the break.
