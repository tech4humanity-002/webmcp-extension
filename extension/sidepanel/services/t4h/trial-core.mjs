const SECRET_KEY = /(?:authorization|cookie|password|secret|token|api[_-]?key|private[_-]?key|credential)/i;

export const RISK = Object.freeze({
  READ_ONLY: "read-only",
  REVERSIBLE_WRITE: "reversible-write",
  CONSEQUENTIAL_WRITE: "consequential-write",
  PROHIBITED: "prohibited",
  UNKNOWN: "unknown"
});

export function classifyToolRisk(tool) {
  const declared = tool?.risk;
  return Object.values(RISK).includes(declared) ? declared : RISK.UNKNOWN;
}

export function validateToolDefinition(tool) {
  const errors = [];
  if (!tool || typeof tool !== "object" || Array.isArray(tool)) {
    return { valid: false, errors: ["tool must be an object"] };
  }
  if (typeof tool.name !== "string" || !/^[a-zA-Z][a-zA-Z0-9_.-]{0,63}$/.test(tool.name)) {
    errors.push("name must be a 1-64 character identifier");
  }
  if (typeof tool.description !== "string" || tool.description.trim().length === 0) {
    errors.push("description is required");
  }
  if (typeof tool.origin !== "string") {
    errors.push("origin is required");
  } else {
    try {
      const parsed = new URL(tool.origin);
      if (!["https:", "http:"].includes(parsed.protocol)) errors.push("origin must use HTTP(S)");
      if (parsed.origin !== tool.origin) errors.push("origin must be a canonical origin without path/query");
    } catch {
      errors.push("origin must be a valid URL origin");
    }
  }
  if (!tool.inputSchema || typeof tool.inputSchema !== "object" || Array.isArray(tool.inputSchema)) {
    errors.push("inputSchema must be an object");
  }
  if (!Object.values(RISK).includes(tool.risk)) {
    errors.push("risk must be explicitly declared");
  }
  return { valid: errors.length === 0, errors };
}

export function checkPermission({ origin, allowedOrigins = [], tool, approval, requestPayloadHash, now = Date.now() }) {
  if (typeof origin !== "string" || !allowedOrigins.includes(origin)) {
    return { allowed: false, reason: "origin-not-allowlisted" };
  }
  if (!tool || tool.origin !== origin) {
    return { allowed: false, reason: "tool-origin-mismatch" };
  }
  const definition = validateToolDefinition(tool);
  if (!definition.valid) {
    return { allowed: false, reason: "invalid-tool-definition", details: definition.errors };
  }
  const risk = classifyToolRisk(tool);
  if (risk === RISK.PROHIBITED || risk === RISK.UNKNOWN) {
    return { allowed: false, reason: "risk-not-permitted" };
  }
  if (risk !== RISK.READ_ONLY) {
    const matches = approval &&
      approval.origin === origin &&
      approval.toolName === tool.name &&
      typeof requestPayloadHash === "string" && approval.payloadHash === requestPayloadHash &&
      approval.approved === true &&
      Number.isFinite(approval.expiresAt) && approval.expiresAt > now;
    if (!matches) return { allowed: false, reason: "current-payload-approval-required" };
  }
  return { allowed: true, reason: "allowed", risk };
}

export function redactSensitive(value) {
  if (Array.isArray(value)) return value.map(redactSensitive);
  if (!value || typeof value !== "object") return value;
  const result = {};
  for (const [key, child] of Object.entries(value)) {
    result[key] = SECRET_KEY.test(key) ? "[REDACTED]" : redactSensitive(child);
  }
  return result;
}

export function createExecutionReceipt({
  runId, sourceRevision = "UNKNOWN", environment = "UNKNOWN",
  origin, toolName, policyDecision, startedAt, finishedAt,
  outcome, resultSummary, errorCode
}) {
  return {
    schemaVersion: "webmcp.execution-receipt.v1",
    runId: typeof runId === "string" ? runId : "missing-run-id",
    sourceRevision,
    environment,
    origin: typeof origin === "string" ? origin : "UNKNOWN",
    toolName: typeof toolName === "string" ? toolName : "UNKNOWN",
    policyDecision: redactSensitive(policyDecision ?? {}),
    startedAt: startedAt ?? null,
    finishedAt: finishedAt ?? null,
    outcome: ["success", "denied", "failed", "timeout", "unknown"].includes(outcome) ? outcome : "unknown",
    resultSummary: redactSensitive(resultSummary ?? null),
    errorCode: errorCode ?? null
  };
}

export async function invokeReadOnlyTool({
  origin, allowedOrigins, tool, handler, input, timeoutMs = 3000,
  maxInputBytes = 65536, maxOutputBytes = 32768
}) {
  const decision = checkPermission({ origin, allowedOrigins, tool });
  if (!decision.allowed) {
    return { outcome: "denied", reason: decision.reason, details: decision.details ?? [] };
  }
  if (decision.risk !== RISK.READ_ONLY) {
    return { outcome: "denied", reason: "read-only-invoker-refuses-write" };
  }
  if (typeof handler !== "function") {
    return { outcome: "failed", reason: "handler-not-callable" };
  }
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1 || timeoutMs > 30000) {
    return { outcome: "denied", reason: "timeout-out-of-range" };
  }
  if (!Number.isSafeInteger(maxInputBytes) || maxInputBytes < 1 || maxInputBytes > 1048576 ||
      !Number.isSafeInteger(maxOutputBytes) || maxOutputBytes < 1 || maxOutputBytes > 1048576) {
    return { outcome: "denied", reason: "size-limit-out-of-range" };
  }
  let inputJson;
  try {
    inputJson = JSON.stringify(input ?? null);
  } catch {
    return { outcome: "denied", reason: "input-not-json-serializable" };
  }
  if (typeof inputJson !== "string") {
    return { outcome: "denied", reason: "input-not-json-serializable" };
  }
  if (new TextEncoder().encode(inputJson).byteLength > maxInputBytes) {
    return { outcome: "denied", reason: "input-too-large" };
  }
  // Invoke the exact JSON representation that was size-checked, not the caller's mutable object.
  const canonicalInput = JSON.parse(inputJson);
  let timer;
  try {
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error("WEBMCP_TIMEOUT")), timeoutMs);
    });
    const value = await Promise.race([Promise.resolve().then(() => handler(canonicalInput)), timeout]);
    let redacted;
    let outputJson;
    try {
      redacted = redactSensitive(value);
      outputJson = JSON.stringify(redacted ?? null);
    } catch {
      return { outcome: "failed", reason: "output-not-json-serializable" };
    }
    if (typeof outputJson !== "string") {
      return { outcome: "failed", reason: "output-not-json-serializable" };
    }
    if (new TextEncoder().encode(outputJson).byteLength > maxOutputBytes) {
      return { outcome: "failed", reason: "output-too-large" };
    }
    return { outcome: "success", value: redacted };
  } catch (error) {
    if (error?.message === "WEBMCP_TIMEOUT") return { outcome: "timeout", reason: "execution-timeout" };
    return { outcome: "failed", reason: "handler-failed" };
  } finally {
    clearTimeout(timer);
  }
}
