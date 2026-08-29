# RQ-4: Safari-Specific Web Audio API / getUserMedia Behaviors

## Question

What Safari-specific Web Audio API and `getUserMedia` behaviors, as of current Safari versions (checked August 2026, current shipping Safari is **26.x** under Apple's new macOS-aligned version numbering — e.g. Safari 26.5/26.6 on macOS Tahoe), differ from Chrome/Edge/Firefox in ways relevant to the Node-Based Web Audio Chain Builder app, and which of those are basic-functionality-breaking (must handle) versus minor quirks (acceptable to document as known issues)?

**Affected task IDs:** QA-2 ("Cross-browser functional pass") — informs only, non-blocking, does not gate other work. One item below (getUserMedia audio-constraint defaults) is flagged as a possible feedback item into AE-1; see **Implementation consequences**.

## Constraints & evaluation criteria

- Chrome, Edge, Firefox: full functional + stability bar — any regression there is a blocker.
- Safari desktop: **core-functionality-only bar**. A Safari quirk is acceptable to document as a known issue **unless** it breaks one of: mic access, hearing the processed audio/effects, reordering nodes, or the emergency bypass control. Anything that breaks one of those four is a real problem and must be flagged clearly, even though this RQ is nominally non-blocking.
- Each finding below is tagged **functionality-breaking — must handle** or **minor quirk — document as known issue**, with a third tag, **watch item — needs empirical verification**, used where current-day WebKit bug-tracker evidence is stale (last activity 2022–2023) and the actual current-Safari behavior could not be confirmed from documentation alone.

## Findings

### 1. AudioContext creation/resume (autoplay/user-gesture policy)

**Minor quirk — document as known issue, but implementation must be correct (see AE-1 note below).**

- All three engines (Blink/Chrome/Edge, Gecko/Firefox, WebKit/Safari) now converge on the same basic policy: a new `AudioContext` starts `suspended` and audio will not play until `resume()` is called during/after a user gesture. This has been true since roughly 2018 (WebKit's autoplay policy, June 2017 announcement) through Chrome's 2018 autoplay policy change — it is **not** a meaningfully Safari-only restriction anymore. Source: [WebKit auto-play policy blog](https://webkit.org/blog/7734/auto-play-policy-changes-for-macos/), [Chrome autoplay policy](https://developer.chrome.com/blog/autoplay), [MDN Autoplay guide](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay).
- The real Safari-specific trap: **the resolution of a `getUserMedia()` promise does not itself count as a qualifying user gesture in Safari.** (Apple Developer Forums thread: ["Is it possible to play an audio file right after getting the user's camera (getUserMedia) on Safari?"](https://developer.apple.com/forums/thread/690568)) If the app's "Start" flow is `click → await getUserMedia() → then audioContext.resume()`, the `await` breaks the synchronous chain back to the original click in Safari, and `resume()` can silently fail to actually unsuspend the context — audio never plays, with no thrown error. Chrome/Firefox are more lenient here and this exact ordering usually still works in them, which makes the bug easy to miss in cross-browser dev if Safari isn't tested directly.
- Qualifying gesture events per the HTML spec / WebKit implementation: `mousedown`/`click`/`keydown` (excluding Escape and a few reserved keys) qualify; on iOS Safari specifically, `touchstart` has historically **not** reliably counted for Web Audio activation — this is an iOS/mobile nuance, lower relevance for a desktop-Safari-only bar but worth knowing if the app is ever tested on iPad Safari.
- Additional iOS-only background noise (informational, **not** a desktop finding, included for completeness): community reports of the AudioContext "re-locking" after ~5s of inactivity on iOS 18.5, and WebKit bug [237878](https://bugs.webkit.org/show_bug.cgi?id=237878) ("AudioContext is suspended on iOS when page is backgrounded") — fix landed March 2022 but was still reported reproducing on shipped iOS 16.3 as of February 2023, i.e., ~18 months of gap between "fixed in WebKit" and "actually fixed for users." This illustrates that WebKit fix-commit dates don't reliably predict shipped behavior — a general reason to prefer live testing over bug-tracker status alone.

### 2. `webkitAudioContext` prefix

**Non-issue — long obsolete.**

- Unprefixed `AudioContext` has been standard in Safari since **Safari 14.1 (macOS) / iOS 14.5, April 26, 2021**. No currently-supported Safari version requires the `webkitAudioContext` prefix. Source: MDN Browser Compat Data (`api/AudioContext.json`, `baseLatency`/constructor entries show `safari: 14.1`), corroborated by multiple developer references.
- Safe to drop `window.AudioContext || window.webkitAudioContext` fallback code entirely for this app's target-browser list; keeping it is harmless but unnecessary.

### 3. `latencyHint` / default output latency

**Minor quirk — document as known issue.**

- `baseLatency` and the `latencyHint` constructor option (`"interactive"` / `"balanced"` / `"playback"` / numeric) are both supported in Safari since 14.1 (April 2021) per MDN BCD.
- `outputLatency` (the property, distinct from `baseLatency`) is a **recent** Safari addition: MDN marks it "Newly available" as of **March 2025**, and Browser Compat Data lists Safari/Safari-iOS support starting at **version 18.4**. Chrome/Edge have had it since v102 (2022), Firefox since v70 (2019). Practical consequence: if any code reads `audioContext.outputLatency` (e.g., for a latency readout or A/V-sync display), it must feature-detect (`if ('outputLatency' in audioContext)`) because pre-18.4 Safari (still plausibly present on unpatched machines, though most users auto-update) returns `undefined` rather than throwing.
- No authoritative current (2024–2026) head-to-head millisecond benchmark of Safari vs. Chrome/Firefox `baseLatency` on desktop was found. The old "Safari/iOS has much higher default latency" reputation is largely tied to the pre-AudioWorklet, `ScriptProcessorNode`-era Web Audio API and to mobile hardware buffer sizes, not necessarily to current desktop Safari 26.x. **Confidence: medium** — recommend QA-2 empirically log `baseLatency`/`outputLatency` on real Safari 26 during testing rather than relying on old anecdotes.

### 4. ConvolverNode (Reverb effect)

**Watch item — needs empirical verification (soak test); not confirmed functionality-breaking, but plausible.**

- No Safari-specific bug was found that targets `ConvolverNode` itself. The one WebKit tracker item that mentions it (bug [47941](https://bugs.webkit.org/show_bug.cgi?id=47941), "Add ConvolverNode files") is the original 2010-era implementation ticket, long resolved.
- However, a broader, still-open WebKit bug is relevant: [**#221334 — "Audio passed through WebAudio is delayed and glitchy on Safari"**](https://bugs.webkit.org/show_bug.cgi?id=221334) (filed February 3, 2021; status **NEW/open** as of the last recorded activity, November 29, 2022 — no confirmed fix found in research). Reported symptoms: ~1s audio delay (macOS), stuttering/gaps that worsen over time (iOS especially), complete audio silence after prolonged playback, all worse with Bluetooth audio devices; reporters state the same code does **not** reproduce the issue in Chrome or Firefox. A WebKit engineer (Chris Dumez) attributed a likely cause to `MediaElementAudioSourceNode`/`AudioSourceProviderAVFObjC` internals, not specifically the Convolver — but a live signal chain with a Convolver in it is exactly the sustained, continuous-processing scenario this bug describes, and getting audio input via `getUserMedia()` (as this app does) plus Bluetooth was called out as a strong reproduction trigger.
- General (not Safari-specific) fact worth keeping in the checklist regardless: `ConvolverNode` is CPU-expensive in **every** browser for long impulse responses; keep IR files short (a few seconds) to control CPU load.
- **Because "worsening stutter/silence after prolonged playback" would cross into "hearing effects doesn't work" territory (a must-handle bar item) if it reproduces**, this needs to be resolved by testing, not left as an assumption either way.

### 5. `getUserMedia` — permission flow, device enumeration, constraints

Mixed: one **minor quirk**, one **ordering note**, one **watch item** with real relevance to a music/vocal app.

- **Minor quirk:** Safari does not support `navigator.permissions.query({name:'microphone'})` (the Permissions API is effectively unsupported for mic/camera in Safari). Any "check permission state without prompting" UI logic needs a Safari-specific fallback — in practice, just call `getUserMedia()` directly and handle the result/denial, which works identically across all four target browsers.
- **Ordering note (document, not a bug):** Like Chrome, Safari redacts device labels/full device lists in `enumerateDevices()` until `getUserMedia()` permission has been granted (a "device-info" permission gate). Call `getUserMedia()` before `enumerateDevices()` if the app ever needs a device picker with real labels — this affects Chrome too, so it's not Safari-unique, just worth the ordering note.
- **Watch item, higher relevance for this app:** Safari has a documented history of applying non-optional voice-processing filtering to captured microphone audio that clips content above roughly 10–12 kHz, independent of the `echoCancellation` constraint value:
  - [WebKit bug **179411**](https://bugs.webkit.org/show_bug.cgi?id=179411) — "getUserMedia echoCancellation constraint has no effect" (filed Nov 7, 2017 against Safari 11; **RESOLVED FIXED**, closed Nov 19, 2019 — `echoCancellation:false` now actually works to disable the primary filter).
  - Follow-up [WebKit bug **204467**](https://bugs.webkit.org/show_bug.cgi?id=204467) — captured audio still shows near-zero energy above ~10 kHz in Safari's `AnalyserNode` FFT output in some configurations, suggesting the underlying voice-processing I/O (VPIO) path still attenuates high frequencies even when the constraint is nominally off. Filed Nov 21, 2019 against Safari 13; **status: OPEN/NEW**, most recent activity January 26, 2022 (a WebKit engineer suggested exploring `kAudioUnitSubType_HALOutput` to bypass VPIO on macOS as a fix direction — no confirmation this landed).
  - This matters specifically for this app because it processes live vocal/instrument input for effects/monitoring, not a voice call — losing content above 10 kHz is audible (sibilance, cymbals, "air") and would degrade the core "hear the effect chain" experience, which is one of the four basic-functionality items called out in this RQ's evaluation bar.
  - **Confidence: low-medium.** The most recent confirmed WebKit activity is from 2022; it may since have been silently fixed (no bug-tracker update) or may persist in Safari 26. Could not confirm current-day reproduction from documentation alone — this needs a real Safari 26 test.

### 6. AudioWorklet support

**Non-issue for current scope — confirmed foundational fact for Fast-Follow planning.**

- `AudioWorklet` (and `AudioWorkletNode`) has been fully supported in Safari since **14.1 (macOS) / iOS 14.5, April 2021**, per caniuse.com and MDN. All four target browsers (Chrome, Edge, Firefox, Safari) have supported it for years as of August 2026; no caveats or partial-support notes surfaced. This app's planned Fast-Follow noise-gate/autotune work can rely on `AudioWorklet` being present in every target browser without a fallback path for Safari specifically.

### 7. Other Safari-specific real-time audio quirks (2023–2026 developer reports)

- **iOS 26.1 beta regression (informational only, not a desktop finding):** In September 2025, iOS 26.1 beta shipped a regression where `getUserMedia({audio:true})` failed with `"No AVAudioSessionCaptureDevice device"`, breaking every WebRTC/mic-access web app on that beta ([Apple Developer Forums thread](https://developer.apple.com/forums/thread/802555)). It was fixed in Beta 2 (October 2025) before the public release and never reached shipped iOS. Relevance: shows Apple can and does ship audio-input-breaking regressions in beta channels, so a new Safari/iOS beta shouldn't be assumed stable for mic access without a smoke test — but this specific bug is not a concern for currently-shipped Safari 26.x and is iOS (mobile), not desktop.
- **Bluetooth audio device interaction:** Reporters on bug #221334 (above) specifically note symptoms are worse when a Bluetooth audio device is in use. Worth a specific QA-2 test case on macOS Safari if a Bluetooth mic/headset is available, though this is an edge case for what's presumably a desktop-mic use case.
- **No `setSinkId()` / output-device-selection support in Safari** in most configurations. Not relevant to the current node list (no output-device picker described), but worth a one-line note if that feature is ever added later.

## Recommendation & rationale

A concrete checklist QA-2 can test against on real Safari 26.x (macOS):

1. **Gesture → resume ordering (must-handle):** Confirm the app calls `audioContext.resume()` synchronously inside the same user-gesture handler that starts the flow (e.g., the "Start" button's `click` handler), not after an `await getUserMedia()` in between. Test: click Start on Safari, verify the `AudioContext.state` becomes `"running"` and audio is actually audible, not just that `resume()` returns a promise.
2. **Mic access works with no prefix, no permissions-API pre-check (must-handle):** Verify mic permission prompt appears and `getUserMedia()` succeeds without relying on `navigator.permissions.query` for gating UI.
3. **Frequency response check (watch item → escalate if confirmed):** With the effect chain bypassed, feed real audio (voice, or a full-spectrum test tone/music) through the mic input on Safari and inspect output via an analyzer or by ear for content above ~10 kHz. If Safari is silently rolling off high frequencies regardless of `echoCancellation:false`, this should be escalated from "known issue" to "must-handle" and fed back to AE-1 to explicitly set `{echoCancellation:false, noiseSuppression:false, autoGainControl:false}` in the `getUserMedia` audio constraints (good practice on all browsers, but specifically worth confirming it actually suppresses Safari's internal VPIO filtering).
4. **Long-session stability soak test (watch item → escalate if confirmed):** Run the full chain (mic → gain → compressor → filter → delay → **convolver/reverb** → destination) continuously for 15–30+ minutes on Safari, listening for the stutter/delay/silence pattern described in bug #221334. If audio degrades or drops out entirely during this window, that is a functionality-breaking finding ("hearing effects" stops working) and should block, not just get documented.
5. **outputLatency feature-detection (minor, easy fix):** If any code path reads `audioContext.outputLatency`, confirm it's guarded with a feature check rather than assumed present.
6. **enumerateDevices ordering (minor):** If a device picker exists, confirm it calls `getUserMedia()` before `enumerateDevices()` so labels are populated on Safari (and Chrome).
7. **Reordering nodes / emergency bypass (must-handle, sanity check only):** Nothing found in this research suggests Safari has any node-graph-reordering or emergency-bypass-specific bug; these should work identically to Chrome/Firefox since they're standard `AudioNode.connect()/disconnect()` operations. Include them in the QA-2 pass as a basic sanity check, not because a specific Safari risk was identified.

## Evidence

| # | Source | What it establishes |
|---|--------|---------------------|
| 1 | [WebKit auto-play policy blog, June 2017](https://webkit.org/blog/7734/auto-play-policy-changes-for-macos/) | Safari's autoplay restrictions originate from Safari 11/macOS High Sierra; historical baseline (element-focused, not AudioContext-specific in this post). |
| 2 | [Apple Developer Forums: "play audio right after getUserMedia on Safari"](https://developer.apple.com/forums/thread/690568) | getUserMedia's resolution does not count as a Safari user gesture — the key AE-1-relevant nuance. |
| 3 | MDN Browser Compat Data, `api/AudioContext.json` (fetched via raw GitHub, Aug 2026) | `baseLatency`/`latencyHint`: Safari support since 14.1; `outputLatency`: Safari support since **18.4** (Chrome 102, Firefox 70). |
| 4 | [MDN AudioContext.outputLatency](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/outputLatency) | "Newly available" baseline since **March 2025**, confirming outputLatency is a recent addition in Safari. |
| 5 | [caniuse.com: AudioWorklet API](https://caniuse.com/mdn-api_audioworklet) | AudioWorklet supported in Safari since 14.1 (macOS) / iOS 14.5, no caveats. |
| 6 | [WebKit Bugzilla #221334](https://bugs.webkit.org/show_bug.cgi?id=221334) | Open (as of last-checked activity, Nov 2022) report of delayed/glitchy/silent WebAudio playback specific to Safari, worse over time and with Bluetooth; does not reproduce in Chrome/Firefox per reporters. |
| 7 | [WebKit Bugzilla #237878](https://bugs.webkit.org/show_bug.cgi?id=237878) | AudioContext suspension-on-backgrounding bug for iOS; fix committed March 2022 but still reported broken on shipped iOS 16.3 as of Feb 2023 — illustrates fix-commit-to-shipped-fix lag. |
| 8 | [WebKit Bugzilla #179411](https://bugs.webkit.org/show_bug.cgi?id=179411) | echoCancellation constraint had no effect in Safari 11 (2017); resolved fixed Nov 2019. |
| 9 | [WebKit Bugzilla #204467](https://bugs.webkit.org/show_bug.cgi?id=204467) | Follow-up: captured audio still near-zero above ~10kHz in Safari's AnalyserNode in some configs; open, last activity Jan 2022. |
| 10 | [Apple Developer Forums #802555](https://developer.apple.com/forums/thread/802555) | iOS 26.1 beta getUserMedia regression (Sept 2025), fixed in Beta 2 (Oct 2025) before public release. |
| 11 | Macworld / MacRumors / mrmacintosh.com (searched Aug 2026) | Confirms current Safari version numbering is aligned to macOS ("Safari 26.x" on macOS Tahoe), current release ~26.6.2 as of mid-August 2026. |
| 12 | MDN: [MediaTrackSettings.echoCancellation](https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackSettings/echoCancellation), general search results on Safari Permissions API / enumerateDevices | Safari lacks `navigator.permissions.query` support for microphone; enumerateDevices label redaction pattern shared with Chrome. |

## Tradeoffs, risks, confidence

- **High confidence:** items 2 (prefix obsolete), 6 (AudioWorklet supported), and the basic convergence of the gesture/autoplay policy across browsers (item 1's general shape). These are well-documented, stable, multi-source-confirmed facts.
- **Medium confidence:** items 3 (latencyHint/outputLatency specifics — dates are solid, but absolute latency comparison numbers for current desktop Safari were not found) and the general shape of item 5 (permissions API / enumerateDevices ordering).
- **Low-medium confidence, flagged as watch items requiring live testing:** the ConvolverNode/general-pipeline glitch risk (#221334) and the high-frequency-attenuation risk (#204467). Both are based on WebKit bug-tracker entries whose most recent recorded activity is **2022–2023**, well before "current Safari" (26.x, 2026). It is plausible either has been quietly fixed without a tracker update, or that both persist. **This is a real gap in the research** — WebKit Bugzilla search did not surface any 2024–2026-dated comments confirming current status either way, and no independent 2024–2026 developer blog post reproducing (or refuting) either issue on current Safari was found. Do not treat either as confirmed-still-broken or confirmed-fixed; treat as "must verify empirically" per the checklist above.
- **Risk of staleness:** several sources (bug trackers, one Apple forum thread) have gaps of 1–4 years between filing and most recent comment, which is normal for low-traffic WebKit bugs but means "open" status is a weak signal of current relevance either way.

## Implementation consequences

Although this RQ formally "informs QA-2 only," two things should be surfaced to AE-1 (AudioContext bootstrap) directly:

1. **AE-1 should call `audioContext.resume()` synchronously inside the originating user-gesture handler (e.g., directly in the "Start"/mic-enable button's click handler), not after an intervening `await` on `getUserMedia()` or anything else.** If the current or planned bootstrap sequence is `click → await getUserMedia() → create/resume AudioContext`, restructure it so the context is created and `resume()`d synchronously on click (it can be created in a suspended state before permission is even granted), with `getUserMedia()` and node wiring happening afterward. This is a real, previously-undocumented risk specific to Safari's stricter interpretation of "user activation," and it is the kind of bug that passes in Chrome/Firefox testing and silently fails in Safari — worth a one-line requirement in AE-1's task description or a code comment.
2. **AE-1 (or wherever `getUserMedia` constraints are set) should explicitly request `{ echoCancellation: false, noiseSuppression: false, autoGainControl: false }`** given this app processes music/vocal signal rather than voice-call audio. This is good practice everywhere, but is specifically motivated by Safari's history (bugs #179411, #204467) of applying non-optional voice-processing filtering that can attenuate content above ~10 kHz. Flag to QA-2 that if the high-frequency attenuation is still observed on Safari 26.x even with these constraints set, that finding should be escalated from "known issue" to a real bug report against AE-1/the audio-input module, since it directly degrades the "hear the effects" basic-functionality bar for Safari.

No other AE/UI-task changes are indicated by this research.

## Decision priority/status

- **Priority:** P1
- **Status:** proposed (awaiting user approval — not marked committed)
