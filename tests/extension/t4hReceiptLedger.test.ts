import test from 'node:test';
import assert from 'node:assert/strict';
import { beginCapabilityReceipt, exportCapabilityReceiptsJson, getCapabilityReceipts, saveCapabilityReceipt } from '../../extension/sidepanel/services/t4h/receiptLedger.js';
import type { T4HExecutionReceipt } from '../../extension/sidepanel/services/t4h/chrome-agent-gate.mjs';

function receipt(runId: string, outcome: T4HExecutionReceipt['outcome'] = 'unknown'): T4HExecutionReceipt {
  return {
    schemaVersion: 'webmcp.execution-receipt.v1',
    runId,
    sourceRevision: 'test-revision',
    environment: 'TEST',
    origin: 'https://trial.example',
    toolName: 'search_catalog',
    policyDecision: { allowed: true },
    startedAt: new Date(0).toISOString(),
    finishedAt: outcome === 'unknown' ? null : new Date(1).toISOString(),
    outcome,
    resultSummary: null,
    errorCode: outcome === 'unknown' ? 'dispatch-started' : null,
  };
}

function installStorage() {
  const original = globalThis.chrome;
  const data: Record<string, unknown> = {};
  const local = {
    get: async (key: string) => ({ [key]: data[key] }),
    set: async (items: Record<string, unknown>) => { Object.assign(data, items); },
  };
  globalThis.chrome = { storage: { local } } as unknown as typeof chrome;
  return {
    data,
    restore: () => { globalThis.chrome = original; },
  };
}

test('pending execution receipt is durable and final outcome updates the same run', async () => {
  const store = installStorage();
  try {
    await beginCapabilityReceipt(receipt('run-001'));
    await saveCapabilityReceipt(receipt('run-001', 'success'));
    const receipts = await getCapabilityReceipts();
    assert.equal(receipts.length, 1);
    assert.equal(receipts[0].runId, 'run-001');
    assert.equal(receipts[0].outcome, 'success');
    const exported = JSON.parse(await exportCapabilityReceiptsJson());
    assert.equal(exported.schemaVersion, 't4h.capability-receipt-export.v1');
    assert.equal(exported.receipts[0].outcome, 'success');
  } finally {
    store.restore();
  }
});

test('duplicate run IDs are rejected and final receipts can be upserted', async () => {
  const store = installStorage();
  try {
    await beginCapabilityReceipt(receipt('run-002'));
    await assert.rejects(beginCapabilityReceipt(receipt('run-002')), /already exists/);
    await saveCapabilityReceipt(receipt('run-003', 'denied'));
    assert.deepEqual((await getCapabilityReceipts()).map((item) => item.runId), ['run-002', 'run-003']);
  } finally {
    store.restore();
  }
});

test('missing Chrome storage fails closed instead of silently losing receipts', async () => {
  const original = globalThis.chrome;
  try {
    globalThis.chrome = undefined as unknown as typeof chrome;
    await assert.rejects(beginCapabilityReceipt(receipt('run-004')), /storage is unavailable/);
  } finally {
    globalThis.chrome = original;
  }
});


test('concurrent receipt writes are serialized without dropping records', async () => {
  const store = installStorage();
  try {
    await Promise.all(Array.from({ length: 25 }, (_, index) =>
      beginCapabilityReceipt(receipt(`concurrent-${index}`))
    ));
    const receipts = await getCapabilityReceipts();
    assert.equal(receipts.length, 25);
    assert.equal(new Set(receipts.map((item) => item.runId)).size, 25);
  } finally {
    store.restore();
  }
});
