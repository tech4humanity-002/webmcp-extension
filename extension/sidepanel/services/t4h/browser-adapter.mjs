import {
  RISK,
  validateToolDefinition,
  invokeReadOnlyTool
} from "./trial-core.mjs";

const SCHEMA_METADATA = new Set([
  "$schema", "$id", "$comment", "title", "description", "default", "examples",
  "deprecated", "readOnly", "writeOnly"
]);
const SCHEMA_KEYWORDS = new Set([
  "type", "enum", "const", "anyOf", "oneOf", "allOf", "properties", "required",
  "additionalProperties", "items", "minItems", "maxItems", "uniqueItems",
  "minLength", "maxLength", "minimum", "maximum"
]);

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function stableStringify(value) {
  if (Array.isArray(value)) return "[" + value.map(stableStringify).join(",") + "]";
  if (isRecord(value)) {
    return "{" + Object.keys(value).sort().map(key => JSON.stringify(key) + ":" + stableStringify(value[key])).join(",") + "}";
  }
  return JSON.stringify(value);
}

function parseInputSchema(value) {
  try {
    const serialized = typeof value === "string" ? value : JSON.stringify(value);
    if (typeof serialized !== "string") return { error: "schema-invalid-json" };
    if (new TextEncoder().encode(serialized).byteLength > 16384) return { error: "schema-too-large" };
    const schema = JSON.parse(serialized);
    return isRecord(schema) ? { schema } : { error: "schema-not-object" };
  } catch {
    return { error: "schema-invalid-json" };
  }
}

const VALID_TYPES = new Set(["object", "array", "string", "number", "integer", "boolean", "null"]);

function validateSchemaDefinition(schema, depth = 0) {
  if (!isRecord(schema) || depth > 16) return ["schema-invalid-or-too-deep"];
  const errors = [];
  const unknown = Object.keys(schema).filter(key => !SCHEMA_KEYWORDS.has(key) && !SCHEMA_METADATA.has(key));
  if (unknown.length) errors.push("unsupported-schema-keyword:" + unknown[0]);

  if (schema.type !== undefined) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.length || types.some(type => !VALID_TYPES.has(type))) errors.push("schema-type-invalid");
  }
  if (schema.enum !== undefined && (!Array.isArray(schema.enum) || schema.enum.length === 0)) errors.push("schema-enum-invalid");
  for (const key of ["anyOf", "oneOf", "allOf"]) {
    if (schema[key] === undefined) continue;
    if (!Array.isArray(schema[key]) || schema[key].length === 0) {
      errors.push("schema-" + key + "-invalid");
    } else {
      for (const child of schema[key]) errors.push(...validateSchemaDefinition(child, depth + 1));
    }
  }
  if (schema.properties !== undefined) {
    if (!isRecord(schema.properties)) errors.push("schema-properties-invalid");
    else for (const child of Object.values(schema.properties)) errors.push(...validateSchemaDefinition(child, depth + 1));
  }
  if (schema.required !== undefined && (!Array.isArray(schema.required) || schema.required.some(key => typeof key !== "string"))) {
    errors.push("schema-required-invalid");
  }
  if (schema.additionalProperties !== undefined) {
    if (typeof schema.additionalProperties !== "boolean" && !isRecord(schema.additionalProperties)) {
      errors.push("schema-additionalProperties-invalid");
    } else if (isRecord(schema.additionalProperties)) {
      errors.push(...validateSchemaDefinition(schema.additionalProperties, depth + 1));
    }
  }
  if (schema.items !== undefined) errors.push(...validateSchemaDefinition(schema.items, depth + 1));
  for (const key of ["minLength", "maxLength", "minItems", "maxItems"]) {
    if (schema[key] !== undefined && (!Number.isSafeInteger(schema[key]) || schema[key] < 0)) errors.push("schema-" + key + "-invalid");
  }
  for (const key of ["minimum", "maximum"]) {
    if (schema[key] !== undefined && (typeof schema[key] !== "number" || !Number.isFinite(schema[key]))) errors.push("schema-" + key + "-invalid");
  }
  if (schema.uniqueItems !== undefined && typeof schema.uniqueItems !== "boolean") errors.push("schema-uniqueItems-invalid");
  return errors.slice(0, 20);
}

function typeMatches(value, type) {
  switch (type) {
    case "object": return isRecord(value);
    case "array": return Array.isArray(value);
    case "string": return typeof value === "string";
    case "number": return typeof value === "number" && Number.isFinite(value);
    case "integer": return typeof value === "number" && Number.isSafeInteger(value);
    case "boolean": return typeof value === "boolean";
    case "null": return value === null;
    default: return false;
  }
}

function validateValue(value, schema, path, depth = 0) {
  if (!isRecord(schema) || depth > 16) return ["schema-invalid-or-too-deep"];
  const unknown = Object.keys(schema).filter(key => !SCHEMA_KEYWORDS.has(key) && !SCHEMA_METADATA.has(key));
  if (unknown.length) return ["unsupported-schema-keyword:" + unknown[0]];

  const errors = [];
  if (schema.type !== undefined) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some(type => typeMatches(value, type))) {
      return [path + ":type-mismatch"];
    }
  } else if (!schema.enum && !Object.hasOwn(schema, "const") && !schema.anyOf && !schema.oneOf && !schema.allOf) {
    return [path + ":schema-type-required"];
  }

  if (Object.hasOwn(schema, "const") && stableStringify(value) !== stableStringify(schema.const)) {
    errors.push(path + ":const-mismatch");
  }
  if (schema.enum && (!Array.isArray(schema.enum) || !schema.enum.some(item => stableStringify(item) === stableStringify(value)))) {
    errors.push(path + ":enum-mismatch");
  }

  for (const [keyword, mode] of [["anyOf", "any"], ["oneOf", "one"], ["allOf", "all"]]) {
    if (schema[keyword] === undefined) continue;
    if (!Array.isArray(schema[keyword]) || schema[keyword].length === 0) {
      errors.push(path + ":" + keyword + "-invalid");
      continue;
    }
    const branchResults = schema[keyword].map(branch => validateValue(value, branch, path, depth + 1));
    const validCount = branchResults.filter(result => result.length === 0).length;
    if ((mode === "any" && validCount < 1) ||
        (mode === "one" && validCount !== 1) ||
        (mode === "all" && validCount !== branchResults.length)) {
      errors.push(path + ":" + keyword + "-mismatch");
    }
  }

  if (typeof value === "string") {
    if (Number.isInteger(schema.minLength) && value.length < schema.minLength) errors.push(path + ":minLength");
    if (Number.isInteger(schema.maxLength) && value.length > schema.maxLength) errors.push(path + ":maxLength");
  }
  if (typeof value === "number") {
    if (typeof schema.minimum === "number" && value < schema.minimum) errors.push(path + ":minimum");
    if (typeof schema.maximum === "number" && value > schema.maximum) errors.push(path + ":maximum");
  }
  if (Array.isArray(value)) {
    if (Number.isInteger(schema.minItems) && value.length < schema.minItems) errors.push(path + ":minItems");
    if (Number.isInteger(schema.maxItems) && value.length > schema.maxItems) errors.push(path + ":maxItems");
    if (schema.uniqueItems === true && new Set(value.map(stableStringify)).size !== value.length) errors.push(path + ":uniqueItems");
    if (schema.items !== undefined) {
      for (let index = 0; index < value.length; index++) {
        errors.push(...validateValue(value[index], schema.items, path + "[" + index + "]", depth + 1));
      }
    }
  }
  if (isRecord(value)) {
    const properties = schema.properties ?? {};
    if (!isRecord(properties)) errors.push(path + ":properties-invalid");
    const required = schema.required ?? [];
    if (!Array.isArray(required) || required.some(key => typeof key !== "string")) {
      errors.push(path + ":required-invalid");
    } else {
      for (const key of required) if (!Object.hasOwn(value, key)) errors.push(path + "." + key + ":required");
    }
    for (const [key, child] of Object.entries(value)) {
      if (Object.hasOwn(properties, key)) {
        errors.push(...validateValue(child, properties[key], path + "." + key, depth + 1));
      } else if (schema.additionalProperties === true) {
        continue;
      } else if (isRecord(schema.additionalProperties)) {
        errors.push(...validateValue(child, schema.additionalProperties, path + "." + key, depth + 1));
      } else {
        errors.push(path + "." + key + ":additional-property-denied");
      }
    }
  }
  return errors.slice(0, 20);
}

export function validateJsonSchemaInput(value, schema) {
  const schemaErrors = validateSchemaDefinition(schema);
  if (schemaErrors.length) return { valid: false, errors: schemaErrors };
  const errors = validateValue(value, schema, "$");
  return { valid: errors.length === 0, errors };
}

export function detectWebMCP(documentRef) {
  if (!documentRef || typeof documentRef !== "object") {
    return { status: "unavailable", reason: "document-unavailable" };
  }
  const context = documentRef.modelContext;
  if (!context) return { status: "unavailable", reason: "model-context-api-unavailable" };
  if (typeof context.getTools !== "function" || typeof context.executeTool !== "function") {
    return { status: "partial", reason: "required-methods-unavailable" };
  }
  return { status: "available", api: "document.modelContext", mode: "same-origin-read-only" };
}

async function loadTools(documentRef, allowedTools) {
  const support = detectWebMCP(documentRef);
  if (support.status !== "available") return { support, tools: [] };
  const origin = documentRef.location?.origin;
  if (typeof origin !== "string" || !/^https?:\/\//i.test(origin)) {
    return { support: { status: "unavailable", reason: "document-origin-unavailable" }, tools: [] };
  }
  let rawTools;
  try {
    // No fromOrigins option is passed: cross-origin tools are not requested.
    rawTools = await documentRef.modelContext.getTools();
  } catch {
    return { support: { status: "failed", reason: "tool-discovery-failed" }, tools: [] };
  }
  if (!Array.isArray(rawTools)) {
    return { support: { status: "failed", reason: "tool-list-invalid" }, tools: [] };
  }
  if (rawTools.length > 100) {
    return { support: { status: "failed", reason: "tool-list-too-large" }, tools: [] };
  }

  const tools = rawTools.map(raw => {
    if (!isRecord(raw)) return { allowed: false, reason: "tool-definition-invalid" };
    if (typeof raw.description !== "string" || raw.description.length > 500) {
      return { name: raw.name, origin: raw.origin, allowed: false, reason: "tool-description-too-long-or-missing" };
    }
    const parsed = parseInputSchema(raw.inputSchema);
    if (!parsed.schema) return { name: raw.name, origin: raw.origin, allowed: false, reason: parsed.error };
    const policy = Array.isArray(allowedTools)
      ? allowedTools.find(item => isRecord(item) && item.origin === origin && item.name === raw.name)
      : null;
    // getTools() returns tool objects associated with their owning Window;
    // it does not expose a portable origin property. Discovery above is same-origin
    // only (no fromOrigins), so bind the tool to the observed document origin.
    const normalized = {
      name: raw.name,
      description: raw.description,
      origin,
      inputSchema: parsed.schema,
      risk: RISK.READ_ONLY
    };
    const definition = validateToolDefinition(normalized);
    if (!definition.valid) return { name: raw.name, origin: raw.origin, allowed: false, reason: "tool-definition-invalid" };
    if (!policy || policy.risk !== RISK.READ_ONLY) {
      return { name: raw.name, description: raw.description, origin, inputSchema: parsed.schema, allowed: false, reason: "tool-not-explicitly-allowlisted" };
    }
    if (raw.annotations?.readOnlyHint !== true) {
      return { name: raw.name, description: raw.description, origin, inputSchema: parsed.schema, allowed: false, reason: "read-only-annotation-required" };
    }
    if (!isRecord(policy.inputSchema) || stableStringify(policy.inputSchema) !== stableStringify(parsed.schema)) {
      return { name: raw.name, description: raw.description, origin, inputSchema: parsed.schema, allowed: false, reason: "tool-schema-drift" };
    }
    return {
      name: raw.name,
      description: raw.description,
      origin,
      inputSchema: parsed.schema,
      risk: RISK.READ_ONLY,
      allowed: true,
      reason: "explicitly-allowlisted",
      annotations: { readOnlyHint: true, untrustedContentHint: raw.annotations?.untrustedContentHint === true },
      raw
    };
  });
  return { support, origin, tools };
}

export async function discoverReadOnlyTools({ documentRef, allowedTools = [] }) {
  const loaded = await loadTools(documentRef, allowedTools);
  return {
    support: loaded.support,
    tools: (loaded.tools ?? []).map(tool => {
      const { raw, ...publicTool } = tool;
      return publicTool;
    })
  };
}

export async function invokeAllowedReadOnlyTool({
  documentRef,
  allowedTools = [],
  toolName,
  input,
  timeoutMs = 3000,
  maxInputBytes = 65536,
  maxOutputBytes = 6144,
  signal
}) {
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1 || timeoutMs > 30000) {
    return { outcome: "denied", reason: "timeout-out-of-range" };
  }
  if (!Number.isSafeInteger(maxInputBytes) || maxInputBytes < 1 || maxInputBytes > 1048576 ||
      !Number.isSafeInteger(maxOutputBytes) || maxOutputBytes < 1 || maxOutputBytes > 1048576) {
    return { outcome: "denied", reason: "size-limit-out-of-range" };
  }
  const loaded = await loadTools(documentRef, allowedTools);
  if (loaded.support.status !== "available") {
    return { outcome: "denied", reason: loaded.support.reason ?? "webmcp-unavailable" };
  }
  const selected = (loaded.tools ?? []).find(tool => tool.name === toolName && tool.allowed === true);
  if (!selected) {
    const candidate = (loaded.tools ?? []).find(tool => tool.name === toolName);
    return { outcome: "denied", reason: candidate?.reason ?? "tool-not-found" };
  }
  if (signal?.aborted) return { outcome: "cancelled", reason: "caller-cancelled" };

  let inputJson;
  let canonicalInput;
  try {
    inputJson = JSON.stringify(input ?? null);
    if (typeof inputJson !== "string") return { outcome: "denied", reason: "input-not-json-serializable" };
    if (new TextEncoder().encode(inputJson).byteLength > maxInputBytes) return { outcome: "denied", reason: "input-too-large" };
    canonicalInput = JSON.parse(inputJson);
  } catch {
    return { outcome: "denied", reason: "input-not-json-serializable" };
  }
  const validation = validateJsonSchemaInput(canonicalInput, selected.inputSchema);
  if (!validation.valid) return { outcome: "denied", reason: "input-schema-invalid", details: validation.errors };

  const invocation = invokeReadOnlyTool({
    origin: loaded.origin,
    allowedOrigins: [loaded.origin],
    tool: { name: selected.name, description: selected.description, origin: selected.origin, inputSchema: selected.inputSchema, risk: RISK.READ_ONLY },
    input: canonicalInput,
    timeoutMs,
    maxInputBytes,
    maxOutputBytes,
    handler: async canonical => {
      // Chrome 155+ uses plain object input. The result is any
      // JSON-serialisable value, not necessarily a JSON-encoded string.
      return await documentRef.modelContext.executeTool(selected.raw, canonical);
    }
  });
  if (!signal) {
    const result = await invocation;
    if (result.outcome === "success" && result.value === null) {
      return { outcome: "unknown", reason: "navigation-or-null-result" };
    }
    return result;
  }

  if (signal.aborted) return { outcome: "cancelled", reason: "caller-cancelled" };
  let onAbort;
  const cancellation = new Promise(resolve => {
    onAbort = () => resolve({ outcome: "cancelled", reason: "caller-cancelled" });
    signal.addEventListener("abort", onAbort, { once: true });
  });
  try {
    const result = await Promise.race([invocation, cancellation]);
    if (result.outcome === "success" && result.value === null) {
      return { outcome: "unknown", reason: "navigation-or-null-result" };
    }
    return result;
  } catch {
    return { outcome: "failed", reason: "tool-invocation-failed" };
  } finally {
    signal.removeEventListener("abort", onAbort);
  }
}
