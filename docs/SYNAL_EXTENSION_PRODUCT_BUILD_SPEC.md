# SYNAL Browser Extension — Product and Engineering Build Specification

**Status:** Implementation baseline for the SYNAL extension workstream  
**Repository:** `tech4humanity-002/webmcp-extension`  
**Canonical product:** SYNAL  
**Search capability:** Syntax  
**Specification owner:** T4H product / engineering  
**Scope:** Chrome desktop extension first; shared contracts designed for later mobile, vehicle and television adapters.

---

## 1. Executive decision

Build the SYNAL browser extension as the first portable access surface to a person's SYNAL environment. Do not build a new browser engine, a car accessory, a television remote or a generic chatbot.

The extension is the customer-facing shell and contextual entry point. SYNAL owns the personal environment and capability experience. Syntax remains the separately owned search capability and must remain independently usable. SIGNAL remains the wider intelligence and coordination layer. Agents, models, memory, augmented memories, OwnYourAI, consent, media, CRM, payment and external services retain their own ownership and contracts; the extension discovers and presents them rather than absorbing their source-of-truth responsibilities.

The existing WebMCP extension is a substantial implementation substrate: Manifest V3, side panel, tab-aware agent sessions, page-tool discovery, provider backends, on-device Prompt API path, permissions, execution policy, receipts, tests and Chrome smoke-test harness. Preserve and extend it. Do not replace it with a new scaffold or discard its upstream provenance.

**First product outcome:** a person can install the extension, understand what SYNAL can access, search through Syntax where a real authorised search endpoint is available, inspect the current page, invoke an enabled capability, manage connections and permissions, resume work, and inspect an evidence-backed activity/receipt history. Unsupported or unconnected functions must be clearly identified rather than represented as live.

## 2. Product boundaries and terminology

| Name | Owns | Must not become |
|---|---|---|
| SYNAL | Personal environment, customer experience, device presence, capability discovery and orchestration experience | A replacement for every connected product |
| Syntax | Search UX, query refinement, retrieval, ranking, source attribution and search receipts | A universal agent, translation engine, memory owner or generic operating system |
| SIGNAL | Wider intelligence, coordination and meaningful cross-system signals | A synonym for SYNAL or a second extension shell |
| Extension | Browser presence, active-tab context, user interaction, capability invocation and local session continuity | A browser fork or authority-free automation daemon |
| Augmented Memories | Memory capture, enrichment, retrieval and user control | A second hidden browser-history database |
| OwnYourAI | User control and portability of AI context and provider choice | A compulsory model host |
| Consent / identity services | Authentication, consent, authority, scopes, revocation and account lifecycle | Client-side flags that claim to grant authority |
| Agents / skills / widgets / MCP | Separately versioned capabilities with explicit contracts | Arbitrary executable code downloaded and run by the extension |

Names and boundaries above are normative. Product surfaces may be visually integrated while ownership and data contracts remain separate.

## 3. Customer experience

### 3.1 First-run experience

The extension must not start by asking a new user to configure ten providers or paste API keys.

1. Explain SYNAL in plain language: search, understand, remember, connect and use capabilities from the browser.
2. Explain the exact browser permissions requested and why. Request optional permissions at the moment a feature needs them where Chrome permits.
3. Offer account activation or a clearly labelled local/demo mode. Never imply that an account is connected when it is not.
4. Show the available routes: Syntax search, current-page understanding, enabled capabilities, memory, media and connections.
5. Start with an empty personal estate. No fabricated history, saved searches, connected sources, recommendations or activity.
6. Allow the user to skip provider setup and use the capabilities that genuinely work without it.
7. Provide a clear route to privacy, consent, connection management, export and revocation.

A first-run demo may use public fixture data, but every fixture must be labelled DEMO and must never be written into personal history as if it were the user's activity.

### 3.2 Main navigation

Use a compact, persistent navigation model. The initial extension shell should expose:

- **Home:** current context, recent real activity, active work and useful entry points.
- **Search:** Syntax search. Search must remain the primary route to finding information.
- **Ask:** ask about the current page, selected text or an explicitly supplied context pack.
- **Memory:** view, search, save, correct, export and delete user-controlled memories when the connected memory service supports those operations.
- **Skills:** discover, inspect, enable, configure, invoke and disable registered capabilities.
- **Agents:** see available agents and active runs; inspect inputs, tools, approvals, progress and results.
- **Media:** discover and control supported media capabilities; do not claim a provider is connected without a tested adapter.
- **Connections:** identity, model providers, MCP servers, apps and services, with explicit connection state.
- **Activity:** completed, partial, failed, blocked and unresolved runs, including receipts and recovery state.
- **Settings:** appearance, privacy, permissions, providers, local processing, data export and diagnostics.

The navigation can be progressively delivered, but every visible control must either perform its declared action or clearly state why it is unavailable. No decorative dead controls.

### 3.3 Contextual browser interaction

The extension can work with:
- the active tab URL, title and favicon;
- explicitly selected text;
- page text or structured content after the user grants the relevant access;
- WebMCP tools registered by the page;
- same-origin/cross-origin frame tools only when browser and frame policies allow verified access;
- user-selected tabs or an explicitly created workspace.

It must not silently read all tabs, form fields, passwords, private messages or browsing history simply because a broad host permission exists. Context collection must be visible, scoped and minimised. Sensitive pages and unsupported browser surfaces must fail closed.

### 3.4 Interaction principle

SYNAL is an instrument, not a chatbot bolted onto Chrome. Search, capabilities, memory, agent runs, connections and evidence should be reachable without forcing every task through a conversational transcript. Conversation is one interaction mode, not the product architecture.

## 4. Shared architecture

The extension is a client of shared services. It is not the source of truth for identity, authority, commercial entitlements, canonical memory or connected-source data.

```text
Chrome Extension (Manifest V3)
  ├── SYNAL Side Panel / Home / Search / Ask / Skills / Activity
  ├── Browser Context Adapter
  ├── Local Session + Cache (IndexedDB / chrome.storage)
  ├── Capability Client + WebMCP Discovery
  ├── Permission UX + Local Policy Enforcement
  └── Evidence / Receipt Viewer
          │ HTTPS, short-lived scoped session
          ▼
SYNAL Service Gateway (Cloudflare-first deployment preference)
  ├── Identity and device registration
  ├── Consent and authority decision
  ├── Capability registry and version resolution
  ├── Syntax search adapter
  ├── Agent / worker orchestration
  ├── Model/provider routing
  ├── Memory and knowledge adapters
  ├── Media and service adapters
  ├── Commercial entitlement and usage
  └── Receipt, telemetry, recovery and revocation
          │
          ├── Syntax (search remains independently owned)
          ├── Memory / Augmented Memories
          ├── OwnYourAI and model providers
          ├── Agents, skills, widgets and MCP services
          ├── CRM, payments and other connected services
          └── SIGNAL intelligence and coordination
```

The Cloudflare-first gateway is an architectural preference, not evidence that the required production endpoints already exist. Do not create duplicate Workers or a second registry if a canonical service already exists. Before implementing an adapter, inspect the existing endpoint, owner, auth model, schema, deployment and evidence. If the endpoint is absent, mark the integration BLOCKED/PROPOSED and implement a contract test or mock fixture separately from production data.

### 4.1 Edge/runtime boundary

**Extension / edge responsibilities**
- collect only consented browser context;
- render user interaction and capability state;
- maintain ephemeral context and local caches;
- keep tab/session continuity;
- perform low-authority local operations;
- redact sensitive context before permitted remote calls;
- verify signed/versioned capability metadata;
- display pending, completed, partial, failed and unknown execution states.

**Gateway/runtime responsibilities**
- authenticate the person and device;
- make authoritative consent and permission decisions;
- issue short-lived, narrowly scoped tokens;
- resolve capability ownership, version, dependencies and entitlement;
- execute privileged operations;
- enforce quotas, budgets, retries and idempotency;
- create durable receipts and telemetry;
- support revocation, recovery and readback.

**Boundary rule: context may be local; authority must be controlled.** A client-side setting, hidden button, model response or page annotation is never authority.

## 5. Capability contract

Every callable capability must have a registered, versioned manifest. Minimum fields:

| Field | Required meaning |
|---|---|
| `id` | Stable reverse-domain or namespace-qualified identifier |
| `name`, `description` | User-readable purpose and outcome |
| `owner` | Accountable product/team/provider |
| `version`, `contentHash` | Immutable version and integrity identity |
| `type` | search, memory, agent, widget, recipe, connector, media, service or tool |
| `runtimes` | extension, web, local, gateway, Android, CarPlay, TV, etc. |
| `inputs`, `outputs` | Typed schemas and size limits |
| `permissions` | Data scopes and operations required |
| `dependencies` | Required services, capabilities and versions |
| `trustState` | proposed, reviewed, tested, verified, quarantined or revoked |
| `entitlement` | free, BYOT, paid, partner or organisation policy |
| `executionPolicy` | read/write/destructive classification, approval and idempotency requirements |
| `receiptPolicy` | Required pending/final receipt and readback evidence |
| `lifecycle` | install, configure, update, disable, revoke and uninstall behaviour |

The registry stores metadata and trust decisions. It must not become a remote-code loader. Executable code must be packaged with the extension or delivered through a reviewed, signed and version-pinned release mechanism. Never use `eval`, dynamic remote imports or arbitrary downloaded JavaScript.

### 5.1 Capability lifecycle

`DISCOVERED → INSPECTED → AUTHORISED → ENABLED → INVOKED → VERIFIED → DISABLED/REVOKED`

A catalogue listing is not an installation. A saved credential is not a connection. A successful HTTP response is not proof of the intended outcome. A model claim is not a receipt.

## 6. Syntax integration

Syntax remains an independent product and the canonical search capability. The extension must call Syntax through a documented, authenticated interface; it must not create a second personal search index or scrape the Syntax UI as an API.

### 6.1 Required search request

Conceptual request contract:

```json
{
  "query": "user-entered natural language or keywords",
  "scope": ["explicitly-connected-source-ids"],
  "filters": {},
  "limit": 20,
  "context": {
    "activeTab": false,
    "selection": false,
    "workspaceId": null
  },
  "requestId": "client-generated-idempotency-key"
}
```

The extension only includes active-tab or selected-text context after the user explicitly chooses to include it. It does not silently append browsing context to every search.

### 6.2 Required search response

Each result must preserve:
- canonical result/source ID;
- title and concise excerpt;
- source name/type and source URL/path where allowed;
- source connection state;
- freshness/version information when available;
- relevance/ranking explanation where available;
- truth state and evidence reference;
- actions supported by that source;
- warnings for stale, incomplete or unverified results.

Search response states: `CONNECTED`, `AVAILABLE_TO_CONNECT`, `NOT_CONNECTED`, `BLOCKED`, `UNSUPPORTED`, `DEGRADED`. Never represent the curated hosted Syntax knowledge fallback as a live search across personal files or connected accounts.

### 6.3 Syntax integration gate

Before enabling the live adapter, verify:
1. canonical API endpoint and version;
2. authentication and device/session binding;
3. source scopes and consent propagation;
4. query/result schemas;
5. timeout, pagination and rate limits;
6. error and stale-source behaviour;
7. revocation and disconnected-source behaviour;
8. receipt generation and independent readback;
9. that local-only content never leaves the device unless explicitly invoked.

Until these checks pass, show Syntax as an available capability with a clear connection state, not as a live integrated service.

## 7. Identity, BYOT and secrets

Support two customer paths:

1. **Managed connection:** customer signs into SYNAL and authorises a provider through a supported OAuth/device flow. The gateway stores provider credentials in an approved secrets system and issues short-lived scoped sessions to clients.
2. **Bring your own token:** customer supplies a provider token only where the product can store and use it safely. Prefer direct-to-provider local use only when supported and clearly disclosed. Otherwise exchange it through a secure backend flow and store it in an approved vault.

Rules:
- Never place provider secrets in source code, extension bundles, URLs, analytics, logs or receipts.
- Do not use long-lived bearer tokens in `chrome.storage.local` as the default managed model.
- Never send a provider token to a web page or WebMCP tool.
- Mask secrets in UI and never reveal them again after save.
- Scope, rotate, expire and revoke credentials.
- Distinguish account login, provider connection, consent and capability entitlement; they are not interchangeable.
- BYOT does not bypass safety, policy, provider terms or capability permissions.

## 8. Consent, authority and execution safety

All actions are classified before execution:

| Class | Examples | Required control |
|---|---|---|
| Read-only, low sensitivity | Search a public page, summarise user-selected text | Explicit context scope; page content treated as untrusted |
| Personal-data read | Search connected drive, retrieve memory, read CRM record | Authenticated scope, consent, source permissions and audit receipt |
| Reversible write | Save a memory, create a draft, add a task | Preview, explicit confirmation where required, idempotency and receipt |
| Consequential/destructive | Send message, publish, purchase, transfer, delete, change access | Fresh human approval immediately before action, strong action summary, no blanket allow |
| Safety/legal/authority-sensitive | Vehicle actions, healthcare, finance, legal or third-party data | Human approval and domain-specific restrictions; block if authority is unclear |

WebMCP annotations are untrusted hints. The deployment-owned policy is authoritative. Exact origin, tool ID, input schema, frame identity, user permission and current tab context must be revalidated immediately before dispatch. A page cannot grant itself permission by declaring a tool read-only.

Untrusted page output is data, never instructions. Apply prompt-injection protections, output size limits, schema validation, origin checks and redaction. These protections reduce risk; they do not prove that prompt injection is impossible.

The existing T4H fail-closed trial gate must remain in place until a broader reviewed policy and real backend authority service replace it. Do not widen the current trial origin/tool allowlist merely to make a demo work.

## 9. Local data and session continuity

Use browser-native storage for scoped local state. Prefer IndexedDB for structured records and larger datasets; use `chrome.storage` for extension settings and small state. Do not treat LocalStorage as the canonical memory database.

Separate:
- transient tab context;
- conversation/session state;
- saved workspace state;
- personal memory records;
- capability metadata/cache;
- connection metadata;
- execution receipts;
- diagnostics/telemetry.

Each record must declare owner, scope, source, created/updated time, retention and deletion/export behaviour. Local caches are not durable server truth. Sync only when a real authenticated service and consented data contract exist.

Session restore must not silently replay actions. Restore context and drafts; require fresh authority for new writes. Pending executions after restart become UNKNOWN until reconciled from the authoritative runtime. Never convert an unobserved outcome into success.

## 10. UI and interaction requirements

- Premium, restrained, legible interface; adapt to Chrome light/dark settings.
- Search is prominent and can be used without entering chat.
- Navigation is compact and expandable; no crowded fixed-button dashboard.
- Capability cards show purpose, owner, connection state, permission summary, supported surfaces and last verification.
- Agent runs show goal, context supplied, capabilities invoked, approvals, progress, outcome and evidence.
- Every action has a clear cancel/stop path where cancellation is meaningful.
- Errors explain the cause and recovery action in plain language.
- Keyboard navigation, screen-reader labels, high contrast, reduced motion and sufficiently large targets are release requirements.
- Do not display fake progress, synthetic personal data or green success states before the runtime confirms the result.
- The extension must remain useful when optional AI APIs are unavailable.

## 11. Google Chrome and WebMCP capability strategy

Feature-detect every API. Do not infer support from a partnership, browser brand or Chrome version alone.

- WebMCP is progressive enhancement for pages that expose browser-native tools. Keep a registry/API fallback for pages without WebMCP.
- Chrome built-in AI APIs are optional local accelerators. Translator, Language Detector, Summarizer and Prompt availability differs by API, Chrome channel/version, hardware and platform.
- Chrome desktop built-in AI availability does not imply Android or iOS availability.
- Do not make local foundation-model download a prerequisite for core search, navigation or account functions.
- The extension must expose which execution route was used: local, user-selected provider or SYNAL gateway.
- When a local API is unavailable or fails, fallback only to an explicitly configured and consented provider; otherwise return a clear unavailable state.

## 12. Future device adapters

The shared capability contracts are intended to support other surfaces, but the Chrome extension does not itself become those apps.

| Surface | Shared services reused | Separate implementation required | Constraint |
|---|---|---|---|
| Android phone | Identity, Syntax, memory, agents, registry, media, consent, receipts | Native Android shell, secure storage, biometrics, share sheet, notifications, audio and background lifecycle | Chrome desktop extension is not an Android app |
| BYD DiLink | Same shared services and responsive web experience | Vehicle-specific native shell or supported web container, large touch UI, voice/audio lifecycle, install/restore | DiLink model/firmware and supported installation method must be verified; no rooting or undocumented firmware changes |
| Apple CarPlay | Identity, Syntax queries, memory, audio/media, safe agent intents and signals | Native Swift CarPlay client, approved templates, entitlement and handoff | No arbitrary browser extension or unrestricted full-screen web UI; complex work hands off to phone; video only where Apple and vehicle support it while parked |
| Samsung Tizen | Capability registry, media, identity, Syntax, memory and agents | Native Tizen TV client, remote/focus navigation, playback and TV lifecycle | Samsung model, Tizen version, APIs and store requirements must be tested |
| Android TV / Google TV | Shared services and Android-compatible client libraries | Native TV client, remote focus model, media integration and TV distribution | Separate from Android Auto and Android Automotive OS |

These are later adapters, not part of the first Chrome release. No hardware manufacturing or proprietary remote is required.

## 13. Implementation work packages

### WP0 — Source and runtime reconciliation
- Inspect existing extension, Syntax, SIGNAL and SYNAL repositories.
- Record exact current branches, commit SHAs, build commands, tests, deployed endpoints and ownership.
- Map existing components as reuse, wrap, adapt, extract, rebuild or reference.
- Confirm the Syntax API before writing an adapter.
- Confirm the existing identity/consent/receipt service before creating another one.

**Exit evidence:** source map with paths, owners, versions and verified runtime contracts.

### WP1 — Extension product shell
- Retain Manifest V3 and the current side-panel entry point.
- Introduce navigation and view composition without breaking chat, page-tool discovery, tab sessions, permissions, settings or receipts.
- Add Home, Search, Skills, Agents, Memory, Connections and Activity views.
- Only show a view as functional when its underlying adapter is connected; otherwise show an honest connection state and setup path.
- Add route/state persistence with safe restoration.

**Exit evidence:** built extension launches in Chrome; all navigation and existing flows pass smoke tests; no dead controls.

### WP2 — Syntax search adapter
- Implement typed client and response normalisation against the canonical Syntax API.
- Add query, source filters, result list, provenance details, open-source action and saved-search behaviour only where supported.
- Add timeout, cancellation, retry limits, error mapping and no-results states.
- Add contract fixtures for connected, disconnected, stale, blocked and malformed responses.
- Keep any fixture data visibly DEMO.

**Exit evidence:** authenticated search against a real Syntax endpoint, source evidence visible, request receipt and independent source readback.

### WP3 — Capability registry and skills
- Define runtime-validated manifest schema.
- Add registry client, version pinning, trust state and compatibility display.
- Support discover, inspect, enable, configure, invoke, disable and revoke.
- Use packaged code or signed reviewed releases; no arbitrary remote code.
- Map existing widgets/agents/recipes to canonical IDs rather than copying their implementation.

**Exit evidence:** at least one real registered capability is enabled, invoked, receipted, disabled and independently verified.

### WP4 — Identity, connections and BYOT
- Integrate existing identity and consent services.
- Support device registration and session renewal.
- Implement one provider connection end-to-end before generalising.
- Keep tokens outside extension page context and logs.
- Provide disconnect, revoke, expiry and recovery paths.

**Exit evidence:** real provider connection, scoped token use, revocation and readback.

### WP5 — Memory and continuity
- Integrate the canonical memory service rather than inventing a second memory owner.
- Allow user-directed save/retrieve/correct/export/delete where supported.
- Restore workspace context without replaying writes.
- Show source and timestamp for recalled items.

**Exit evidence:** save and retrieve a real user-authorised memory with provenance and deletion/export verification.

### WP6 — Agent, media and service capabilities
- Reuse the current agent session and WebMCP machinery.
- Integrate media providers through documented APIs and platform rules.
- Connect CRM/payment/service functions only through server-side governed capabilities.
- Require confirmation for consequential actions.
- Show cost/entitlement only from authoritative commercial services.

**Exit evidence:** at least one useful multi-capability workflow completes with receipts and independent readback.

### WP7 — Release and customer onboarding
- Produce signed/versioned Chrome package and update strategy.
- Prepare clear installation, permissions, provider setup, uninstall and recovery instructions.
- Test clean install, upgrade, downgrade/rollback, profile reset and uninstall.
- Establish support and incident route.
- Keep free/BYOT entry possible where the service economics and security permit it.

**Exit evidence:** reproducible package, clean-install test, update/rollback test, user acceptance and support runbook.

## 14. End-to-end acceptance scenarios

The following are release scenarios, not aspirational checklist ticks.

1. **Clean install:** new Chrome profile, install extension, read consent, grant only requested permissions, no fake history appears.
2. **Syntax search:** query with no browser context, return attributable results from a real authorised source, open the source and verify it.
3. **Contextual search:** user explicitly adds selected page text, sees exactly what will be shared, then searches.
4. **Page understanding:** inspect a normal page; page content cannot override system policy or trigger an unapproved action.
5. **Capability discovery:** a page with WebMCP tools and a page without WebMCP both work through their appropriate discovery paths.
6. **Permission denial:** deny a write action; no dispatch occurs and a denial receipt is recorded.
7. **Consequential action:** purchase/send/delete remains blocked until fresh explicit approval; no persistent blanket approval.
8. **Provider unavailable:** local API/provider absent; core extension remains usable and reports the limitation without fake fallback.
9. **Session restore:** close/reopen Chrome; safe context returns, but no action is replayed.
10. **Unknown outcome:** interrupt after dispatch; receipt remains UNKNOWN until authoritative reconciliation.
11. **Revocation:** revoke a provider/skill; future calls fail closed and cached credentials are invalidated.
12. **Export/delete:** export the user's local receipts/settings and verify deletion where supported.
13. **Regression:** existing chat, tab-specific sessions, tool discovery, consent, settings, policy and receipt tests continue to pass.
14. **Accessibility:** keyboard-only navigation, focus order, screen reader names, contrast and reduced-motion checks pass.

## 15. Non-functional requirements

- **Security:** least privilege, no remote code execution, strict schema validation, output bounds, origin/frame validation, redaction, secure secret handling.
- **Privacy:** explicit context inclusion, data minimisation, clear retention, export/deletion and no hidden cross-tab collection.
- **Reliability:** bounded timeout/retry, idempotency for writes, pending/final receipts, UNKNOWN state and recovery owner.
- **Performance:** extension shell usable before optional model download; lazy-load nonessential views; avoid indexing whole browsing history by default.
- **Portability:** shared contracts independent of Chrome UI; platform adapters declare capabilities and limitations.
- **Accessibility:** keyboard, screen reader, contrast, reduced motion and clear language.
- **Maintainability:** preserve upstream notices/licence, pin dependencies, track browser compatibility and document every adapter.
- **Cost:** no always-on polling; event-driven refresh, explicit user actions and bounded background work.

## 16. Observability and truth model

Every feature and integration must expose one of:

- **REAL:** executed against the named runtime/source, with receipt, independent readback and observable telemetry.
- **PARTIAL:** a working subset exists and its boundary is explicit.
- **BLOCKED:** a named authority, dependency, safety, legal or credential condition prevents execution.
- **DEGRADED:** a formerly working path is unavailable, stale or failing.
- **QUARANTINED:** unsafe, compromised, poisoned or repeatedly failing capability.
- **ASPIRATIONAL:** intended but not implemented or tested.

Required evidence for a consequential operation:
- request and correlation ID;
- user/device identity reference (non-secret);
- capability ID/version/hash;
- source and scope;
- policy/consent decision;
- input/output schema hashes and redacted metadata;
- dispatch and completion times;
- result status;
- receipt ID;
- independent readback or explicit reason unavailable;
- recovery/compensation state and owner.

No receipt means the operation is not REAL. No independent readback means the outcome is not proven. A browser UI state is not a substitute for backend telemetry.

## 17. Dry-run and release procedure

Run from a clean checkout using the pinned Node version in `.nvmrc`:

```bash
npm ci
npm run typecheck
npm run build
npm test
```

The existing CI workflow additionally installs Chrome for Testing and runs Manifest V3 smoke tests. It is the required remote dry-run for this repository.

For local Chrome verification:
1. Build the extension.
2. Open `chrome://extensions`.
3. Enable Developer mode.
4. Load the generated `out` directory as an unpacked extension.
5. Open a normal website and open the SYNAL side panel.
6. Run the acceptance scenarios above, recording browser version, OS, commit SHA, test result and screenshots.
7. Export and inspect receipts.
8. Repeat after a browser restart and extension reload.

A successful TypeScript build alone is not product acceptance. CI passing is not evidence that a live Syntax, identity, memory or provider integration is connected.

## 18. Explicit non-goals for the first extension release

- Building or maintaining a Chromium fork.
- Building an unrestricted general-purpose autonomous browser agent.
- Installing the desktop extension into Android WebView or BYD firmware.
- Replacing Syntax, SIGNAL, memory, OwnYourAI or ConsentX.
- Shipping every catalogue widget on day one.
- Building proprietary vehicle or television hardware.
- Unrestricted CarPlay browsing or video.
- Silent collection of browser history or page content.
- Treating demo data, mock services or a successful UI animation as live functionality.

## 19. Open dependencies that must be resolved by repository/runtime inspection

These are not reasons to stop the whole build. Continue with isolated contracts, fixtures and non-dependent work while they are resolved.

| Dependency | Required resolution | Safe work that can continue |
|---|---|---|
| Syntax API | Confirm endpoint, auth, schema and live source coverage | Build typed adapter boundary and contract fixtures |
| SYNAL identity/device registration | Identify canonical service and token lifecycle | Build client interface and local UI states |
| ConsentX/authority | Confirm decision endpoint and scope format | Keep existing fail-closed policy; design consent UX |
| Memory service | Identify canonical API and data ownership | Build memory view contract and fixture tests |
| Capability registry | Identify canonical owner/schema | Define adapter interface; do not create competing registry |
| Media providers | Confirm supported APIs and entitlements | Build capability discovery and provider-neutral controls |
| BYD hardware | Exact model/year/DiLink version | Complete Chrome extension first |
| CarPlay | Entitlement and supported vehicle feature | Design native adapter contract only |
| Samsung TV | First target model/Tizen version | Build TV interaction prototype separately after extension |

## 20. Completion definition

This workstream is complete only when:
- the existing extension has become a coherent SYNAL product surface rather than a renamed WebMCP demo;
- Syntax search is genuinely connected to an authorised source;
- the user can discover and manage real capabilities;
- at least one real capability completes an end-to-end task;
- identity, consent, permissions and revocation are tested;
- activity and receipts reflect actual execution and can be independently read back;
- clean install, upgrade, restart, failure and recovery scenarios pass;
- Chrome CI, local Chrome smoke tests and user acceptance pass;
- limitations and unsupported integrations are visible and accurately described.

Do not report completion on the basis of a document, mock, passing typecheck or isolated small win.
