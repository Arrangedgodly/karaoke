// One complete, validated definition per installed effect.
//
// Loaded as a plain script before the graph, adapters, and effect registrations.
// The catalog starts empty; effect scripts populate it.

(function () {
  'use strict';

  var RANGE_EPS = 1e-9;
  var definitions = Object.create(null);
  var registrationOrder = [];

  function hasOwn(object, key) {
    return Object.prototype.hasOwnProperty.call(object, key);
  }

  function isFiniteNumber(value) {
    return typeof value === 'number' && isFinite(value);
  }

  function setOwn(object, key, value) {
    Object.defineProperty(object, key, {
      value: value,
      enumerable: true,
      configurable: true,
      writable: true
    });
  }

  function cloneParam(param) {
    var copy = {};
    Object.keys(param).forEach(function (key) {
      copy[key] = Array.isArray(param[key]) ? param[key].slice() : param[key];
    });
    return copy;
  }

  function cloneDefinition(type, definition) {
    return {
      type: type,
      label: definition.label,
      plainLabel: definition.plainLabel,
      paramSpec: definition.paramSpec.map(cloneParam),
      code: definition.code,
      defaultWidthPx: definition.defaultWidthPx,
      experimental: definition.experimental,
      latencySeconds: isFiniteNumber(definition.latencySeconds) ? definition.latencySeconds : 0,
      create: definition.create,
      applyParam: definition.applyParam,
      dispose: definition.dispose
    };
  }

  function validateType(type) {
    if (typeof type !== 'string' || type.trim() === '') {
      throw new Error('EffectCatalog.register: type must be a non-empty string.');
    }
  }

  function validateParam(type, param, seenIds) {
    if (!param || typeof param !== 'object' || Array.isArray(param)) {
      throw new Error("EffectCatalog.register: paramSpec entries for '" + type + "' must be objects.");
    }
    if (typeof param.id !== 'string' || param.id.trim() === '') {
      throw new Error("EffectCatalog.register: every param for '" + type + "' needs a non-empty id.");
    }
    if (seenIds[param.id]) {
      throw new Error("EffectCatalog.register: duplicate param id '" + param.id + "' for '" + type + "'.");
    }
    seenIds[param.id] = true;

    if (typeof param.label !== 'string' || param.label.trim() === '') {
      throw new Error("EffectCatalog.register: param '" + param.id + "' needs a non-empty label.");
    }
    if (!hasOwn(param, 'default')) {
      throw new Error("EffectCatalog.register: param '" + param.id + "' needs a default value.");
    }

    var declaresValues = hasOwn(param, 'values');
    var declaresNumeric = hasOwn(param, 'min') || hasOwn(param, 'max') || hasOwn(param, 'step');

    if (declaresValues) {
      if (!Array.isArray(param.values) || param.values.length === 0) {
        throw new Error("EffectCatalog.register: discrete param '" + param.id + "' needs non-empty values.");
      }
      if (declaresNumeric) {
        throw new Error("EffectCatalog.register: param '" + param.id + "' must use values or a numeric range, not both.");
      }
      var valuesSeen = [];
      param.values.forEach(function (value) {
        if ((typeof value !== 'string' && !isFiniteNumber(value)) || valuesSeen.indexOf(value) !== -1) {
          throw new Error("EffectCatalog.register: discrete param '" + param.id + "' values must be unique strings or finite numbers.");
        }
        valuesSeen.push(value);
      });
      if (param.values.indexOf(param.default) === -1) {
        throw new Error("EffectCatalog.register: default for discrete param '" + param.id + "' must be one of its values.");
      }
      return;
    }

    if (!isFiniteNumber(param.min) || !isFiniteNumber(param.max) ||
        !isFiniteNumber(param.step) || param.step <= 0) {
      throw new Error("EffectCatalog.register: numeric param '" + param.id + "' requires finite min, max, and a positive step.");
    }
    if (param.min >= param.max) {
      throw new Error("EffectCatalog.register: numeric param '" + param.id + "' requires min below max.");
    }
    if (!isFiniteNumber(param.default) || param.default < param.min || param.default > param.max) {
      throw new Error("EffectCatalog.register: default for numeric param '" + param.id + "' must be inside its range.");
    }
  }

  function validateDefinition(type, definition) {
    if (!definition || typeof definition !== 'object' || Array.isArray(definition)) {
      throw new Error('EffectCatalog.register: definition must be an object.');
    }
    if (typeof definition.label !== 'string' || definition.label.trim() === '') {
      throw new Error('EffectCatalog.register: definition.label must be a non-empty string.');
    }
    // wayfinder #46: the plain-language half of the Simple view's effect
    // summary row ("Evens out loudness · Compressor") — required at
    // registration, same as `label`, so a new effect type can't ship
    // without one. Source of truth for the wording itself is
    // docs/ultron/research/plain-effect-labels.md (wayfinder #44).
    if (typeof definition.plainLabel !== 'string' || definition.plainLabel.trim() === '') {
      throw new Error('EffectCatalog.register: definition.plainLabel must be a non-empty string.');
    }
    if (!Array.isArray(definition.paramSpec) || definition.paramSpec.length === 0) {
      throw new Error('EffectCatalog.register: definition.paramSpec must be a non-empty array.');
    }
    if (typeof definition.experimental !== 'boolean') {
      throw new Error('EffectCatalog.register: definition.experimental must be a boolean.');
    }
    if (typeof definition.create !== 'function') {
      throw new Error('EffectCatalog.register: definition.create must be a function.');
    }
    if (typeof definition.applyParam !== 'function') {
      throw new Error('EffectCatalog.register: definition.applyParam must be a function.');
    }
    if (hasOwn(definition, 'dispose') && definition.dispose !== undefined && typeof definition.dispose !== 'function') {
      throw new Error('EffectCatalog.register: definition.dispose must be a function when supplied.');
    }
    if (hasOwn(definition, 'latencySeconds') && definition.latencySeconds !== undefined &&
        (!isFiniteNumber(definition.latencySeconds) || definition.latencySeconds < 0)) {
      throw new Error('EffectCatalog.register: definition.latencySeconds must be a non-negative finite number when supplied.');
    }
    // The silkscreen code is DERIVED from the label (canvas.js's
    // familyInitials — a future type codes itself, no hardcoded map). This
    // optional override exists for the one case derivation cannot settle:
    // two labels whose first three letters collide, where the rail would
    // print the same code on two different families and break the
    // redundant encoding colour depends on. It stays here, beside the
    // label it overrides, rather than in a lookup table in the renderer.
    if (hasOwn(definition, 'code') && definition.code !== undefined &&
        !/^[A-Z]{2,4}$/.test(String(definition.code))) {
      throw new Error('EffectCatalog.register: definition.code must be 2-4 uppercase letters when supplied.');
    }
    // The board width this type opens at. Absent means the shared
    // smallest-safe default; a type declares its own only when its
    // control field genuinely needs the room to lay out as designed.
    if (hasOwn(definition, 'defaultWidthPx') && definition.defaultWidthPx !== undefined &&
        (!isFiniteNumber(definition.defaultWidthPx) || definition.defaultWidthPx <= 0)) {
      throw new Error('EffectCatalog.register: definition.defaultWidthPx must be a positive finite number when supplied.');
    }

    var seenIds = Object.create(null);
    definition.paramSpec.forEach(function (param) {
      validateParam(type, param, seenIds);
    });
  }

  function register(type, definition) {
    validateType(type);
    if (hasOwn(definitions, type)) {
      throw new Error("EffectCatalog.register: effect type '" + type + "' is already registered.");
    }
    validateDefinition(type, definition);

    definitions[type] = cloneDefinition(type, definition);
    registrationOrder.push(type);
  }

  function getAllTypes() {
    return registrationOrder.slice();
  }

  function hasType(type) {
    return hasOwn(definitions, type);
  }

  function getDefinition(type) {
    return hasOwn(definitions, type) ? cloneDefinition(type, definitions[type]) : null;
  }

  function getLabel(type) {
    return hasOwn(definitions, type) ? definitions[type].label : null;
  }

  /** The registered silkscreen code override, or null to let the renderer
   *  derive one from the label. */
  function getCode(type) {
    if (!hasOwn(definitions, type)) {
      return null;
    }
    var code = definitions[type].code;
    return typeof code === 'string' && code ? code : null;
  }

  /** The registered board width this type opens at, or null for the
   *  board's shared default. */
  function getDefaultWidthPx(type) {
    if (!hasOwn(definitions, type)) {
      return null;
    }
    var w = definitions[type].defaultWidthPx;
    return isFiniteNumber(w) && w > 0 ? w : null;
  }

  // The plain-language half of the effect summary row (wayfinder #46) —
  // "Evens out loudness" for `compressor`, never a parameter value. The
  // technical name (getLabel) prints quietly after it; see
  // docs/ultron/research/plain-effect-labels.md for the wording's source.
  function getPlainLabel(type) {
    return hasOwn(definitions, type) ? definitions[type].plainLabel : null;
  }

  function getParamSpec(type) {
    if (!hasOwn(definitions, type)) {
      return [];
    }
    return definitions[type].paramSpec.map(cloneParam);
  }

  function findParam(type, paramId) {
    if (!hasOwn(definitions, type)) {
      return null;
    }
    var specs = definitions[type].paramSpec;
    for (var i = 0; i < specs.length; i += 1) {
      if (specs[i].id === paramId) {
        return specs[i];
      }
    }
    return null;
  }

  function getParam(type, paramId) {
    var param = findParam(type, paramId);
    return param ? cloneParam(param) : null;
  }

  function getDefault(type, paramId) {
    var param = findParam(type, paramId);
    return param ? param.default : undefined;
  }

  function getDefaults(type) {
    var defaults = {};
    if (!hasOwn(definitions, type)) {
      return defaults;
    }
    definitions[type].paramSpec.forEach(function (param) {
      setOwn(defaults, param.id, param.default);
    });
    return defaults;
  }

  function isExperimental(type) {
    return hasOwn(definitions, type) && definitions[type].experimental;
  }

  /** Declared added latency for `type`, in seconds — the effect's own
   *  disclosed processing delay (e.g. a worklet's fixed look-ahead, a
   *  granular engine's window). 0 for unregistered types and for every
   *  type that declares none. Used by src/status-readouts.js to fold the
   *  live chain's total added latency into the LATENCY readout. */
  function getLatencySeconds(type) {
    return hasOwn(definitions, type) ? definitions[type].latencySeconds : 0;
  }

  function requireDefinition(type, operation) {
    if (!hasOwn(definitions, type)) {
      throw new Error("EffectCatalog." + operation + ": unknown effect type '" + type + "'.");
    }
    return definitions[type];
  }

  function validateValue(type, param, value, operation) {
    if (Array.isArray(param.values)) {
      if (param.values.indexOf(value) !== -1) {
        return value;
      }
      var stringValuesOnly = param.values.every(function (allowed) {
        return typeof allowed === 'string';
      });
      if (stringValuesOnly && isFiniteNumber(value) && Math.floor(value) === value &&
          value >= 0 && value < param.values.length) {
        return param.values[value];
      }
      throw new Error("EffectCatalog." + operation + ": param '" + param.id + "' for '" + type + "' must be one of its values.");
    }
    if (!isFiniteNumber(value) ||
        value < param.min - RANGE_EPS || value > param.max + RANGE_EPS) {
      throw new Error("EffectCatalog." + operation + ": param '" + param.id + "' for '" + type + "' must be a finite number in range " + param.min + '..' + param.max + '.');
    }
    if (value < param.min) {
      return param.min;
    }
    if (value > param.max) {
      return param.max;
    }
    return value;
  }

  function normalizeParams(type, params) {
    var definition = requireDefinition(type, 'normalizeParams');
    var supplied = params === undefined || params === null ? {} : params;
    if (typeof supplied !== 'object' || Array.isArray(supplied)) {
      throw new Error('EffectCatalog.normalizeParams: params must be an object.');
    }

    Object.keys(supplied).forEach(function (paramId) {
      if (!findParam(type, paramId)) {
        throw new Error("EffectCatalog.normalizeParams: unknown param '" + paramId + "' for '" + type + "'.");
      }
    });

    var normalized = {};
    definition.paramSpec.forEach(function (param) {
      var value = hasOwn(supplied, param.id) && supplied[param.id] !== undefined
        ? supplied[param.id]
        : param.default;
      setOwn(normalized, param.id, validateValue(type, param, value, 'normalizeParams'));
    });
    return normalized;
  }

  function create(type, audioContext, params) {
    var definition = requireDefinition(type, 'create');
    return definition.create(audioContext, normalizeParams(type, params));
  }

  function applyParam(type, instance, paramId, value) {
    var definition = requireDefinition(type, 'applyParam');
    var param = findParam(type, paramId);
    if (!param) {
      throw new Error("EffectCatalog.applyParam: unknown param '" + paramId + "' for '" + type + "'.");
    }
    definition.applyParam(instance, paramId, validateValue(type, param, value, 'applyParam'));
  }

  function dispose(type, instance) {
    var definition = requireDefinition(type, 'dispose');
    if (definition.dispose) {
      return definition.dispose(instance);
    }
  }

  window.EffectCatalog = {
    register: register,
    getAllTypes: getAllTypes,
    hasType: hasType,
    getDefinition: getDefinition,
    getLabel: getLabel,
    getCode: getCode,
    getDefaultWidthPx: getDefaultWidthPx,
    getPlainLabel: getPlainLabel,
    getParamSpec: getParamSpec,
    getParam: getParam,
    getDefault: getDefault,
    getDefaults: getDefaults,
    getLatencySeconds: getLatencySeconds,
    isExperimental: isExperimental,
    normalizeParams: normalizeParams,
    create: create,
    applyParam: applyParam,
    dispose: dispose
  };
})();
