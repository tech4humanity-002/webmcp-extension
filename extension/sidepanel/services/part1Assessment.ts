import type { WebMCPTool } from '../types/index.js';

export const PART1_ASSESSMENT_ENDPOINT =
  'https://webmcp-part1-assessment.troy-latter.workers.dev/api/assess-runtime';

export interface Part1RuntimeEvidenceInput {
  url: string;
  browser: string;
  extensionVersion: string;
  status: 'available' | 'unavailable' | 'unknown';
  tools: WebMCPTool[];
}

export async function submitPart1RuntimeEvidence(
  input: Part1RuntimeEvidenceInput,
  fetcher: typeof fetch = fetch,
): Promise<Record<string, unknown>> {
  const page = new URL(input.url);
  if (!['http:', 'https:'].includes(page.protocol) || page.username || page.password) {
    throw new TypeError('Only public HTTP(S) page URLs can be assessed.');
  }
  if (input.tools.length > 100) {
    throw new RangeError('The active page reports more than 100 tools; export is blocked.');
  }

  // Send discovery metadata only. Never send tool arguments, results, cookies,
  // form values, page text or invoke a page tool from this export.
  const tools = input.tools.map((tool) => ({
    name: tool.name,
    description: tool.description ?? '',
    inputSchema: tool.inputSchema ?? null,
    outputSchema: tool.outputSchema ?? null,
    readOnlyHint: tool.readOnlyHint === true,
    untrustedContentHint: tool.untrustedContentHint === true,
    consequentialHint: tool.consequentialHint === true,
    frameId: Number.isSafeInteger(tool.frameId) ? tool.frameId : 0,
  }));

  const payload = {
    url: page.href,
    runtime: {
      status: input.status,
      origin: page.origin,
      pageUrl: page.href,
      browser: input.browser.slice(0, 256),
      extensionVersion: input.extensionVersion.slice(0, 32),
      frameCoverage: 'top-frame-only',
      tools,
    },
  };
  const body = JSON.stringify(payload);
  if (new TextEncoder().encode(body).byteLength > 512 * 1024) {
    throw new RangeError('The runtime evidence report exceeds 512 KB.');
  }

  const response = await fetcher(PART1_ASSESSMENT_ENDPOINT, {
    method: 'POST',
    mode: 'cors',
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    headers: { 'content-type': 'application/json' },
    body,
  });
  const result = await response.json() as Record<string, unknown>;
  if (!response.ok) {
    const message = typeof result.error === 'string' ? result.error : 'Part 1 assessment failed.';
    throw new Error(message);
  }
  return result;
}
