// QA-3 live-agent driver — docs/ultron/qa/qa3-driver.js
//
// D2 amendment #2 (2026-08-28): the Inspector extension is incompatible
// with the user's browser (Arc). The NL→chain planning is performed by
// the ZCode agent; execution goes through the PAGE'S REGISTERED TOOLS via
// document.modelContext.getTools()/executeTool() — the browser's real
// WebMCP invocation surface (same path agents use). The user judges
// usability per prompt; undoAll() verifies exact-state restoration.
//
// USAGE (app tab, engine STARTED, DevTools console):
//   const QA3 = (await import('/docs/ultron/qa/qa3-driver.js')).QA3;
//   await QA3.run(1);     // build prompt 1's chain (+ one param tweak)
//   ...user listens & rates...
//   await QA3.undoAll();  // undo everything; verifies exact restore
//   await QA3.run(2); ... through 5.
//
// Chain designs respect the published policy (rq3): limiter required and
// terminal; total gain budget incl. 0.57×|threshold| makeup ≤ +12 dB;
// EQ per-band boost ≤ +9, sum ≤ +12; feedback ≤ 70%; ≤2 compressor-type.

const CHAINS = {
  1: { // Warm ballad: gentle compression, low warmth, light hall reverb
    schemaVersion: 1, name: 'QA3 warm ballad',
    nodes: [
      { id: 'qa-g1', type: 'gain', params: { gainDb: 1 } },
      { id: 'qa-e1', type: 'eq', params: { lowGain: 1, midGain: 0, highGain: 0.5 } },
      { id: 'qa-c1', type: 'compressor', params: { threshold: -10, ratio: 2.5, attack: 0.02, release: 0.3 } },
      { id: 'qa-r1', type: 'reverb', params: { mix: 35 } },
      { id: 'qa-l1', type: 'limiter', params: { ceiling: -6, release: 150 } },
    ],
  },
  2: { // Rock shout: stronger compression, top-end bite, short slap, dry
    schemaVersion: 1, name: 'QA3 rock shout',
    nodes: [
      { id: 'qa-g2', type: 'gain', params: { gainDb: 0 } },
      { id: 'qa-e2', type: 'eq', params: { lowGain: -1, midGain: 0, highGain: 2 } },
      { id: 'qa-c2', type: 'compressor', params: { threshold: -11, ratio: 4, attack: 0.004, release: 0.18 } },
      { id: 'qa-d2', type: 'delay', params: { timeMs: 110, feedback: 15, mix: 18 } },
      { id: 'qa-l2', type: 'limiter', params: { ceiling: -6, release: 100 } },
    ],
  },
  3: { // Phone-filter gag: band-limited, slightly crushed, intelligible
    schemaVersion: 1, name: 'QA3 phone call',
    nodes: [
      { id: 'qa-e3', type: 'eq', params: { lowGain: -10, midGain: 2, highGain: -8 } },
      { id: 'qa-c3', type: 'compressor', params: { threshold: -10, ratio: 8, attack: 0.002, release: 0.12 } },
      { id: 'qa-l3', type: 'limiter', params: { ceiling: -6, release: 80 } },
    ],
  },
  4: { // Big-room epic: long reverb, wide delay, vocal up front
    schemaVersion: 1, name: 'QA3 big room',
    nodes: [
      { id: 'qa-g4', type: 'gain', params: { gainDb: 1 } },
      { id: 'qa-e4', type: 'eq', params: { lowGain: 0.5, midGain: 0, highGain: 1 } },
      { id: 'qa-c4', type: 'compressor', params: { threshold: -8, ratio: 2.5, attack: 0.015, release: 0.35 } },
      { id: 'qa-d4', type: 'delay', params: { timeMs: 320, feedback: 30, mix: 22 } },
      { id: 'qa-r4', type: 'reverb', params: { mix: 50 } },
      { id: 'qa-l4', type: 'limiter', params: { ceiling: -6, release: 180 } },
    ],
  },
  5: { // Clean speech: light leveling, no audible effects
    schemaVersion: 1, name: 'QA3 clean speech',
    nodes: [
      { id: 'qa-e5', type: 'eq', params: { lowGain: -1, midGain: 0, highGain: -1 } },
      { id: 'qa-c5', type: 'compressor', params: { threshold: -10, ratio: 2, attack: 0.005, release: 0.2 } },
      { id: 'qa-l5', type: 'limiter', params: { ceiling: -6, release: 120 } },
    ],
  },
};

// One set_param tweak per prompt — exercises the param tool + an extra
// undo entry beyond the single set_chain write.
const TWEAKS = {
  1: { name: 'set_param', args: { nodeId: 'qa-r1', param: 'mix', value: 40 } },
  2: { name: 'set_param', args: { nodeId: 'qa-d2', param: 'mix', value: 22 } },
  3: { name: 'set_param', args: { nodeId: 'qa-c3', param: 'ratio', value: 10 } },
  4: { name: 'set_param', args: { nodeId: 'qa-r4', param: 'mix', value: 55 } },
  5: { name: 'set_param', args: { nodeId: 'qa-c5', param: 'threshold', value: -12 } },
};


// NOTE (2026-08-28, post-run): undoAll() compares against the MOST
// RECENT run()'s pre-capture. If you run several prompts before one
// undoAll(), it will report FAIL against the wrong checkpoint even
// though the restore is correct — the stack always unwinds to the FIRST
// run's origin. Verify by fingerprint (e.g. the default preset's
// ceiling:-1). A future driver could pin the true origin.

function norm(view) {
  const o = JSON.parse(view);
  return {
    name: o.name,
    nodes: (o.nodes || []).map((n) => ({ id: n.id, type: n.type, params: n.params })),
  };
}

const QA3 = {
  pre: null,
  _tools: null,

  async _tool(name) {
    if (!this._tools) {
      const mc = document.modelContext || navigator.modelContext;
      this._tools = await mc.getTools();
      console.log('[QA3] tools registered:', this._tools.map((t) => t.name).join(', '));
    }
    const t = this._tools.find((x) => x.name === name);
    if (!t) throw new Error('tool not registered: ' + name);
    return t;
  },

  async exec(name, args) {
    const mc = document.modelContext || navigator.modelContext;
    const tool = await this._tool(name);
    let raw;
    // Arc/Chromium's executeTool argument parsing is in flux (RQ-1 warned):
    // try object inputObject (spec), then JSON-string, then the ?dev
    // harness's defs-direct path (same validated execute functions the
    // DevTools pane and MC-6 demo use). Whichever works is logged.
    try {
      raw = await mc.executeTool(tool, args);
    } catch (e1) {
      try {
        raw = await mc.executeTool(tool, JSON.stringify(args));
        console.warn('[QA3] note: this build wants executeTool args as a JSON string');
      } catch (e2) {
        if (window.McpHarness && typeof window.McpHarness.run === 'function') {
          console.warn('[QA3] browser executeTool failed in this build ("' +
            (e1 && e1.message) + '") — using McpHarness defs-direct path (?dev)');
          const viaHarness = await window.McpHarness.run(name, args);
          console.log('[QA3] ' + name + ' →', viaHarness);
          return viaHarness;
        }
        throw e2;
      }
    }
    let parsed = raw;
    try { parsed = JSON.parse(raw); } catch (e) { /* already an object */ }
    console.log('[QA3] ' + name + ' →', parsed);
    return parsed;
  },

  async run(n) {
    if (!CHAINS[n]) throw new Error('prompt 1-5 only');
    console.log('%c[QA3] === PROMPT ' + n + ' ===', 'font-weight:bold');
    this.pre = await this.exec('get_chain', {});
    const built = await this.exec('set_chain', { chain: CHAINS[n] });
    if (built && built.error) { console.warn('[QA3] set_chain refused — see above'); return built; }
    const tweak = await this.exec(TWEAKS[n].name, TWEAKS[n].args);
    console.log('[QA3] chain live — LISTEN & RATE, then call QA3.undoAll()');
    return { built, tweak };
  },

  async undoAll() {
    let n = 0;
    while (window.AgentUI && window.AgentUI.canUndo()) {
      window.AgentUI.undo();
      n++;
      await new Promise((r) => setTimeout(r, 350)); // let restores settle
    }
    await new Promise((r) => setTimeout(r, 700));
    const now = await this.exec('get_chain', {});
    const match = JSON.stringify(norm(JSON.stringify(now))) === JSON.stringify(norm(JSON.stringify(this.pre)));
    console.log('%c[QA3] undos applied: ' + n + ' · exact restore: ' + (match ? 'PASS ✓' : 'FAIL ✗'), 'font-weight:bold');
    if (!match) {
      console.log('[QA3] pre :', JSON.stringify(norm(JSON.stringify(this.pre))));
      console.log('[QA3] now :', JSON.stringify(norm(JSON.stringify(now))));
    }
    return match;
  },
};

export { QA3 };
