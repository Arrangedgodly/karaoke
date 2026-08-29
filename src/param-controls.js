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

  /**
   * Refinement entry 2: the plain-language help map — one line per param,
   * keyed `type -> paramId -> line`, in the README's operator voice. No
   * label prefix: the row already silkscreens the label, the tooltip
   * anchors to that row, and screen readers announce the label[for] name
   * before this description — so the line spends its whole budget on the
   * explanation. The five riskiest controls (compressor
   * Threshold/Ratio, delay Feedback/Mix, limiter Ceiling — the ones whose
   * mid-show misuse is most consequential) are outcome-framed with an
   * explicit direction clause ("lower = …"). Lines describe only what the
   * matching AudioParam in src/node-*.js actually does; no new factual
   * claims, no marketing voice.
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
   * @param {number} value
   * @param {string} unit
   * @returns {string}
   */
  function formatValue(value, unit) {
    if (unit === '%' || unit === ':1') {
      return value + unit;
    }
    return value + ' ' + unit;
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

      var input = document.createElement('input');
      input.type = 'range';
      input.id = inputId;
      input.className = 'param-slider';
      input.min = spec.min;
      input.max = spec.max;
      input.step = spec.step;
      input.value = initialValue;

      var valueDisplay = document.createElement('span');
      valueDisplay.className = 'param-value';
      valueDisplay.textContent = formatValue(initialValue, spec.unit);

      // Fires continuously while dragging (not just on release) — that's
      // exactly the point: a host tuning by ear expects to hear the change
      // live as the slider moves, not only once they let go.
      input.addEventListener('input', function () {
        var newValue = parseFloat(input.value);

        valueDisplay.textContent = formatValue(newValue, spec.unit);

        workingParams[spec.id] = newValue;
        var updatedParams = Object.assign({}, workingParams);

        // Model bookkeeping only — no live-graph/buildGraph() involvement.
        window.AudioGraph.updateNodeParams(modelEntry.id, updatedParams);

        // Live audio side effect — a direct write (or short ramp) onto the
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
  };
})();
