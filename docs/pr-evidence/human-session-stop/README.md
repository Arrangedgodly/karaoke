# Start / Stop control screenshots

Captured on 2026-09-02 with Chromium 151.0.7922.34 at a 1440 × 900 viewport.
These captures use Chromium's simulated microphone in fresh browser sessions.
They show interface behavior; they do not establish physical microphone or PA acceptance.

The before images use baseline commit `fa42c5485acc32577b0f128065beff0f603dbb8f`.
The after images use this branch's single Start / Stop control.

| View | Before: audio live | After: audio live | After: audio stopped |
| --- | --- | --- | --- |
| Simple | [Disabled Start](before-simple-live.png) | [Stop](after-simple-live.png) | [Start](after-simple-stopped.png) |
| Advanced | [Disabled Start](before-advanced-live.png) | [Stop](after-advanced-live.png) | [Start](after-advanced-stopped.png) |

The same button becomes Stop during startup and while a microphone session exists.
After Stop, the status reads Stopped, capture and output are released, and the
button returns to Start. The current sound remains available for restart.
