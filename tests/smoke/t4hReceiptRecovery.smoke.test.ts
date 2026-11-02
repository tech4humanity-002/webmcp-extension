/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createSmokeSession, smokeSkipReason, type SmokeSessionContext } from './chromeHarness.js';
import { openSettings, SELECTORS, SIDEBAR_POLLING } from './sidePanelHelpers.js';

const RECEIPT_STORAGE_KEY = 't4h.executionReceipts.v1';

describe('Smoke — T4H interrupted execution recovery', { skip: smokeSkipReason(), timeout: 90_000 }, () => {
  let session: SmokeSessionContext;

  before(async () => {
    session = await createSmokeSession({ dismissConsent: true, t4hPolicy: false });
  });

  after(async () => {
    await session?.close();
  });

  it('reconciles a stale pending receipt after extension restart and warns before retry', async () => {
    const { page, sidebar, server } = session;
    const pending = {
      schemaVersion: 'webmcp.execution-receipt.v1',
      runId: 'simulated-browser-crash',
      sourceRevision: 'crash-fixture-revision',
      environment: 'TEST',
      origin: new URL(server.baseUrl).origin,
      toolName: 'get_flights',
      policyDecision: { allowed: true },
      startedAt: new Date(Date.now() - 60_000).toISOString(),
      finishedAt: null,
      outcome: 'unknown',
      resultSummary: null,
      errorCode: 'dispatch-started',
    };

    await sidebar.evaluate(async (key, receipt) => {
      await chrome.storage.local.set({ [key]: [receipt] });
    }, RECEIPT_STORAGE_KEY, pending);

    await sidebar.reload();
    await sidebar.waitForSelector(SELECTORS.settingsButton);
    await openSettings(sidebar);
    await sidebar.waitForFunction(
      (text) => document.body.innerText.includes(text),
      SIDEBAR_POLLING,
      '1 execution outcome is pending or unverified.',
    );

    const stored = await sidebar.evaluate(async (key) => {
      const result = await chrome.storage.local.get(key);
      return result[key] as Array<Record<string, any>>;
    }, RECEIPT_STORAGE_KEY);
    assert.equal(stored.length, 1);
    assert.equal(stored[0].runId, 'simulated-browser-crash');
    assert.equal(stored[0].outcome, 'unknown', 'Recovery must never infer success');
    assert.equal(stored[0].errorCode, 'interrupted-execution-unverified');
    assert.equal(stored[0].policyDecision.recovery.status, 'unverified');
    assert.ok(stored[0].finishedAt, 'Recovery should timestamp the reconciliation event');
    assert.deepEqual(await page.evaluate(() => window.__executedTools ?? []), [], 'Recovery must not replay the page tool');
  });
});
