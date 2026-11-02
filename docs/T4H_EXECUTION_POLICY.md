# T4H WebMCP execution policy trial

## Purpose

This fork adds a T4H-controlled execution boundary to the Google Chrome Labs WebMCP example extension. It is a controlled engineering trial, not a production-ready universal agent and not an official MCP or WebMCP specification.

The trial demonstrates five controls at the browser execution boundary:

1. Deployment-owned origin, tool-name and complete input-schema allowlisting.
2. Live-tab origin revalidation immediately before dispatch.
3. JSON serialisation, input-schema validation and bounded payload sizes.
4. Durable pending and final capability receipts.
5. Fail-closed handling for missing policy, origin drift, schema drift, unverified frames and receipt-storage failure.

## Current trial profile

The current policy is deliberately narrow:

- One exact origin, supplied by `T4H_TRIAL_ORIGIN`.
- One read-only capability: `get_flights`.
- Input schema: an object with an optional string `destination` property, matching the current Chrome smoke fixture exactly.
- Top-level frame only (`frameId === 0`).
- Maximum input size: 65,536 bytes.
- Maximum output size: 32,768 bytes.
- Execution wait timeout: 5 seconds.
- Receipt retention: the most recent 500 entries in `chrome.storage.local`.

No write tools are currently allowlisted. A tool excluded by deployment policy is rejected before the extension asks the user to approve it. The policy is checked again immediately before dispatch, so a prompt decision can never override deployment policy. The current trial does not grant authority to execute payments, bookings, messages, deletions or other mutations.

## Configuration

Set the exact site origin in `.env`:

```env
T4H_TRIAL_ORIGIN=https://trial.example.test
```

Use only the scheme and host, with no path or trailing slash. The page must register `get_flights` with the exact schema in `extension/sidepanel/services/t4h/policy.ts`.

The official build enables the policy gate. If `T4H_TRIAL_ORIGIN` is empty, no origin is allowlisted and all page tools are blocked. This is intentional fail-closed behaviour. The settings screen reports this condition rather than implying that a usable origin is configured.

## Execution and receipt lifecycle

For an allowlisted call, the extension:

1. Resolves the requested tool from the active tab's discovered WebMCP tools.
2. Reads the live tab URL and checks it against the origin captured for the turn.
3. Matches exact origin, tool name and schema against deployment-owned policy. Page annotations are not authority for this decision.
4. Canonicalises and validates the JSON input and checks its size.
5. Writes a pending receipt before dispatch. If this write fails, execution is refused.
6. Calls the existing extension `executeTabTool` adapter through the read-only invoker.
7. Bounds the result, redacts sensitive fields and writes a final receipt.

Receipts include a run ID, source revision, environment, origin, tool name, policy decision, timestamps, outcome, redacted result summary and error code. They do not store raw arguments or returned page data. The extension settings screen shows the receipt count and exports the records as JSON.

Receipt writes are serialised in the extension context to prevent concurrent read-modify-write operations from dropping records. A pending receipt is retained if final persistence fails after dispatch. The UI tells the model not to retry automatically when dispatch occurred but a final receipt could not be saved or the result is uncertain.

## Important limitations

- A local timeout stops waiting for a page tool; it does not prove that the page handler stopped. A timed-out call is recorded as dispatched and uncertain. Verify the page state before retrying.
- The receipt proves what the extension observed and recorded. It does not independently prove a downstream business transaction or external side effect.
- Only the top frame is permitted. Same-origin and cross-origin iframe authority is not yet independently established by this trial.
- The allowlist is build-time configuration, not a remotely managed policy service.
- The extension's upstream permission prompt remains a separate user-experience control. The T4H gate is the final execution authority for this trial.
- The receipt ledger is local to the browser profile and capped at 500 entries. Export it if longer retention is required.
- The trial profile has no write-capability pathway. A future write-capability design must define authority, consent, risk, idempotency, recovery and verification separately; it must not simply reuse the read-only invoker.

## Tests

```bash
npm run typecheck
npm run test:unit
npm run test:smoke
npm run build
```

The upstream smoke suite runs with the T4H trial policy disabled so it continues to test the original extension's general permission and UX behaviour. `tests/smoke/t4hPolicy.smoke.test.ts` builds a separate policy-enabled extension and verifies real Chrome execution, receipt persistence, data minimisation and write denial. Smoke tests run one browser session at a time to avoid competing Chrome instances.

## Source provenance

The browser-agent base is forked from [`GoogleChromeLabs/webmcp-extension`](https://github.com/GoogleChromeLabs/webmcp-extension). The T4H policy core and browser adapter are vendored from `tech4humanity-002/webMCP`, branch `work/controlled-chrome-agent-integration`, commit `63510d9952551cdbb7628887229c27816df74ea4`. The vendored files are `trial-core.mjs` and `browser-adapter.mjs`; the Chrome agent gate and extension integration are T4H-specific adapters.

## Release boundary

This trial is not approved for production deployment. The next release gate requires a reviewed policy configuration, a reproducible CI run, browser installation and upgrade testing, receipt export/recovery testing, and a separate threat review for any write capability. No production site is modified by these tests.
