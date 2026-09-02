# The WebMCP Challenge contract

This is the competition brief for VOXCHAIN. It connects the official rules to
product decisions, interface work, acceptance checks, and the final demo.

Official event data was fetched from Devpost on 2026-08-31. The official rules
and the hackathon website control if this file ever disagrees with them:

- [Hackathon home](https://webmcp.devpost.com/)
- [Official rules](https://webmcp.devpost.com/rules)
- [Resources and FAQ](https://webmcp.devpost.com/resources)

## Dates and eligibility

- Registration and submissions close September 3, 2026 at 1:00 PM Pacific.
- Judging runs September 4 at 10:00 AM Pacific through September 21 at 5:00
  PM Pacific.
- Winners are scheduled to be announced around September 23 at 2:00 PM
  Pacific.

Devpost's eligibility summary says:

> Above legal age of majority in country of residence

> Specific countries/territories excluded: Belarus, Brazil, China, Crimea,
> Cuba, Donetsk People's Republic, Hong Kong, Iran Islamic Republic of, Korea
> Democratic People's Republic of, Luhansk People's Republic, Quebec, Russia,
> Syrian Arab Republic, Venezuela

The full eligibility language also requires residence in a country or
territory that supports OpenAI API access and contains conflict-of-interest
and sponsor-related exclusions. Read the official rules before submission.
This file is not a substitute for accepting those terms.

## What must be submitted

The final entry needs all of the following:

- A working live URL that judges can open in ChatGPT's in-app browser or
  Google Chrome with WebMCP enabled.
- A text description that explains why the use case fits WebMCP, how it makes
  the user experience better, what people and agents can do together that was
  previously hard or impossible, and how WebMCP was implemented.
- A public YouTube video under three minutes. It must show the project
  working and include audio that explains the project and WebMCP use.
- A public GitHub, GitLab, or Bitbucket repository with all required source,
  assets, setup instructions, and a detectable open-source license.
- Answers for the submission form, including the live URL, public repository,
  the agent or client used to test WebMCP, AI tools used during development,
  and the team's learning outcome.

The project existed before the submission period. The entry must separate
prior work from meaningful WebMCP work added after August 25, 2026 and support
that distinction with dated commits or equivalent evidence. Judges evaluate
the work added during the submission period.

The live project must remain free and available for judging through the end
of the judging period. If access requires authentication, the submission must
include working credentials and testing instructions. Submission materials
must be in English or include an English translation.

Use only code, media, trademarks, music, APIs, SDKs, and data that the team is
authorized to use. The demo video cannot include copyrighted music or other
third-party material without permission.

## How judging maps to VOXCHAIN

The four criteria are equally weighted. WebMCP Leverage is listed first and
acts as the first tie-breaker.

| Criterion | What VOXCHAIN must prove | Evidence to capture |
| --- | --- | --- |
| WebMCP Leverage | A browser agent can inspect capabilities and current state, build or tune a real chain from plain language, and receive stable safety refusals. | Actual competition-client discovery of all 10 tools. One read, accepted edit, refusal, Undo, and visible shared-state update on the deployed origin. |
| Execution | The result is a coherent product, not a tool-registration demo. Human controls, WebMCP edits, audio state, persistence, and recovery agree. | Green automated suite, clean fresh-browser load, microphone walk, audible DSP check, Bypass check, and truthful error handling. |
| Potential Impact | Non-technical creators can reach a useful or expressive vocal result without learning signal-processing terms. | A short plain-language request, the visible chain result, readable change summary, and a credible use case such as streaming, games, or karaoke. |
| Creativity and Ambition | WebMCP becomes a second control path for a real-time audio instrument while the human keeps final safety authority. | Show the agent changing the same state the person can inspect and edit. Show that Start, microphone choice, watchdog recovery, and Bypass stay human-only. |

## Product and interface guardrails

These survive every layout experiment:

1. **One accepted chain.** Human and WebMCP edits cannot produce competing
   visual and audio state.
2. **Human safety authority.** The agent cannot Start or Stop the engine,
   choose the microphone, engage Bypass, or restore watchdog-muted output.
3. **Visible results.** Every agent mutation changes the visible interface,
   produces a plain change summary, and offers Undo. A refusal must be visible
   and leave the chain unchanged.
4. **Pre-Start parity.** Chain mutations are refused before Start while human
   editing is gated. Reads may remain available.
5. **Audio invariants.** The limiter stays last, the fixed -6 dBFS host
   attenuator stays in place, parameter-only edits avoid graph rebuilds, and
   movement or resizing never changes sound.
6. **Truthful failure.** A tool cannot report success until the model, visible
   control, and live graph accept the same change. Rollback failure must say
   that state may be split.
7. **Direct manipulation remains real.** A person must be able to build and
   tune a chain without an agent. Keyboard access, focus order, reduced-motion
   behavior, and WCAG AA text contrast stay required.
8. **WebMCP stays in the main story.** The normal deployed page registers the
   tools. `?dev` is a diagnostic fallback, not the contest experience.
9. **Prompted sounds can leave the browser.** A person can save the agent's
   result and download a versioned preset file for another VoxChain user.
   Import remains a human UI action and does not inflate the ten-tool WebMCP
   contract.

The current free board, cables, three columns, and separate MIC IN / OUT
objects are not competition requirements. They may be retained, rebuilt, or
removed. Any replacement still needs to make signal order, input and output
levels, live state, safety state, and the selected effect understandable.

## Change gate

Before merging a competition-facing behavior or interface change, answer all
of these with evidence:

- Does `node tests/run.js` pass?
- Does the normal page still register exactly 10 WebMCP tools with the same
  public names and schemas?
- Can a prompted personal preset download, import into a fresh profile, and
  load with the same policy-safe order and values?
- Can the deployed competition client complete the judge path without
  `?dev`?
- Do the human and agent paths still land in the same visible chain?
- Are Start, microphone selection, Bypass, and watchdog restore still
  human-only?
- Does an accepted mutation show a summary and Undo? Does a refusal leave
  state unchanged?
- Does the layout keep Bypass, engine state, output authority, and the chain
  order readable at desktop and mobile widths?
- Did a fresh browser load produce no relevant console, request, or HTTP
  failures?
- If audio code or live parameters changed, did the dated physical checks in
  [ACCEPTANCE.md](ACCEPTANCE.md) pass on the intended microphone, interface,
  output, and volume?
- If submission copy or assets changed, are the README, screenshot, live URL,
  rights record, testing instructions, and dated post-August-25 evidence still
  accurate?

Passing automation does not claim microphone, PA, deployed WebMCP-client, or
Devpost acceptance. Record those checks separately.

## Demo spine

The first 15 seconds should show the product working:

1. Open the deployed page in the competition-capable browser with the engine
   already started.
2. Ask for a concrete result in non-technical language, such as a warm
   streamer voice with restrained reverb.
3. Show the agent tool calls changing the visible chain and live sound.
4. Save the result and download its portable preset file.
5. Show the change summary and Undo.
6. Ask to remove the limiter and show the stable refusal.
7. Close on human Bypass and the one-state human/agent story.

The narration should make the WebMCP fit explicit. VOXCHAIN does not put an
LLM in the audio app. The browser agent supplies the language understanding;
the page supplies truthful state, guarded tools, immediate feedback, and the
real-time audio engine.

## Working status links

- [Competition readiness issue #16](https://github.com/Arrangedgodly/voxchain/issues/16)
- [Judge README and demo issue #15](https://github.com/Arrangedgodly/voxchain/issues/15)
- [Repository metadata and rights issue #14](https://github.com/Arrangedgodly/voxchain/issues/14)
- [Physical click-safety issue #5](https://github.com/Arrangedgodly/voxchain/issues/5)
- [Chain editing transaction issue #20](https://github.com/Arrangedgodly/voxchain/issues/20)
- [Effect catalog issue #21](https://github.com/Arrangedgodly/voxchain/issues/21)
- [Board module issue #22](https://github.com/Arrangedgodly/voxchain/issues/22)

Issues #20 through #22 are architecture work, not proof of submission
readiness. Issue #16 remains the release tracker. The current UI prototypes
are isolated from production so they can challenge the board layout without
silently changing audio or WebMCP behavior.
