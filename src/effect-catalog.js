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
      paramSpec: definition.paramSpec.map(cloneParam),
      experimental: definition.experimental,
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

  // Cycle-4 BEH-1 (autotune-first): the ONE definition of the default
  // insert position for a freshly added node. Both add paths ask the
  // catalog — the palette chip/keyboard add (src/canvas.js addNodeType)
  // and the agent add_node omitted-position default (src/mcp-tools.js
  // planAddNode) — so the rule cannot drift between the human and agent
  // surfaces. Autotune tunes pitch, so it defaults to the FRONT of the
  // chain, before any other effect touches the signal. Explicit intent
  // still wins: an add_node position argument and any later reorder
  // place the node wherever the operator asks.
  function insertsAtFront(type) {
    return type === 'autotune';
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
    getParamSpec: getParamSpec,
    getParam: getParam,
    getDefault: getDefault,
    getDefaults: getDefaults,
    isExperimental: isExperimental,
    insertsAtFront: insertsAtFront,
    normalizeParams: normalizeParams,
    create: create,
    applyParam: applyParam,
    dispose: dispose
  };
})();
