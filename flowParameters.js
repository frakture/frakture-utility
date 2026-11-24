'use strict';
/*
 * CommonJS copy of engine9/server/manager/flowParameters.js, so Frakture job
 * lists resolve flow parameters exactly like engine9 flow runs. Keep the two in
 * sync: change one, change the other, and run test/flowParameters.test.js here
 * and engine9/server/test/task/flow-parameters.test.js.
 */
/**
 * Flow parameters: declared on a flow, set per flow run, merged into task options.
 *
 * Modeled on Prefect (flow `parameter_openapi_schema` → deployment `parameters` →
 * flow run `parameters`). Replaces the Frakture `configStep` pattern.
 *
 * - A flow declares `parameter_schema`, a JSON Schema object (subset below) whose
 *   properties carry `default`, `title`, `description`, `enum`, ...
 * - A flow may also carry `parameters`: values that override the schema defaults
 *   (the role of a Prefect deployment's `parameters`, and later of an account
 *   override file).
 * - A flow run's `parameters` override both. The resolved, complete dict is
 *   stored on `flow_run.parameters`, so each run records what it ran with.
 * - Task options read them with Handlebars: `{{parameters.start_date}}`,
 *   `{{date parameters.start_date "YYYY-MM-DD"}}`.
 *
 * Values are stored as given. Relative dates such as `-7d` are NOT resolved
 * here; they stay strings and resolve wherever they are used, as before
 * (`format: 'date'` is a UI hint only).
 *
 * "Unset": undefined, null, and '' fall through to the next layer (matches
 * Frakture `job_option_overrides` and lets a blank run-form field mean "default").
 */

const RESERVED_PARAMETER_NAMES = new Set(['account_id']);

const TYPES = new Set(['string', 'number', 'integer', 'boolean', 'array', 'object']);
const SCHEMA_KEYWORDS = new Set(['$schema', 'type', 'title', 'description', 'properties', 'required', 'additionalProperties']);
const PROPERTY_KEYWORDS = new Set(['type', 'title', 'description', 'default', 'enum', 'format', 'examples', 'items']);

function isPlainObject(v) {
  return v != null && typeof v === 'object' && !Array.isArray(v);
}

function isUnset(v) {
  return v === undefined || v === null || v === '';
}

function parameterError(message, errors) {
  const err = new Error(message);
  err.code = 'INVALID_FLOW_PARAMETERS';
  err.statusCode = 422;
  err.errors = errors;
  return err;
}

function schemaError(message) {
  const err = new Error(message);
  err.code = 'INVALID_PARAMETER_SCHEMA';
  err.statusCode = 422;
  return err;
}

function typesOf(prop) {
  if (prop.type === undefined) return null;
  return Array.isArray(prop.type) ? prop.type : [prop.type];
}

function checkPropertySchema(prop, where) {
  if (!isPlainObject(prop)) throw schemaError(`${where} must be an object`);
  for (const key of Object.keys(prop)) {
    if (!PROPERTY_KEYWORDS.has(key)) {
      throw schemaError(
        `${where}: unsupported keyword "${key}" (supported: ${[...PROPERTY_KEYWORDS].join(', ')})`
      );
    }
  }
  const types = typesOf(prop);
  if (types) {
    if (!types.length) throw schemaError(`${where}.type must not be empty`);
    for (const t of types) {
      if (!TYPES.has(t)) throw schemaError(`${where}.type "${t}" is not one of ${[...TYPES].join(', ')}`);
    }
  }
  if (prop.enum !== undefined && (!Array.isArray(prop.enum) || prop.enum.length === 0)) {
    throw schemaError(`${where}.enum must be a non-empty array`);
  }
  if (prop.format !== undefined && typeof prop.format !== 'string') {
    throw schemaError(`${where}.format must be a string`);
  }
  if (prop.items !== undefined) {
    if (types && !types.includes('array')) throw schemaError(`${where}.items requires type "array"`);
    checkPropertySchema(prop.items, `${where}.items`);
  }
}

/**
 * Validate a flow's `parameter_schema` at load time. Returns the schema (with
 * `type: 'object'` filled in) or null when absent. Throws on an invalid schema,
 * including keywords this subset does not enforce (so nobody relies on, say,
 * `pattern` and gets no check).
 * @param {unknown} schema
 * @param {string} [flowId]
 */
function normalizeParameterSchema(schema, flowId) {
  if (schema == null) return null;
  const label = flowId ? `Flow "${flowId}" parameter_schema` : 'parameter_schema';
  if (!isPlainObject(schema)) throw schemaError(`${label} must be an object`);
  for (const key of Object.keys(schema)) {
    if (!SCHEMA_KEYWORDS.has(key)) throw schemaError(`${label}: unsupported keyword "${key}"`);
  }
  if (schema.type !== undefined && schema.type !== 'object') {
    throw schemaError(`${label}.type must be "object"`);
  }
  const properties = schema.properties ?? {};
  if (!isPlainObject(properties)) throw schemaError(`${label}.properties must be an object`);
  for (const [name, prop] of Object.entries(properties)) {
    if (RESERVED_PARAMETER_NAMES.has(name)) {
      throw schemaError(`${label}: "${name}" is reserved and cannot be declared as a parameter`);
    }
    checkPropertySchema(prop, `${label}.properties.${name}`);
  }
  const required = schema.required ?? [];
  if (!Array.isArray(required) || required.some((r) => typeof r !== 'string')) {
    throw schemaError(`${label}.required must be an array of parameter names`);
  }
  for (const r of required) {
    if (!Object.prototype.hasOwnProperty.call(properties, r)) {
      throw schemaError(`${label}.required names "${r}", which is not in properties`);
    }
  }
  if (schema.additionalProperties !== undefined && typeof schema.additionalProperties !== 'boolean') {
    throw schemaError(`${label}.additionalProperties must be true or false`);
  }
  const normalized = { ...schema, type: 'object', properties, required };
  // Defaults must satisfy their own declaration.
  const errors = [];
  for (const [name, prop] of Object.entries(properties)) {
    if (isUnset(prop.default)) continue;
    const { error } = coerceValue(prop.default, prop, name);
    if (error) errors.push(`default: ${error}`);
  }
  if (errors.length) throw schemaError(`${label} has invalid defaults: ${errors.join('; ')}`);
  return normalized;
}

function typeMatches(value, type) {
  switch (type) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'integer':
      return Number.isInteger(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'array':
      return Array.isArray(value);
    case 'object':
      return isPlainObject(value);
    default:
      return false;
  }
}

/** Run forms and query strings send strings; coerce only when unambiguous. */
function coerceString(value, type) {
  const s = value.trim();
  if ((type === 'number' || type === 'integer') && s !== '' && Number.isFinite(Number(s))) return Number(s);
  if (type === 'boolean') {
    if (s === 'true') return true;
    if (s === 'false') return false;
  }
  return undefined;
}

/**
 * @returns {{ value?: unknown, error?: string }}
 */
function coerceValue(value, prop, name) {
  const types = typesOf(prop);
  let v = value;
  if (types && !types.some((t) => typeMatches(v, t))) {
    let coerced;
    if (typeof v === 'string') {
      for (const t of types) {
        coerced = coerceString(v, t);
        if (coerced !== undefined && typeMatches(coerced, t)) break;
        coerced = undefined;
      }
    }
    if (coerced === undefined) {
      return { error: `"${name}" must be ${types.join(' or ')}, got ${JSON.stringify(value)}` };
    }
    v = coerced;
  }
  if (prop.enum && !prop.enum.some((e) => e === v)) {
    return { error: `"${name}" must be one of ${prop.enum.map((e) => JSON.stringify(e)).join(', ')}, got ${JSON.stringify(value)}` };
  }
  if (Array.isArray(v) && prop.items) {
    const out = [];
    for (let i = 0; i < v.length; i += 1) {
      const r = coerceValue(v[i], prop.items, `${name}[${i}]`);
      if (r.error) return r;
      out.push(r.value);
    }
    v = out;
  }
  return { value: v };
}

/**
 * Merge and validate flow run parameters.
 *
 * Precedence (low → high): schema defaults, `flowParameters`, `runParameters`.
 * Without a schema, parameters pass through unchanged (legacy flows).
 * With a schema, unknown names are rejected unless `additionalProperties: true`
 * (like Prefect, where a run cannot pass arguments the flow does not take).
 * Reserved names (`account_id`) always pass through.
 *
 * Throws `INVALID_FLOW_PARAMETERS` (statusCode 422, `.errors` list) on failure.
 * @param {{ schema?: object|null, flowParameters?: object|null, runParameters?: object|null, flowId?: string }} opts
 * @returns {object}
 */
function resolveFlowRunParameters({ schema, flowParameters, runParameters, flowId } = {}) {
  const label = flowId ? `flow "${flowId}"` : 'flow';
  const errors = [];
  for (const [layer, values] of [
    ['flow parameters', flowParameters],
    ['run parameters', runParameters]
  ]) {
    if (values != null && !isPlainObject(values)) errors.push(`${layer} must be an object`);
  }
  if (errors.length) throw parameterError(`Invalid parameters for ${label}: ${errors.join('; ')}`, errors);

  const layers = [flowParameters ?? {}, runParameters ?? {}];
  if (!schema) return Object.assign({}, ...layers);

  const properties = schema.properties ?? {};
  const resolved = {};

  for (const values of layers) {
    for (const name of Object.keys(values)) {
      if (Object.prototype.hasOwnProperty.call(properties, name)) continue;
      if (RESERVED_PARAMETER_NAMES.has(name) || schema.additionalProperties === true) {
        if (!isUnset(values[name])) resolved[name] = values[name];
        continue;
      }
      errors.push(`unknown parameter "${name}"`);
    }
  }

  const required = new Set(schema.required ?? []);
  for (const [name, prop] of Object.entries(properties)) {
    let value;
    for (const candidate of [runParameters?.[name], flowParameters?.[name], prop.default]) {
      if (!isUnset(candidate)) {
        value = candidate;
        break;
      }
    }
    if (value === undefined) {
      if (required.has(name)) errors.push(`missing required parameter "${name}"`);
      continue;
    }
    const r = coerceValue(value, prop, name);
    if (r.error) errors.push(r.error);
    else resolved[name] = r.value;
  }

  if (errors.length) {
    const known = Object.keys(properties);
    const hint = known.length ? ` (declared: ${known.join(', ')})` : '';
    throw parameterError(`Invalid parameters for ${label}: ${errors.join('; ')}${hint}`, errors);
  }
  return resolved;
}

module.exports = { RESERVED_PARAMETER_NAMES, normalizeParameterSchema, resolveFlowRunParameters };
