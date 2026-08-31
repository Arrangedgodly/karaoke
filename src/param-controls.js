// Pattern Machine control layer for the VOXCHAIN (redesign
// item 1 — src/param-controls.js rewritten in the locked "Single Face
// Chassis" world, docs/ultron/redesign.md).
//
// Loaded as a plain (non-module) <script> — same IIFE pattern as the other
// files in this project, exposing a single `window.ParamControls` namespace
// with `render` and `updateControl`. The RENDER CONTRACT IS UNCHANGED: one
// call per model entry ({id, type, params}), one control per paramSpec
// entry, every commit riding the exact same pipeline the fader stack used —
// only the CONTROL ANATOMY changed.
//
// THE THREE CONTROL SHAPES (the direction contract's encoder field):
//
//   KNOB (default for continuous params) — a rotary encoder visual driven
//   by a NATIVE <input type="range"> kept in the DOM as the semantic
//   engine: it keeps the id/min/max/step/value contract, the label[for]
//   pairing, the aria-describedby help wiring, and ALL native keyboard
//   behavior (arrows / Home / End / PageUp / PageDown) — it is visually
//   clipped (opacity 0 over the knob's own box, pointer-events:none) and
//   the knob visual beside it draws the focus ring when the input has
//   :focus-visible. Pointer interaction lives on the knob visual:
//   vertical drag (150 px = full sweep, Shift = fine x0.2), wheel (one
//   spec step per notch, Shift = x5). Every drag/wheel tick WRITES
//   input.value and dispatches a real 'input' event, so the existing
//   commit pipeline (this file's input handler) runs unchanged. A center
//   detent tick is printed where the param has a meaningful unity center
//   (bipolar ranges: gainDb, the EQ band gains) and drag snaps to it.
//
//   PADS (paramSpec.values — discrete params) — autotune Key/Scale render
//   as real <button> pads in a role="radiogroup" with roving tabindex
//   (arrows move AND select, Home/End, Space/Enter native), committing
//   their STRING value verbatim down the same pipeline (UI-1's contract:
//   NodeTypes.applyParam receives 'A' / 'Minor' as strings).
//
//   TRIM (mini-slider) — the few wide linear ranges that demand throw
//   precision rather than an arc: delay Time (10–1000 ms), autotune
//   Retune (0–500 ms), gate Release (0.01–2 s). Same native range-input
//   engine as the knob, rendered as a short horizontal instrument
//   trimmer.
//
// A gesture emits a normalized `{param, value}` intent and performs no
// graph, live-node, persistence, preset, revision, or Undo write itself.
// ChainEditing owns those effects and calls updateControl only after the
// value is accepted. A continuous drag therefore keeps the no-rebuild
// parameter path without creating a second mutation owner here.
//
// THE DISPLAY REGISTER FEED: every commit, focus, and external write also
// calls window.CanvasRegister.showParam(module, param, value, help) — the
// accent-marked display line etched along the canvas panel's top edge
// (built by src/canvas.js). Purely visual redundancy: the register is
// aria-hidden, so the control's own semantics stay the announced truth.
// The call is guarded (a bare test harness without the register simply
// skips it), and the PLAIN_LANGUAGE_HELP map below stays the single
// source of the help copy — the register reuses it, never duplicates it.
//
// Refinement entry 2 ($impeccable clarify, 2026-08-28) — the
// plain-language help layer survives verbatim: the PLAIN_LANGUAGE_HELP
// map, the title tooltips, and the .sr-only spans wired through
// aria-describedby all ship exactly as before, one shape per control.

(function () {
  'use strict';

  // ---------------------------------------------------------------------
  // Issue #5/#20 — rendered-row registry (for updateControl below).
  //
  // render() keeps each row's elements in closure scope, which is exactly
  // right for the human path but leaves no way for the accepted-state
  // Canvas adapter to move
  // the visible control without re-rendering the whole card. This map is
  // the minimal bridge: render() registers, per model-entry id, one
  // "apply an externally-set value" closure per param row (it moves the
  // knob rotation / pad selection / trim cap, the mono value span, the
  // display register, AND this render's workingParams copy). Keyed by id
  // and reset at the top of every render() for that id, so a rebuilt card
  // can never leave stale rows behind for its own id.
  // ---------------------------------------------------------------------
  var renderedControls = {};

  /**
   * Move ONE already-rendered param row's visible control to a new value —
   * the knob rotation / pad selection / trim cap and the mono value span,
   * never a re-render. Used by ChainCanvas.renderNodeParam after
   * ChainEditing accepts a parameter-only change, so human and WebMCP
   * edits appear identically without rebuilding any card.
   *
   * Purely presentational + bookkeeping on this render's working copy; it
   * deliberately does NOT touch AudioGraph or any live AudioNode (the
   * caller owns the live write, same division of labor as the commit
   * handler below) and does NOT commit (no onParamsChanged, no autosave).
   *
   * @param {string} modelEntryId - the id the card was rendered for.
   * @param {string} paramId - the param row to move.
   * @param {number|string} value - the new value (param's own unit/scale;
   *   discrete params take their string value verbatim).
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
   * label prefix: the control already silkscreens the label, the tooltip
   * anchors to that row, and screen readers announce the label name
   * before this description — so the line spends its whole budget on the
   * explanation. The riskiest controls (compressor Threshold/Ratio, delay
   * Feedback/Mix, limiter Ceiling — the ones whose mid-show misuse is most
   * consequential) are outcome-framed with an explicit direction clause
   * ("lower = …"). Lines describe only what the matching AudioParam in
   * src/node-*.js actually does; no new factual claims, no marketing
   * voice.
   *
   * Finishing entry 1 (cycle 3, $impeccable clarify — critique P2-1): the
   * four cycle-3 families join the same layer with the same conventions
   * (gate Threshold/Floor, distortion Drive/Output, autotune Retune Speed
   * carry the outcome-framed direction clauses the critique named risky).
   * Autotune's required experimental-status + accepted-20-ms-delay
   * disclosure rides the Key line — the card's FIRST param row and first
   * tab stop — so it is said once per card, not four times; the badge on
   * the same section rail (single-sourced from the type's registration)
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
   * internal scale: the input's min/max/step, the parsed model value,
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

  // ---------------------------------------------------------------------
  // Control-shape allocation (presentation ONLY — the param model, the
  // commit pipeline, and the agent contract never see which shape
  // rendered). Discrete params are pads by their spec shape; the rest are
  // knobs EXCEPT the wide linear ranges whose precision demands throw,
  // not arc — listed here by type.param with the reason on each line. A
  // future param not listed is a knob by default (the safe default: the
  // arc reads any range).
  // ---------------------------------------------------------------------
  var TRIM_PARAMS = {
    // 10–1000 ms across a 99-step throw: timing set by ear against a
    // rhythmic gap wants linear distance, not a shrinking arc.
    'delay.timeMs': true,
    // 0–500 ms glide: the robot-snap/smooth-glide boundary is the whole
    // point of this param — a linear trimmer makes the low end reachable.
    'autotune.retune': true,
    // 0.01–2 s: two decades on one control; the arc would cram the
    // musically useful 50–300 ms band into a few degrees.
    'gate.release': true
  };

  function controlModeFor(type, spec) {
    if (Array.isArray(spec.values)) {
      return 'pads';
    }
    if (TRIM_PARAMS[type + '.' + spec.id]) {
      return 'trim';
    }
    return 'knob';
  }

  // ---------------------------------------------------------------------
  // Knob interaction constants (the direction contract's drag feel).
  // ---------------------------------------------------------------------
  var KNOB_SWEEP_DEG = 270;      // arc travel: -135deg .. +135deg from top
  var KNOB_DRAG_RANGE_PX = 150;  // vertical px for the full sweep
  var KNOB_FINE_FACTOR = 0.2;    // Shift-drag = 5x finer
  var KNOB_WHEEL_STEP_MULT = 1;  // one spec step per wheel notch
  var KNOB_WHEEL_FINE_MULT = 5;  // Shift-wheel = 5 steps per notch

  // ---------------------------------------------------------------------
  // Item 2 (2026-08-30 bake, pick: A ENCODER): the round's B DIAL /
  // C VFD drag-feel variants and the body-attribute variant switch they
  // gated on were stripped (FEW-0); the built ENCODER feel below
  // — linear vertical drag, Shift = fine — is the shipped anatomy.
  // ---------------------------------------------------------------------

  // ---------------------------------------------------------------------
  // Stub-safe DOM helpers. The committed tests run this file inside vm
  // sandboxes whose element stubs carry a plain-object `style` and no
  // Event constructor — every visual-only mechanism below degrades to a
  // no-op there instead of throwing (the pipeline itself is what the
  // harness asserts, never the paint).
  // ---------------------------------------------------------------------

  /** Set a CSS custom property if the runtime supports it; silently skip
   *  in a stripped harness (the knob visual is paint, not state). */
  function setVar(el, name, value) {
    try {
      if (el && el.style && typeof el.style.setProperty === 'function') {
        el.style.setProperty(name, value);
      }
    } catch (err) {
      /* visual-only */
    }
  }

  /** Dispatch a real 'input' event on the range input so the EXISTING
   *  commit handler runs (drag/wheel feel identical to keyboard). Falls
   *  back to nothing in a harness without event constructors — tests
   *  drive the handler through their own fire() convention. */
  function fireInput(input) {
    try {
      if (typeof window.Event === 'function') {
        input.dispatchEvent(new window.Event('input', { bubbles: true }));
        return;
      }
    } catch (err) {
      /* fall through to the legacy path */
    }
    try {
      if (typeof document !== 'undefined' && typeof document.createEvent === 'function') {
        var evt = document.createEvent('Event');
        evt.initEvent('input', true, true);
        input.dispatchEvent(evt);
      }
    } catch (err) {
      /* stripped harness — nothing to dispatch with */
    }
  }

  /** Feed the display register (guarded: absent in bare harnesses, and
   *  never load-bearing — the register is redundant display). */
  function registerShow(moduleLabel, paramLabel, valueText, helpLine) {
    try {
      if (window.CanvasRegister && typeof window.CanvasRegister.showParam === 'function') {
        window.CanvasRegister.showParam(moduleLabel, paramLabel, valueText, helpLine);
      }
    } catch (err) {
      /* display-only */
    }
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
   * Row anatomy per shape (styles in main.css's Pattern Machine block):
   *   .param-row.knob-row  [label-in-unit] input.knob-input (clipped
   *                        engine, first so :focus-visible can style the
   *                        knob via the sibling selector) +
   *                        .knob-unit(.knob ring/cap/pointer +
   *                        .param-value + label.param-label)
   *   .param-row.pad-row   label.param-label + .pad-group(button.pad per
   *                        value) — no value span: the pressed pad IS the
   *                        value display
   *   .param-row.trim-row  label + input.trim-slider + .param-value
   * Every row keeps: the .sr-only help span, the row+control title
   * tooltips, and aria-describedby wiring from refinement entry 2.
   *
   * @param {HTMLElement} container
   * @param {{id: string, type: string, params: Object}} modelEntry
   * @param {(updatedParams: Object) => void} [onParamsChanged] - called
   *   with the full updated params object after every commit. UI-3's
   *   canvas uses it for autosave + the unsaved dot.
   */
  function renderParamControls(container, modelEntry, onParamsChanged) {
    container.innerHTML = '';

    var paramSpec = window.NodeTypes.getParamSpec(modelEntry.type);
    if (!paramSpec || paramSpec.length === 0) {
      return;
    }

    var moduleLabel = window.NodeTypes.getLabel(modelEntry.type);

    // Issue #5: fresh row registry for this id (a re-render replaces every
    // row, so the previous render's entries for this id are stale by
    // definition — see renderedControls above).
    renderedControls[modelEntry.id] = {};

    // Working copy of this entry's params — shallow-copied once up front,
    // then updated in place (one field at a time) as controls move, so
    // each row's commit always builds its updatedParams object from the
    // latest state of every OTHER control in this render too, not just
    // its own.
    var workingParams = Object.assign({}, modelEntry.params || {});

    paramSpec.forEach(function (spec) {
      var initialValue = Object.prototype.hasOwnProperty.call(workingParams, spec.id)
        ? workingParams[spec.id]
        : spec.default;
      workingParams[spec.id] = initialValue;

      var inputId = 'param-' + modelEntry.id + '-' + spec.id;
      var helpText = lookupHelpLine(modelEntry.type, spec.id);

      var row = document.createElement('div');
      row.className = 'param-row';

      // Shared help wiring (refinement entry 2): the .sr-only span is
      // clip-hidden (zero layout footprint) and every interactive element
      // in the row carries the aria-describedby id; the title tooltips
      // ride the row and the control for hover / keyboard.
      var helpSpan = null;
      if (helpText) {
        helpSpan = document.createElement('span');
        helpSpan.id = 'param-help-' + modelEntry.id + '-' + spec.id;
        helpSpan.className = 'sr-only';
        helpSpan.textContent = helpText;
        row.title = helpText;
      }

      // The display-register feed for THIS row at its CURRENT value —
      // fired on commit, on focus (a focused control answers on the
      // register even before it moves), and on external writes.
      function feedRegister(valueText) {
        registerShow(moduleLabel, spec.label, valueText, helpText || '');
      }

      var restoreAcceptedVisual = function () {};

      // -----------------------------------------------------------------
      // The ONE commit pipeline (unchanged in behavior from the fader
      // stack): human-edit bump -> value display -> working-copy re-sync
      // -> AudioGraph bookkeeping -> live applyParam -> onParamsChanged.
      // Called by the input's 'input' handler (knob/trim: native + our
      // drag/wheel dispatches) and by pad selection (UI-1 string values
      // verbatim).
      // -----------------------------------------------------------------
      function commitValue(newValue) {
        // Issue #5: re-sync the working copy from the model entry FIRST,
        // overlaid on this render's defaults, before applying this row's
        // change. modelEntry is the canvas's live nodeState object (the
        // same reference ChainCanvas keeps current, including via
        // renderNodeParam's accepted writes), so this makes an accepted
        // sibling param immune to being reverted by the next human move —
        // belt-and-suspenders alongside the workingParams update inside
        // updateControl's apply() closure below.
        workingParams = Object.assign({}, workingParams, modelEntry.params || {});
        workingParams[spec.id] = newValue;
        var updatedParams = Object.assign({}, workingParams);

        // Issue #20: this module translates the gesture only. Canvas
        // forwards this normalized param intent to ChainEditing, which
        // owns the live write, model acceptance, persistence, preset
        // dirtiness, and one human revision bump. Keep the control on the
        // accepted value until ChainEditing renders the committed value.
        var acceptedValue = Object.prototype.hasOwnProperty.call(modelEntry.params || {}, spec.id)
          ? modelEntry.params[spec.id]
          : initialValue;
        restoreAcceptedVisual(acceptedValue);
        workingParams[spec.id] = acceptedValue;
        feedRegister(formatValue(acceptedValue, spec.unit, spec.displayScale));
        if (typeof onParamsChanged === 'function') {
          onParamsChanged(updatedParams, { param: spec.id, value: newValue });
        }
      }

      var valueDisplay = null;
      var mode = controlModeFor(modelEntry.type, spec);

      if (mode === 'pads') {
        // ---------------------------------------------------------------
        // PAD SELECTOR — discrete values as real buttons (radio group +
        // roving tabindex). A native combobox was rejected here: the pads
        // are the visible control, so they must also be the focusable
        // control — a hidden select would put keyboard focus somewhere
        // the eye is not. Arrows move AND select (the radiogroup
        // convention), Home/End jump, Space/Enter activate natively, Tab
        // leaves the group from exactly one tab stop (the selected pad).
        // ---------------------------------------------------------------
        row.className += ' pad-row';

        var labelId = 'param-label-' + modelEntry.id + '-' + spec.id;
        var padLabel = document.createElement('label');
        padLabel.id = labelId;
        padLabel.className = 'param-label';
        padLabel.textContent = spec.label;

        var padGroup = document.createElement('div');
        padGroup.className = 'pad-group';
        padGroup.setAttribute('role', 'radiogroup');
        padGroup.setAttribute('aria-labelledby', labelId);
        if (helpText) {
          padGroup.title = helpText;
        }

        var padButtons = [];
        var selectedIndex = -1;

        function renderPadState(index) {
          selectedIndex = index;
          padButtons.forEach(function (pad, i) {
            var on = i === index;
            pad.setAttribute('aria-checked', on ? 'true' : 'false');
            pad.setAttribute('tabindex', on ? '0' : '-1');
          });
        }

        function valueIndex(value) {
          for (var i = 0; i < spec.values.length; i++) {
            if (String(spec.values[i]) === String(value)) {
              return i;
            }
          }
          return -1;
        }

        restoreAcceptedVisual = function (value) {
          var index = valueIndex(value);
          renderPadState(index < 0 ? selectedIndex : index);
        };

        function selectPad(index, options) {
          if (index < 0 || index >= padButtons.length) {
            return;
          }
          renderPadState(index);
          // The commit: the STRING value verbatim down the shared
          // pipeline (UI-1) — applyParam receives 'A', not an index.
          commitValue(spec.values[index]);
          if (options && options.focus) {
            try {
              if (typeof padButtons[index].focus === 'function') {
                padButtons[index].focus();
              }
            } catch (err) {
              /* stripped harness */
            }
          }
        }

        spec.values.forEach(function (v, i) {
          var pad = document.createElement('button');
          pad.type = 'button';
          pad.className = 'pad';
          pad.textContent = v;
          pad.setAttribute('role', 'radio');
          if (helpSpan) {
            pad.setAttribute('aria-describedby', helpSpan.id);
          }
          pad.setAttribute('tabindex', '-1');
          pad.addEventListener('click', function () {
            selectPad(i);
          });
          pad.addEventListener('focus', function () {
            feedRegister(String(spec.values[i]));
          });
          padGroup.appendChild(pad);
          padButtons.push(pad);
        });

        // Roving-tabindex keyboard travel: arrows/Home/End move the tab
        // stop AND select (radiogroup semantics — the operator hears and
        // sees each candidate as the pointer rides over it).
        padGroup.addEventListener('keydown', function (event) {
          var key = event.key;
          var delta = 0;
          if (key === 'ArrowRight' || key === 'ArrowDown') {
            delta = 1;
          } else if (key === 'ArrowLeft' || key === 'ArrowUp') {
            delta = -1;
          } else if (key === 'Home') {
            selectPad(0, { focus: true });
            event.preventDefault();
            return;
          } else if (key === 'End') {
            selectPad(padButtons.length - 1, { focus: true });
            event.preventDefault();
            return;
          } else {
            return;
          }
          event.preventDefault();
          var next = selectedIndex < 0 ? 0 : (selectedIndex + delta + padButtons.length) % padButtons.length;
          selectPad(next, { focus: true });
        });

        // Initial state (and the external-write applier below) — the
        // value display is the pressed pad itself. NOTE: rendering does
        // NOT feed the display register (building ten cards in a
        // loadModel sweep must not spray the register with first-param
        // lines) — only focus, a human commit, or an external write does.
        var initialIndex = valueIndex(initialValue);
        renderPadState(initialIndex < 0 ? 0 : initialIndex);

        renderedControls[modelEntry.id][spec.id] = {
          apply: function (externalValue) {
            var index = valueIndex(externalValue);
            if (index !== -1) {
              renderPadState(index);
            }
            workingParams[spec.id] = externalValue;
            feedRegister(String(spec.values[selectedIndex]));
          }
        };

        row.appendChild(padLabel);
        row.appendChild(padGroup);
        if (helpSpan) {
          row.appendChild(helpSpan);
        }
        container.appendChild(row);
        return;
      }

      // -----------------------------------------------------------------
      // Continuous params — one native <input type="range"> as the
      // semantic engine for BOTH shapes (knob + trim): focusable,
      // announced, native arrow/Home/End/PageUp/PageDown, label[for],
      // aria-describedby, and the 'input' event contract every existing
      // consumer (Canvas accepted-state adapter and test tooling)
      // already speaks.
      // -----------------------------------------------------------------
      var input = document.createElement('input');
      input.type = 'range';
      // Shape class for main.css (knob rows clip the input to the knob's
      // box; trim rows style it as the visible trimmer track).
      input.className = mode === 'knob' ? 'knob-input' : 'trim-slider';
      input.min = spec.min;
      input.max = spec.max;
      input.step = spec.step;
      input.id = inputId;
      input.value = initialValue;

      var label = document.createElement('label');
      label.setAttribute('for', inputId);
      label.className = 'param-label';
      label.textContent = spec.label;

      valueDisplay = document.createElement('span');
      valueDisplay.className = 'param-value';
      valueDisplay.textContent = formatValue(initialValue, spec.unit, spec.displayScale);

      var min = parseFloat(spec.min);
      var max = parseFloat(spec.max);
      var range = max - min;
      // A meaningful unity center exists exactly where the range is
      // bipolar (gainDb, the EQ band gains): 0 dB = flat, printed as the
      // detent tick at 12 o'clock and snapped to during drag.
      var bipolar = min < 0 && max > 0;

      function stepSize() {
        var s = parseFloat(spec.step);
        if (!isFinite(s) || s <= 0) {
          return range / 100;
        }
        return s;
      }

      function clampQuantize(v) {
        var snapped = min + Math.round((v - min) / stepSize()) * stepSize();
        snapped = Math.round(snapped * 1e6) / 1e6; // kill float tails
        if (bipolar && Math.abs(snapped) < stepSize() / 2) {
          snapped = 0; // detent snap
        }
        if (snapped < min) { snapped = min; }
        if (snapped > max) { snapped = max; }
        return snapped;
      }

      // The knob's visual state from the input's value — the single
      // source of truth (every path funnels through the input).
      var knobEl = null;
      function syncKnobVisual(v) {
        if (!knobEl) {
          return;
        }
        var frac = range > 0 ? (v - min) / range : 0;
        if (frac < 0) { frac = 0; }
        if (frac > 1) { frac = 1; }
        setVar(knobEl, '--knob-pos', frac.toFixed(4));
        setVar(knobEl, '--knob-rot', (frac * KNOB_SWEEP_DEG - KNOB_SWEEP_DEG / 2).toFixed(2) + 'deg');
      }

      restoreAcceptedVisual = function (value) {
        input.value = value;
        syncKnobVisual(parseFloat(value));
        valueDisplay.textContent = formatValue(value, spec.unit, spec.displayScale);
      };

      // The 'input' handler — the ONE commit path for both shapes, fired
      // natively (keyboard) and by our drag/wheel dispatches.
      input.addEventListener('input', function () {
        var newValue = parseFloat(input.value);
        syncKnobVisual(newValue);
        commitValue(newValue);
      });

      // A focused control answers on the register before it moves.
      input.addEventListener('focus', function () {
        feedRegister(formatValue(parseFloat(input.value), spec.unit, spec.displayScale));
      });

      // Accepted-state value applier (ChainCanvas.renderNodeParam).
      // Moves the ENGINE + the visual + the mono span + the register AND
      // the working copy a later human commit builds from — without it,
      // the next 'input' on a sibling row would build its updatedParams
      // from a stale copy and silently REVERT the agent's value.
      renderedControls[modelEntry.id][spec.id] = {
        apply: function (externalValue) {
          input.value = externalValue;
          syncKnobVisual(parseFloat(externalValue));
          valueDisplay.textContent = formatValue(externalValue, spec.unit, spec.displayScale);
          workingParams[spec.id] = externalValue;
          feedRegister(valueDisplay.textContent);
        }
      };

      if (mode === 'knob') {
        // ---------------------------------------------------------------
        // ROTARY KNOB — the input is clipped to the knob's own box
        // (opacity 0 + pointer-events none: still focusable, still the
        // announced control); the .knob visual is the pointer surface.
        // ---------------------------------------------------------------
        row.className += ' knob-row';

        var knobUnit = document.createElement('div');
        knobUnit.className = 'knob-unit';

        knobEl = document.createElement('div');
        knobEl.className = 'knob';
        knobEl.setAttribute('data-detent', bipolar ? 'true' : 'false');
        knobEl.setAttribute('aria-hidden', 'true');

        var ring = document.createElement('div');
        ring.className = 'knob-ring';
        var cap = document.createElement('div');
        cap.className = 'knob-cap';
        var pointer = document.createElement('div');
        pointer.className = 'knob-pointer';
        knobEl.appendChild(ring);
        knobEl.appendChild(cap);
        knobEl.appendChild(pointer);

        // Vertical drag: 150 px = full sweep; Shift = fine (x0.2). Each
        // tick writes input.value and dispatches a REAL 'input' event —
        // the commit pipeline above cannot tell drag from keyboard.
        var dragging = false;
        var lastY = 0;

        knobEl.addEventListener('pointerdown', function (event) {
          dragging = true;
          lastY = event.clientY;
          try {
            if (typeof knobEl.setPointerCapture === 'function' && event.pointerId != null) {
              knobEl.setPointerCapture(event.pointerId);
            }
          } catch (err) {
            /* pointer capture unavailable — drag tracks over the knob */
          }
          try {
            event.preventDefault();
          } catch (err) {
            /* stub event */
          }
          // Hand focus to the engine (keyboard resumes from here); script
          // focus does not trip :focus-visible for pointer users.
          try {
            if (typeof input.focus === 'function') {
              input.focus();
            }
          } catch (err) {
            /* stripped harness */
          }
          knobEl.setAttribute('data-live', 'true');
        });

        knobEl.addEventListener('pointermove', function (event) {
          if (!dragging) {
            return;
          }
          var dy = lastY - event.clientY;
          lastY = event.clientY;
          var fine = event.shiftKey ? KNOB_FINE_FACTOR : 1;
          var current = parseFloat(input.value);
          // ENCODER — the built linear vertical drag.
          var next = current + (dy / KNOB_DRAG_RANGE_PX) * range * fine;
          input.value = String(clampQuantize(next));
          fireInput(input);
        });

        function endDrag() {
          dragging = false;
          knobEl.setAttribute('data-live', 'false');
        }
        knobEl.addEventListener('pointerup', endDrag);
        knobEl.addEventListener('pointercancel', endDrag);

        // Wheel: one spec step per notch (Shift = x5).
        knobEl.addEventListener('wheel', function (event) {
          try {
            event.preventDefault();
          } catch (err) {
            /* stub event */
          }
          var mult = event.shiftKey ? KNOB_WHEEL_FINE_MULT : KNOB_WHEEL_STEP_MULT;
          var dir = event.deltaY < 0 || event.deltaX > 0 ? 1 : -1;
          input.value = String(clampQuantize(parseFloat(input.value) + dir * stepSize() * mult));
          fireInput(input);
        }, { passive: false });

        syncKnobVisual(parseFloat(input.value));

        knobUnit.appendChild(knobEl);
        knobUnit.appendChild(valueDisplay);
        knobUnit.appendChild(label);

        row.appendChild(input);
        row.appendChild(knobUnit);
      } else {
        // ---------------------------------------------------------------
        // TRIM — a short horizontal instrument trimmer: the native input
        // stays visible (styled in main.css), label above, mono value at
        // the label line's right end.
        // ---------------------------------------------------------------
        row.className += ' trim-row';

        var trimUnit = document.createElement('div');
        trimUnit.className = 'trim-unit';
        trimUnit.appendChild(label);
        trimUnit.appendChild(valueDisplay);
        trimUnit.appendChild(input);

        row.appendChild(trimUnit);
      }

      if (helpText) {
        input.title = helpText;
        input.setAttribute('aria-describedby', helpSpan.id);
        row.appendChild(helpSpan);
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
