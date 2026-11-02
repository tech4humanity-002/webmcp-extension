/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createSmokeSession, smokeSkipReason, type SmokeSessionContext } from './chromeHarness.js';
import { frame0ToolName, submitPromptInSidebar, waitForExecutedToolCount, SELECTORS, SIDEBAR_POLLING } from './sidePanelHelpers.js';
import { NAMED_TOOLS } from './smokeServer.js';

const CHAT_ID = 't4h-policy-trial';
const RECEIPT_STORAGE_KEY = 't4h.executionReceipts.v1';

describe('Smoke — T4H Policy and Capability Receipts', { skip: smokeSkipReason(), timeout: 60_000 }, () => {
  let session: SmokeSessionContext;

  before(async () => {
    session = await createSmokeSession({ dismissConsent: true, t4hPolicy: true });
  });

  after(async () => {
    await session?.close();
  });

  it('executes the exact allowlisted read-only capability and persists a redacted receipt', async () => {
    const { server, page, sidebar } = session;
    server.enqueueReplies(
      {
        chatId: CHAT_ID,
        text: '',
        functionCalls: [{ id: 't4h-read-1', name: frame0ToolName(NAMED_TOOLS.getFlights.name), args: { destination: 'Tokyo' } }],
      },
      { chatId: CHAT_ID, text: 'I found the available flight.' },
    );

    await submitPromptInSidebar(sidebar, 'Find flights to Tokyo');
    const executed = await waitForExecutedToolCount(page, 1);
    await sidebar.waitForFunction((text) => document.body.innerText.includes(text), SIDEBAR_POLLING, 'I found the available flight.');
    assert.deepEqual(executed, [{ name: NAMED_TOOLS.getFlights.name, args: { destination: 'Tokyo' } }]);

    await sidebar.waitForFunction(async (key) => {
      const stored = await chrome.storage.local.get(key);
      const receipts = stored[key];
      return Array.isArray(receipts) && receipts.some((item) => item.toolName === 'get_flights' && item.outcome === 'success');
    }, SIDEBAR_POLLING, RECEIPT_STORAGE_KEY);

    const receipts = await sidebar.evaluate(async (key) => {
      const stored = await chrome.storage.local.get(key);
      return stored[key] as Array<Record<string, unknown>>;
    }, RECEIPT_STORAGE_KEY);
    const receipt = receipts.find((item) => item.toolName === 'get_flights');
    assert.ok(receipt, 'Expected a persisted get_flights receipt');
    assert.equal(receipt.outcome, 'success');
    assert.equal(receipt.origin, new URL(server.baseUrl).origin);
    assert.equal(receipt.environment, 'TEST');
    assert.equal(receipt.sourceRevision, 'smoke-test');
    assert.equal(JSON.stringify(receipt).includes('Tokyo'), false, 'Receipt must not contain raw tool arguments');
    assert.equal(JSON.stringify(receipt).includes('$650'), false, 'Receipt must not contain raw tool output');
    assert.equal(JSON.stringify(receipt).includes('fixture-secret'), false, 'Receipt must not contain sensitive fixture data');
    assert.equal((receipt.resultSummary as { type: string }).type, 'json-string');
    assert.deepEqual((receipt.resultSummary as { keys: string[] }).keys, ['flights', 'authorization']);

    const toolResponse = server.chatRequests
      .flatMap((request) => request.toolResponses ?? [])
      .find((entry) => entry.functionResponse.name === frame0ToolName('get_flights'));
    assert.ok(toolResponse, 'Expected the extension to send the tool result back to the model');
    assert.equal(typeof toolResponse.functionResponse.response.result, 'string');
    const modelVisibleResult = JSON.parse(toolResponse.functionResponse.response.result as string);
    assert.equal(modelVisibleResult.authorization, '[REDACTED]', 'Sensitive data must be redacted before the model receives the result');
    assert.equal(JSON.stringify(modelVisibleResult).includes('fixture-secret'), false);
  });

  it('records a policy denial without prompting for a write tool that deployment policy excludes', async () => {
    const { server, page, sidebar } = session;
    server.enqueueReplies(
      {
        chatId: CHAT_ID,
        text: '',
        functionCalls: [{ id: 't4h-write-1', name: frame0ToolName(NAMED_TOOLS.bookFlight.name), args: { flightCode: 'WM101' } }],
      },
      { chatId: CHAT_ID, text: 'The requested write action was blocked by T4H policy.' },
    );

    await submitPromptInSidebar(sidebar, 'Book flight WM101');
    await sidebar.waitForFunction(
      (text) => document.body.innerText.includes(text),
      SIDEBAR_POLLING,
      'The requested write action was blocked by T4H policy.',
    );

    assert.equal(await sidebar.$(SELECTORS.permissionCard), null, 'A blocked write must not ask the user to approve an impossible action');
    assert.deepEqual(await waitForExecutedToolCount(page, 1), [
      { name: NAMED_TOOLS.getFlights.name, args: { destination: 'Tokyo' } },
    ], 'The write tool must never reach the page executor');

    const receipts = await sidebar.evaluate(async (key) => {
      const stored = await chrome.storage.local.get(key);
      return stored[key] as Array<Record<string, unknown>>;
    }, RECEIPT_STORAGE_KEY);
    const denied = receipts.find((item) => item.toolName === 'book_flight');
    assert.ok(denied, 'Expected a durable denial receipt for book_flight');
    assert.equal(denied.outcome, 'denied');
    assert.equal(denied.errorCode, 'tool-not-allowlisted');
    assert.equal(denied.origin, new URL(server.baseUrl).origin);
  });
});
