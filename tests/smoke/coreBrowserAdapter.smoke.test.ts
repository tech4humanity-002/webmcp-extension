/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createSmokeSession, smokeSkipReason, type SmokeSessionContext } from './chromeHarness.js';

const FLIGHT_SCHEMA = {
  type: 'object',
  properties: { destination: { type: 'string' } },
};

describe('Smoke — T4H core browser adapter against live document.modelContext', { skip: smokeSkipReason(), timeout: 90_000 }, () => {
  let session: SmokeSessionContext;

  before(async () => {
    session = await createSmokeSession({ dismissConsent: true, t4hPolicy: false });
  });

  after(async () => {
    await session?.close();
  });

  it('discovers real page tools, enforces origin/name/schema policy and invokes the read-only tool', async () => {
    const { page, server } = session;
    const origin = new URL(server.baseUrl).origin;
    const policy = [{ origin, name: 'get_flights', risk: 'read-only', inputSchema: FLIGHT_SCHEMA }];

    const discovery = await page.evaluate(async (allowedTools) => {
      const adapter = await import(new URL('/__t4h/browser-adapter.mjs', location.href).href);
      return adapter.discoverReadOnlyTools({ documentRef: document, allowedTools });
    }, policy);

    assert.equal(discovery.support.status, 'available');
    const flights = discovery.tools.find((tool: { name: string }) => tool.name === 'get_flights');
    const booking = discovery.tools.find((tool: { name: string }) => tool.name === 'book_flight');
    const extraReadOnly = discovery.tools.find((tool: { name: string }) => tool.name === 'extra_travel_tool_1');
    assert.equal(flights?.allowed, true, 'Exact deployment policy should allow the registered read-only tool');
    assert.equal(flights?.origin, origin);
    assert.equal(booking?.allowed, false, 'A page-declared write tool must not be allowlisted');
    assert.equal(extraReadOnly?.allowed, false, 'A page readOnlyHint must not authorise an unlisted tool');

    const invocation = await page.evaluate(async (allowedTools) => {
      const adapter = await import(new URL('/__t4h/browser-adapter.mjs', location.href).href);
      return adapter.invokeAllowedReadOnlyTool({
        documentRef: document,
        allowedTools,
        toolName: 'get_flights',
        input: { destination: 'Tokyo' },
        timeoutMs: 5000,
      });
    }, policy);
    assert.equal(invocation.outcome, 'success');
    const returned = typeof invocation.value === 'string' ? JSON.parse(invocation.value) : invocation.value;
    assert.equal(returned.flights[0].destination, 'Tokyo');
    assert.equal(returned.authorization, '[REDACTED]', 'Sensitive keys in Chrome JSON-string results must be redacted');

    const executed = await page.evaluate(() => window.__executedTools);
    assert.deepEqual(executed, [{ name: 'get_flights', args: { destination: 'Tokyo' } }]);
  });

  it('denies missing policy and schema drift before calling the page executor', async () => {
    const { page, server } = session;
    const origin = new URL(server.baseUrl).origin;
    const policy = [{ origin, name: 'get_flights', risk: 'read-only', inputSchema: FLIGHT_SCHEMA }];

    const noPolicy = await page.evaluate(async () => {
      const adapter = await import(new URL('/__t4h/browser-adapter.mjs', location.href).href);
      return adapter.invokeAllowedReadOnlyTool({
        documentRef: document,
        allowedTools: [],
        toolName: 'get_flights',
        input: { destination: 'Sydney' },
      });
    });
    assert.equal(noPolicy.outcome, 'denied');
    assert.equal(noPolicy.reason, 'tool-not-explicitly-allowlisted');

    const schemaDrift = await page.evaluate(async (allowedTools) => {
      const adapter = await import(new URL('/__t4h/browser-adapter.mjs', location.href).href);
      return adapter.invokeAllowedReadOnlyTool({
        documentRef: document,
        allowedTools,
        toolName: 'get_flights',
        input: { destination: 'Sydney' },
      });
    }, [{ ...policy[0], inputSchema: { type: 'object', properties: { destination: { type: 'number' } } } }]);
    assert.equal(schemaDrift.outcome, 'denied');
    assert.equal(schemaDrift.reason, 'tool-schema-drift');

    const executed = await page.evaluate(() => window.__executedTools);
    assert.deepEqual(executed, [{ name: 'get_flights', args: { destination: 'Tokyo' } }], 'Denied calls must not reach the page executor');
  });
});
