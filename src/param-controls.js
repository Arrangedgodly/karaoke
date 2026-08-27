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

(function () {
  'use strict';

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
      container.appendChild(row);
    });
  }

  window.ParamControls = {
    render: renderParamControls,
  };
})();
