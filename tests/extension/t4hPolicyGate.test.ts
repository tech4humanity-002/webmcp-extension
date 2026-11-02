import test from 'node:test';
import assert from 'node:assert/strict';
import { executeThroughT4HPolicy, matchT4HPolicy, type T4HExecutionReceipt } from '../../extension/sidepanel/services/t4h/chrome-agent-gate.mjs';

const origin = 'https://trial.example';
const schema = {
  type: 'object',
  properties: { query: { type: 'string', minLength: 1, maxLength: 30 } },
  required: ['query'],
  additionalProperties: false,
};
const tool = { name: 'search_catalog', description: 'Search catalogue', inputSchema: schema, readOnlyHint: true };
const policy = [{ origin, name: tool.name, risk: 'read-only', inputSchema: schema }];
const allowed = [origin];
const base = {
  tool,
  input: { query: 'shoes' },
  origin,
  expectedOrigin: origin,
  allowedOrigins: allowed,
  policy,
  tabId: 7,
  executeTabTool: async () => ({ matches: 2, token: 'must-not-leak' }),
  onBeforeDispatch: async () => {},
  sourceRevision: 'test-revision',
  environment: 'TEST',
};

test('exact deployment policy dispatches read-only tool and emits redacted receipt', async () => {
  let pending: T4HExecutionReceipt | undefined;
  let changedTab = 0;
  const result = await executeThroughT4HPolicy({
    ...base,
    onBeforeDispatch: async (receipt) => { pending = receipt; },
    onTabChanged: (tabId) => { changedTab = tabId; },
    executeTabTool: async (_name, _input, _frame, _tab, options) => {
      options?.onTabChanged?.(9);
      return { matches: 2, token: 'must-not-leak' };
    },
  });
  assert.equal(result.outcome, 'success');
  assert.equal(result.evidence.dispatched, true);
  assert.equal(result.evidence.tabId, 7);
  assert.equal(changedTab, 9);
  assert.ok(pending);
  assert.equal(pending.outcome, 'unknown');
  assert.equal(pending.errorCode, 'dispatch-started');
  assert.equal(result.receipt.outcome, 'success');
  assert.equal(result.receipt.sourceRevision, 'test-revision');
  assert.equal((result.receipt.resultSummary as { type: string }).type, 'object');
  assert.equal(JSON.stringify(result.receipt).includes('must-not-leak'), false);
});

test('page readOnlyHint cannot authorise a tool missing from deployment policy', async () => {
  let dispatched = false;
  const result = await executeThroughT4HPolicy({
    ...base,
    policy: [],
    executeTabTool: async () => { dispatched = true; return {}; },
  });
  assert.equal(result.outcome, 'denied');
  assert.equal(result.reason, 'tool-not-allowlisted');
  assert.equal(result.evidence.dispatched, false);
  assert.equal(dispatched, false);
});

test('origin drift, unapproved iframe and schema drift all fail before dispatch', async () => {
  let dispatched = false;
  const originDrift = await executeThroughT4HPolicy({ ...base, expectedOrigin: 'https://other.example', executeTabTool: async () => { dispatched = true; return {}; } });
  const iframe = await executeThroughT4HPolicy({ ...base, frameId: 4, executeTabTool: async () => { dispatched = true; return {}; } });
  const schemaDrift = await executeThroughT4HPolicy({ ...base, tool: { ...tool, inputSchema: { type: 'object' } }, executeTabTool: async () => { dispatched = true; return {}; } });
  assert.equal(originDrift.reason, 'page-origin-changed');
  assert.equal(iframe.reason, 'frame-origin-not-independently-verified');
  assert.equal(schemaDrift.reason, 'tool-schema-drift');
  assert.equal(dispatched, false);
});

test('receipt persistence failure blocks dispatch', async () => {
  let dispatched = false;
  const result = await executeThroughT4HPolicy({
    ...base,
    onBeforeDispatch: async () => { throw new Error('storage unavailable'); },
    executeTabTool: async () => { dispatched = true; return {}; },
  });
  assert.equal(result.outcome, 'denied');
  assert.equal(result.reason, 'receipt-ledger-unavailable');
  assert.equal(dispatched, false);
});

test('invalid arguments are rejected before dispatch', async () => {
  let dispatched = false;
  const result = await executeThroughT4HPolicy({
    ...base,
    input: { query: 'x'.repeat(31) },
    executeTabTool: async () => { dispatched = true; return {}; },
  });
  assert.equal(result.outcome, 'denied');
  assert.equal(result.reason, 'input-schema-invalid');
  assert.equal(dispatched, false);
});

test('policy comparison is exact and ignores page annotations', () => {
  assert.equal(matchT4HPolicy({ origin, tool, policy }).allowed, true);
  assert.equal(matchT4HPolicy({ origin, tool: { ...tool, readOnlyHint: false }, policy }).allowed, true);
  assert.equal(matchT4HPolicy({ origin: 'https://other.example', tool, policy }).allowed, false);
});


test('a timed-out page handler is recorded as uncertain and marked as dispatched', async () => {
  const result = await executeThroughT4HPolicy({
    ...base,
    timeoutMs: 5,
    executeTabTool: async () => new Promise(() => {}),
  });
  assert.equal(result.outcome, 'timeout');
  assert.equal(result.reason, 'execution-timeout');
  assert.equal(result.evidence.dispatched, true);
  assert.equal(result.receipt.outcome, 'timeout');
});
