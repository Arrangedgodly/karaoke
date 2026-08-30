// Generic, data-driven parameter-control component for the Node-Based Web
// Audio Chain Builder.
//
// Loaded as a plain (non-module) <script> — same IIFE pattern as the other
// files in this project, exposing a single `window.ParamControls` namespace
// with one `render` function.
//
// UI-4 scope: render one labeled slider row per entry in a node type's
// paramSpec (src/node-types.js), bound to one model entry (AE-2's
// {id, type, params} shape, src/audio-graph.js). This is the reusable
// rendering machinery the future per-node-type UI (AE-5 through AE-10, and
// the drag-and-drop canvas, UI-3) plugs into — it never needs to know
// anything about what a "gain" or "compressor" IS; it only reads the
// generic {id, label, min, max, default, step, unit} shape from
// NodeTypes.getParamSpec() and calls NodeTypes.applyParam() generically to
// apply a change to the live node.
//
// Two side effects on every slider move, deliberately kept separate (see
// the comments on AudioGraph.updateNodeParams() in src/audio-graph.js and
// NodeTypes.applyParam() in src/node-types.js for the full reasoning):
//   - AudioGraph.updateNodeParams() — updates the MODEL's bookkeeping only.
//     Never touches the live graph, never calls buildGraph().
//   - NodeTypes.applyParam() — updates the LIVE AudioNode directly (a raw
//     AudioParam write, or a very short click-avoiding ramp, entirely at
//     the registered type's discretion). Never goes through buildGraph()
//     either.
// A continuous slider drag fires many `input` events per second; routing
// either of these through buildGraph()'s duck/rebuild/un-duck machinery
// would be both wasteful and audibly wrong (a rebuild-storm of tiny fades
// instead of one smooth, glitch-free parameter change) — buildGraph() is
// NEVER called from this file.
//
// Refinement entry 2 ($impeccable clarify, 2026-08-28) — the plain-language
// layer: one help line per param for the non-engineer operator PRODUCT.md
// declares as the at-risk live user (Threshold/Ratio/Attack-in-seconds and
// friends previously had ZERO plain-language help anywhere — critique P1).
// The layer is ADDITIVE only: the terse-technical silkscreen labels are
// ratified design and stay verbatim, the mono value register is untouched,
// and input semantics/wiring are exactly as before. Each line lives in the
// PLAIN_LANGUAGE_HELP map below — the single source, keyed by node type +
// param id, never duplicated across renderers — and reaches the user three
// ways with no tooltip framework and no new deps:
//   - hover / long-press: the native `title` attribute (row + slider —
//     title tooltips inherit down the subtree);
//   - keyboard: the same `title` on the slider (Chromium also surfaces the
//     title tooltip of a keyboard-focused element);
//   - screen readers: an .sr-only span wired via `aria-describedby` on the
//     slider, so the line is ANNOUNCED WITH the control rather than
//     replacing its label or interrupting the reading flow.
// A param with no map entry renders exactly as it did before this entry.
// Trade-off (deliberate, per the ratified "no tooltip framework" scope):
// native title tooltips are not styleable and their delay is the OS's —
// acceptable for this pass; the copy itself is ours and lives in one place.

(function () {
  'use strict';

  // ---------------------------------------------------------------------
  // Issue #5 — rendered-row registry (for updateControl below).
  //
  // render() keeps each row's <input> and value <span> in closure scope,
  // which is exactly right for the human drag path but leaves no way for
  // an OUTSIDE writer (the agent set_param fast path, via
  // ChainCanvas.updateNodeParam) to move the visible control without
  // re-rendering the whole card. This map is the minimal bridge: render()
  // registers, per model-entry id, one "apply an externally-set value"
  // closure per param row (it updates the slider position, the mono value
  // span, AND this render's workingParams copy — see the input-handler
  // comment below for why that last one matters). Keyed by id and reset at
  // the top of every render() for that id, so a rebuilt card can never
  // leave stale rows behind for its own id.
  // ---------------------------------------------------------------------
  var renderedControls = {};

  /**
   * Move ONE already-rendered param row's visible control to a new value —
   * the slider position and the mono value span, never a re-render. Used
   * by ChainCanvas.updateNodeParam (src/canvas.js) so an agent set_param
   * applied through the parameter-only fast path (issue #5,
   * src/mcp-tools.js) shows up on the card exactly like a human slider
   * move would, without rebuilding any card.
   *
   * Purely presentational + bookkeeping on this render's working copy; it
   * deliberately does NOT touch AudioGraph or any live AudioNode (the
   * caller owns the live write, same division of labor as the input
   * handler below).
   *
   * @param {string} modelEntryId - the id the card was rendered for.
   * @param {string} paramId - the param row to move.
   * @param {number} value - the new value, in the param's own unit.
   * @returns {boolean} true when a rendered row was found and updated;
   *   false when this id/param has no rendered row (unknown node, param
   *   added after the card was rendered, or no card at all — e.g. a bare
   *   harness).
   */
  function updateControl(modelEntryId, paramId, value) {
    var perNode = renderedControls[modelEntryId];
    if (!perNode) {
      return false;
    }
    var row = perNode[paramId];
    if (!row) {
      return false;
    }
    row.apply(value);
    return true;
  }

  /**
   * Refinement entry 2: the plain-language help map — one line per param,
   * keyed `type -> paramId -> line`, in the README's operator voice. No
   * label prefix: the row already silkscreens the label, the tooltip
   * anchors to that row, and screen readers announce the label[for] name
   * before this description — so the line spends its whole budget on the
   * explanation. The riskiest controls (compressor Threshold/Ratio, delay
   * Feedback/Mix, limiter Ceiling — the ones whose mid-show misuse is most
   * consequential) are outcome-framed with an explicit direction clause
   * ("lower = …"). Lines describe only what the matching AudioParam in
   * src/node-*.js actually does; no new factual claims, no marketing voice.
   *
   * Finishing entry 1 (cycle 3, $impeccable clarify — critique P2-1): the
   * four cycle-3 families join the same layer with the same conventions
   * (gate Threshold/Floor, distortion Drive/Output, autotune Retune Speed
   * carry the outcome-framed direction clauses the critique named risky).
   * Autotune's required experimental-status + accepted-20-ms-delay
   * disclosure rides the Key line — the card's FIRST param row and first
   * tab stop — so it is said once per card, not four times; the badge on
   * the same card header (single-sourced from the type's registration)
   * already carries the status visually and pre-add on the chip's
   * aria-label. Operator wording follows README.md's own disclosures.
   */
  var PLAIN_LANGUAGE_HELP = {
    gain: {
      gainDb: 'Overall mic volume. Higher = louder.'
    },
    compressor: {
      threshold: 'Where squashing kicks in. Lower = squeezes more.',
      ratio: 'How hard loud parts get squeezed. Higher = more squash.',
      attack: 'How fast squeezing starts. Smaller = starts sooner.',
      release: 'How fast squeezing lets go. Bigger = lets go slower.'
    },
    eq: {
      lowGain: 'The bass end. Higher = more bass, lower = less.',
      midGain: 'The body of the voice. Higher = fuller, lower = thinner.',
      highGain: 'Brightness and air. Higher = brighter, lower = duller.'
    },
    delay: {
      timeMs: 'The gap between echoes. Longer = a slower echo.',
      feedback: 'How many repeats each echo adds. Higher = more repeats.',
      mix: 'How much echo you hear. Higher = more echo.'
    },
    reverb: {
      mix: 'How much reverb you hear. Higher = more.'
    },
    limiter: {
      ceiling: 'The loudest sound allowed through. Lower = quieter.',
      release: 'How fast the limiter lets go after a loud peak. Smaller = sooner.'
    },
    // Cycle-3 families (finishing entry 1) — palette/registration order.
    distortion: {
      drive: 'How much the voice is pushed into grit. Higher = more growl.',
      tone: 'The brightness of the grit. Higher = brighter, lower = darker.',
      output: 'How loud the grit comes out. Higher = louder, but never louder than the clean signal.'
    },
    chorus: {
      depthMs: 'How far the doubled voices wander from the original. Higher = a wider sweep.',
      rateHz: 'How fast the doubled voices wander. Higher = faster wobble.',
      mix: 'How much doubled voice you hear. Higher = more.'
    },
    gate: {
      threshold: 'How quiet a sound can be before the gate closes on it. Higher = the gate closes on more sounds.',
      attack: 'How fast the gate opens when sound comes back. Smaller = catches the start of words.',
      release: 'How fast the gate closes after sound stops. Bigger = word tails last longer.',
      floor: 'How far down the mic goes while the gate is closed. Lower = quieter between phrases.'
    },
    autotune: {
      key: 'The song\u2019s key. A wrong key makes every correction land wrong. Experimental: the newest engine, and it adds a fixed 20 ms delay (a fiftieth of a second) to the vocal.',
      scale: 'Which notes count as in tune. Chromatic snaps to any note, Major and Minor follow the Key.',
      retune: 'How fast off notes get pulled back in tune. Smaller = instant robot snap, bigger = a smoother glide.',
      mix: 'How much of the corrected voice you hear. Higher = more correction.'
    }
  };

  /**
   * Look up the plain-language line for one param, or null when the map
   * carries none (unknown type, or a param added after this entry — both
   * render exactly as they did before the layer existed).
   *
   * @param {string} type
   * @param {string} paramId
   * @returns {?string}
   */
  function lookupHelpLine(type, paramId) {
    var typeHelp = PLAIN_LANGUAGE_HELP[type];
    if (!typeHelp || !Object.prototype.hasOwnProperty.call(typeHelp, paramId)) {
      return null;
    }
    return typeHelp[paramId];
  }

  /**
   * Format a numeric value with its spec-defined unit for display.
   *
   * Per docs/ultron/design/px2-node-parameters.md's own examples
   * ("-24 dB", "25%", "300 ms"): percentages and ratios sit flush against
   * the number, everything else (dB, ms, s, etc.) gets a space before the
   * unit.
   *
   * UI-1: discrete (enumerated) params carry no unit — their value IS the
   * display string (e.g. "C", "Chromatic"), so it renders verbatim.
   *
   * Finishing entry 4 ($impeccable polish, critique P3-4): READOUT-ONLY
   * display scale. A param whose internal model scale is 0..1 but whose
   * unit is '%' (distortion Drive/Tone) declares `displayScale: 100` in
   * its paramSpec; this formatter multiplies ONLY the rendered string by
   * that factor so the mono readout follows the surface-wide 0-100 %
   * convention (Mix "30%", Drive "25%") instead of reading "0.25%" — a
   * quarter of a percent. Everything upstream of the string stays on the
   * internal scale: the slider's min/max/step, the parsed model value,
   * AudioGraph bookkeeping, preset serialization, and the agent set_param
   * contract all keep the 0..1 numbers exactly as they were (a saved
   * drive 0.25 still means the same sound). The round-trip kills binary
   * float noise the multiply can introduce (0.33 * 100 ===
   * 33.000000000000004) far below any readable display granularity.
   *
   * @param {number|string} value
   * @param {string} unit
   * @param {number} [displayScale] - spec-declared readout multiplier
   *   (1/undefined = display the internal value verbatim).
   * @returns {string}
   */
  function formatValue(value, unit, displayScale) {
    if (!unit) {
      return String(value);
    }
    var shown = value;
    if (typeof displayScale === 'number' && isFinite(displayScale) && displayScale !== 1) {
      shown = Math.round(value * displayScale * 1e6) / 1e6;
    }
    if (unit === '%' || unit === ':1') {
      return shown + unit;
    }
    return shown + ' ' + unit;
  }

  /**
   * Render the parameter controls for one model entry into `container`,
   * replacing whatever was there before.
   *
   * Looks up NodeTypes.getParamSpec(modelEntry.type); if that comes back
   * empty (unknown/unregistered type), renders nothing further — this is a
   * deliberately defensive no-op, not a thrown error, since a caller may
   * legitimately render a container before every node type it might show
   * has been registered.
   *
   * @param {HTMLElement} container
   * @param {{id: string, type: string, params: Object}} modelEntry
   * @param {(updatedParams: Object) => void} [onParamsChanged] - optional;
   *   called with the full updated params object after every slider move.
   *   A future caller (e.g. UI-3's canvas) may use this to mark an
   *   "unsaved changes" indicator — this component doesn't do anything
   *   with it beyond making it available.
   */
  function renderParamControls(container, modelEntry, onParamsChanged) {
    container.innerHTML = '';

    var paramSpec = window.NodeTypes.getParamSpec(modelEntry.type);
    if (!paramSpec || paramSpec.length === 0) {
      return;
    }

    // Issue #5: fresh row registry for this id (a re-render replaces every
    // row, so the previous render's entries for this id are stale by
    // definition — see renderedControls above).
    renderedControls[modelEntry.id] = {};

    // Working copy of this entry's params — shallow-copied once up front,
    // then updated in place (one field at a time) as sliders move, so each
    // row's `input` handler always builds its updatedParams object from the
    // latest state of every OTHER slider in this render too, not just its
    // own.
    var workingParams = Object.assign({}, modelEntry.params || {});

    paramSpec.forEach(function (spec) {
      var initialValue = Object.prototype.hasOwnProperty.call(workingParams, spec.id)
        ? workingParams[spec.id]
        : spec.default;
      workingParams[spec.id] = initialValue;

      var inputId = 'param-' + modelEntry.id + '-' + spec.id;

      var row = document.createElement('div');
      row.className = 'param-row';

      var label = document.createElement('label');
      label.setAttribute('for', inputId);
      label.className = 'param-label';
      label.textContent = spec.label;

      var input;
      if (Array.isArray(spec.values)) {
        // UI-1 — discrete (enumerated) param: render a native <select>
        // instead of a range slider. A native select is keyboard operable
        // for free (Tab focus + arrow keys / typeahead), and screen readers
        // announce the newly selected option text on change — exactly the
        // value-announcement UI-1 requires, with zero custom ARIA to get
        // wrong. Values are plain strings (e.g. 'C'..'B', 'Chromatic'),
        // committed verbatim through the SAME pipeline as a slider move
        // (AudioGraph.updateNodeParams model bookkeeping +
        // NodeTypes.applyParam live write) — a type's applyParam simply
        // receives a string paramId/value pair instead of a number.
        input = document.createElement('select');
        input.className = 'param-select';
        spec.values.forEach(function (v) {
          var option = document.createElement('option');
          option.value = v;
          option.textContent = v;
          input.appendChild(option);
        });
      } else {
        input = document.createElement('input');
        input.type = 'range';
        input.className = 'param-slider';
        input.min = spec.min;
        input.max = spec.max;
        input.step = spec.step;
      }
      input.id = inputId;
      input.value = initialValue;

      var valueDisplay = document.createElement('span');
      valueDisplay.className = 'param-value';
      valueDisplay.textContent = formatValue(initialValue, spec.unit, spec.displayScale);

      // Issue #5: register this row's external-value applier (see
      // renderedControls above). Closes over `input`, `valueDisplay` and
      // this render's `workingParams` so an agent param write surfaced
      // through updateControl() keeps the slider, the mono span, AND the
      // working copy a later human slider move builds from all in agreement
      // — without it, the next `input` event on a sibling row would build
      // its updatedParams from a stale copy and silently REVERT the agent's
      // value in the model.
      renderedControls[modelEntry.id][spec.id] = {
        apply: function (externalValue) {
          input.value = externalValue;
          valueDisplay.textContent = formatValue(externalValue, spec.unit, spec.displayScale);
          workingParams[spec.id] = externalValue;
        }
      };

      // Fires continuously while dragging (not just on release) — that's
      // exactly the point: a host tuning by ear expects to hear the change
      // live as the slider moves, not only once they let go.
      input.addEventListener('input', function () {
        // Issue #6: a HUMAN slider move — mark the state revision so a
        // stale agent Undo entry can no longer auto-apply over it. The
        // agent set_param fast path deliberately does NOT fire this
        // handler (it writes through AudioGraph/NodeTypes/
        // ChainCanvas.updateNodeParam directly), so agent edits keep
        // today's pure-agent undo semantics.
        if (window.AgentUI && typeof window.AgentUI.noteHumanEdit === 'function') {
          window.AgentUI.noteHumanEdit();
        }
        // UI-1: a discrete select commits its string value verbatim; a
        // slider's string value is parsed to a number as before.
        var newValue = Array.isArray(spec.values) ? input.value : parseFloat(input.value);

        valueDisplay.textContent = formatValue(newValue, spec.unit, spec.displayScale);

        // Issue #5: re-sync the working copy from the model entry FIRST,
        // overlaid on this render's defaults, before applying this row's
        // change. modelEntry is the canvas's live nodeState object (the
        // same reference ChainCanvas keeps current, including via
        // updateNodeParam's agent writes), so this makes an agent-written
        // sibling param immune to being reverted by the next human move —
        // belt-and-suspenders alongside the workingParams update inside
        // updateControl's apply() closure above.
        workingParams = Object.assign({}, workingParams, modelEntry.params || {});
        workingParams[spec.id] = newValue;
        var updatedParams = Object.assign({}, workingParams);

        // Model bookkeeping only — no live-graph/buildGraph() involvement.
        window.AudioGraph.updateNodeParams(modelEntry.id, updatedParams);

        // Live audio side effect — a click-safe scheduled ramp onto the
        // real node, via the type's own registered applyParam. Deliberately
        // NOT routed through AudioGraph.buildGraph() — see file-level
        // comment above.
        window.NodeTypes.applyParam(
          modelEntry.type,
          window.AudioGraph.getNodeInstance(modelEntry.id),
          spec.id,
          newValue
        );

        if (typeof onParamsChanged === 'function') {
          onParamsChanged(updatedParams);
        }
      });

      row.appendChild(label);
      row.appendChild(input);
      row.appendChild(valueDisplay);

      // Refinement entry 2: attach the plain-language line (see
      // PLAIN_LANGUAGE_HELP above) — title for hover/long-press/keyboard,
      // aria-describedby for screen readers. The help span is .sr-only
      // (position:absolute, clip-hidden — zero layout footprint), so the
      // row's flex order stack (label 1 / value 2 / slider 3) and its
      // geometry are bit-for-bit what they were without it.
      var helpText = lookupHelpLine(modelEntry.type, spec.id);
      if (helpText) {
        var helpSpan = document.createElement('span');
        helpSpan.id = 'param-help-' + modelEntry.id + '-' + spec.id;
        helpSpan.className = 'sr-only';
        helpSpan.textContent = helpText;
        row.appendChild(helpSpan);

        row.title = helpText;
        input.title = helpText;
        input.setAttribute('aria-describedby', helpSpan.id);
      }

      container.appendChild(row);
    });
  }

  window.ParamControls = {
    render: renderParamControls,
    // Issue #5: move ONE rendered row's visible control to a new value
    // without re-rendering (see updateControl above).
    updateControl: updateControl,
  };
})();
