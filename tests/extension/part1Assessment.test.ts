import test from 'node:test';
import assert from 'node:assert/strict';
import { submitPart1RuntimeEvidence, PART1_ASSESSMENT_ENDPOINT } from '../../extension/sidepanel/services/part1Assessment.js';

test('exports only current-page runtime tool metadata and no execution payload', async () => {
  let requestUrl = '';
  let request: RequestInit | undefined;
  const result = await submitPart1RuntimeEvidence({
    url: 'https://example.com/path',
    browser: 'Chrome test',
    extensionVersion: '1.0.0',
    status: 'available',
    tools: [{
      name: 'search_products',
      description: 'Search products',
      inputSchema: { type: 'object', properties: { query: { type: 'string' } } },
      outputSchema: { type: 'object' },
      readOnlyHint: true,
      untrustedContentHint: true,
      consequentialHint: false,
      frameId: 0,
    }],
  }, async (url, init) => {
    requestUrl = String(url);
    request = init;
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  });
  assert.equal(requestUrl, PART1_ASSESSMENT_ENDPOINT);
  assert.equal(request?.method, 'POST');
  assert.equal(request?.credentials, 'omit');
  const payload = JSON.parse(String(request?.body));
  assert.equal(payload.runtime.origin, 'https://example.com');
  assert.equal(payload.runtime.frameCoverage, 'top-frame-only');
  assert.equal(payload.runtime.tools[0].name, 'search_products');
  assert.equal(payload.runtime.tools[0].readOnlyHint, true);
  assert.equal('inputArgs' in payload.runtime.tools[0], false);
  assert.equal('result' in payload.runtime.tools[0], false);
  assert.deepEqual(result, { ok: true });
});

test('rejects non-web URLs before sending', async () => {
  await assert.rejects(() => submitPart1RuntimeEvidence({
    url: 'file:///etc/passwd', browser: '', extensionVersion: '', status: 'unknown', tools: [],
  }, async () => new Response('{}')));
});

test('rejects excessive tool counts before sending', async () => {
  const tools = Array.from({ length: 101 }, (_, i) => ({ name: 'tool_' + i }));
  await assert.rejects(() => submitPart1RuntimeEvidence({
    url: 'https://example.com', browser: '', extensionVersion: '', status: 'available', tools,
  }, async () => new Response('{}')), /more than 100 tools/);
});

test('surfaces the Worker validation error', async () => {
  await assert.rejects(() => submitPart1RuntimeEvidence({
    url: 'https://example.com', browser: '', extensionVersion: '', status: 'unknown', tools: [],
  }, async () => new Response(JSON.stringify({ error: 'origin mismatch' }), { status: 400 })), /origin mismatch/);
});
