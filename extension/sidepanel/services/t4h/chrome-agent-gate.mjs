import { RISK, createExecutionReceipt, invokeReadOnlyTool } from './trial-core.mjs';
import { validateJsonSchemaInput } from './browser-adapter.mjs';

const stable = (value) => Array.isArray(value)
  ? '[' + value.map(stable).join(',') + ']'
  : value && typeof value === 'object'
    ? '{' + Object.keys(value).sort().map((key) => JSON.stringify(key) + ':' + stable(value[key])).join(',') + '}'
    : JSON.stringify(value);

function resultSummary(value) {
  if (value === null || value === undefined) return { type: 'null' };
  if (Array.isArray(value)) return { type: 'array', itemCount: value.length };
  if (typeof value === 'object') return { type: 'object', keys: Object.keys(value).slice(0, 40) };
  return { type: typeof value };
}

/**
 * T4H execution boundary for the GoogleChromeLabs example agent.
 * The deployment-owned allowlist, never page annotations or model output,
 * decides which exact origin/name/schema tuple may dispatch.
 */
export async function executeThroughT4HPolicy({
  tool,
  input,
  origin,
  expectedOrigin,
  allowedOrigins = [],
  policy = [],
  tabId,
  frameId = 0,
  executeTabTool,
  onTabChanged,
  onBeforeDispatch,
  timeoutMs = 5000,
  sourceRevision = 'UNKNOWN',
  environment = 'UNKNOWN',
}) {
  const runId = globalThis.crypto?.randomUUID?.() ?? `webmcp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const startedAt = new Date().toISOString();
  const toolName = typeof tool?.name === 'string' ? tool.name : 'UNKNOWN';
  let dispatched = false;

  const receipt = (outcome, reason, decision, value) => createExecutionReceipt({
    runId,
    sourceRevision,
    environment,
    origin,
    toolName,
    policyDecision: decision,
    startedAt,
    finishedAt: outcome === 'unknown' && reason === 'dispatch-started' ? null : new Date().toISOString(),
    outcome,
    resultSummary: value === undefined ? null : resultSummary(value),
    errorCode: reason ?? null,
  });

  const denied = (reason, decision = { allowed: false, reason }) => ({
    outcome: 'denied',
    reason,
    receipt: receipt('denied', reason, decision),
    evidence: { policy: 't4h-exact-origin-tool-schema-allowlist', dispatched: false, runId, tabId, frameId },
  });

  if (typeof executeTabTool !== 'function') return denied('executor-not-callable');
  if (typeof onBeforeDispatch !== 'function') return denied('receipt-sink-not-configured');
  if (!Number.isSafeInteger(tabId) || tabId < 0) return denied('tab-identity-invalid');
  if (frameId !== 0) return denied('frame-origin-not-independently-verified');
  if (typeof origin !== 'string' || !origin) return denied('origin-unavailable');
  if (typeof expectedOrigin === 'string' && expectedOrigin && origin !== expectedOrigin) return denied('page-origin-changed');
  if (!allowedOrigins.includes(origin)) return denied('origin-not-allowlisted');

  const policyMatch = matchT4HPolicy({ origin, tool, policy });
  if (!policyMatch.allowed) return denied(policyMatch.reason);

  let schema;
  try {
    schema = typeof tool?.inputSchema === 'string' ? JSON.parse(tool.inputSchema) : tool?.inputSchema;
  } catch {
    return denied('tool-schema-invalid-json');
  }
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) return denied('tool-schema-invalid');

  let canonicalInput;
  try {
    const serialized = JSON.stringify(input ?? null);
    if (typeof serialized !== 'string') return denied('input-not-json-serializable');
    if (new TextEncoder().encode(serialized).byteLength > 65536) return denied('input-too-large');
    canonicalInput = JSON.parse(serialized);
  } catch {
    return denied('input-not-json-serializable');
  }

  const validation = validateJsonSchemaInput(canonicalInput, schema);
  if (!validation.valid) return denied('input-schema-invalid', { allowed: false, reason: 'input-schema-invalid', details: validation.errors });

  const definition = {
    name: toolName,
    description: tool?.description,
    origin,
    inputSchema: schema,
    risk: RISK.READ_ONLY,
  };

  const pendingReceipt = receipt('unknown', 'dispatch-started', {
    allowed: true,
    policy: 't4h-exact-origin-tool-schema-allowlist',
    risk: RISK.READ_ONLY,
  });
  try {
    await onBeforeDispatch(pendingReceipt);
  } catch {
    return denied('receipt-ledger-unavailable', { allowed: false, reason: 'receipt-ledger-unavailable' });
  }

  const result = await invokeReadOnlyTool({
    origin,
    allowedOrigins,
    tool: definition,
    input: canonicalInput,
    timeoutMs,
    maxInputBytes: 65536,
    maxOutputBytes: 32768,
    handler: (safeInput) => {
      dispatched = true;
      return executeTabTool(toolName, safeInput, frameId, tabId, { onTabChanged });
    },
  });

  const finalReceipt = receipt(
    result.outcome,
    result.reason ?? null,
    { allowed: true, policy: 't4h-exact-origin-tool-schema-allowlist', risk: RISK.READ_ONLY },
    result.value,
  );
  return {
    ...result,
    receipt: finalReceipt,
    evidence: {
      policy: 't4h-exact-origin-tool-schema-allowlist',
      dispatched,
      runId,
      startedAt,
      finishedAt: new Date().toISOString(),
      frameId,
      tabId,
      sourceRevision,
      environment,
    },
  };
}

/** Exact deployment-owned origin, tool name and schema match. */
export function matchT4HPolicy({ origin, tool, policy = [] }) {
  if (!Array.isArray(policy)) return { allowed: false, reason: 'policy-invalid' };
  let schema;
  try {
    schema = typeof tool?.inputSchema === 'string' ? JSON.parse(tool.inputSchema) : tool?.inputSchema;
  } catch {
    return { allowed: false, reason: 'tool-schema-invalid-json' };
  }
  const entry = policy.find((item) => item && item.origin === origin && item.name === tool?.name && item.risk === 'read-only');
  if (!entry) return { allowed: false, reason: 'tool-not-allowlisted' };
  if (stable(entry.inputSchema) !== stable(schema)) return { allowed: false, reason: 'tool-schema-drift' };
  return { allowed: true, entry };
}
