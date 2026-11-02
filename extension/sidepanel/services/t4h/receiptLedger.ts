import type { T4HExecutionReceipt } from './chrome-agent-gate.mjs';

const STORAGE_KEY = 't4h.executionReceipts.v1';
const MAX_RECEIPTS = 500;

// Serialize read-modify-write operations so simultaneous tool calls cannot
// overwrite one another's receipts in chrome.storage.local.
let writeQueue: Promise<void> = Promise.resolve();

function serialiseWrite<T>(operation: () => Promise<T>): Promise<T> {
  const result = writeQueue.then(operation, operation);
  writeQueue = result.then(() => undefined, () => undefined);
  return result;
}

function storageArea(): chrome.storage.StorageArea {
  const area = globalThis.chrome?.storage?.local;
  if (!area) throw new Error('T4H receipt storage is unavailable');
  return area;
}

export async function getCapabilityReceipts(): Promise<T4HExecutionReceipt[]> {
  const stored = await storageArea().get(STORAGE_KEY);
  const receipts = stored[STORAGE_KEY];
  return Array.isArray(receipts) ? receipts as T4HExecutionReceipt[] : [];
}

export function beginCapabilityReceipt(receipt: T4HExecutionReceipt): Promise<void> {
  return serialiseWrite(async () => {
    if (!receipt?.runId) throw new TypeError('Receipt runId is required');
    const current = await getCapabilityReceipts();
    if (current.some((item) => item.runId === receipt.runId)) throw new Error('Receipt runId already exists');
    await storageArea().set({ [STORAGE_KEY]: [...current, receipt].slice(-MAX_RECEIPTS) });
  });
}

/** Upserts the final outcome; a pending record remains if this write fails. */
export function saveCapabilityReceipt(receipt: T4HExecutionReceipt): Promise<void> {
  return serialiseWrite(async () => {
    if (!receipt?.runId) throw new TypeError('Receipt runId is required');
    const current = await getCapabilityReceipts();
    const index = current.findIndex((item) => item.runId === receipt.runId);
    const next = [...current];
    if (index >= 0) next[index] = receipt;
    else next.push(receipt);
    await storageArea().set({ [STORAGE_KEY]: next.slice(-MAX_RECEIPTS) });
  });
}

export async function exportCapabilityReceiptsJson(): Promise<string> {
  const receipts = await getCapabilityReceipts();
  return JSON.stringify({
    schemaVersion: 't4h.capability-receipt-export.v1',
    exportedAt: new Date().toISOString(),
    receiptCount: receipts.length,
    receipts,
  }, null, 2);
}

export async function downloadCapabilityReceipts(): Promise<void> {
  const json = await exportCapabilityReceiptsJson();
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `t4h-capability-receipts-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    anchor.click();
  } finally {
    URL.revokeObjectURL(url);
  }
}
