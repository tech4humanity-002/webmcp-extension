# WebMCP upstream recovery receipt — 2026-11-24

## Scope

Isolated synchronization of the T4H-controlled `webmcp-extension` fork with `GoogleChromeLabs/webmcp-extension`. No production deployment, Cloudflare change, live origin policy expansion, or GitHub push was performed.

## Source revisions

- T4H main before sync: `402be55`
- Google upstream main fetched: `f5681de`
- Pre-sync relationship: T4H main was 6 commits ahead and 11 commits behind upstream.
- Sandbox branch: `recovery/upstream-sync-20261124`
- Original `main` remains unchanged.

## Preserved T4H controls

- Deployment-owned exact-origin/tool/input-schema policy remains in the execution path.
- Read-only trial remains fail-closed when `T4H_TRIAL_ORIGIN` is empty.
- Capability receipt ledger, redaction, pending/final receipt lifecycle and interrupted-execution recovery remain present.
- No additional site origins or capabilities were authorized by this synchronization.

## Upstream changes incorporated in sandbox

- Tool output-schema propagation and result validation.
- Tool source/frame identification and frame-aware dispatch.
- Improved tool error propagation.
- Related server, tab-session and extension integration updates.

## Google model configuration

- Updated the sandbox default from `gemini-3.6-flash` to `gemini-3.8-flash` for the Gemini Developer API.
- README warns that Gemini Developer API free-tier content may be used to improve Google products; free-tier testing must use synthetic/public data only.
- No Gemini API key was available and no live model request was made.

## Verification receipts

- `npm ci`: completed; no reported dependency vulnerabilities.
- `npm run typecheck`: exit 0.
- `npm test`: 266 passed, 0 failed (unit and Chrome smoke suites).
- `npm run test:smoke`: 28 passed, 0 failed in the isolated sandbox.
- `npm run build`: completed with a sandbox-only auth token and blank trial origin.
- `git diff --check`: required before commit.

## Deployment and credential boundary

- No production files changed.
- No production origin was added to the T4H execution allowlist.
- No real API key or access token was written to the sandbox.
- The branch is local only; no push or deployment occurred.

## Remaining blockers

- Live Gemini generation requires a user-provisioned API key and a deliberate choice between Developer API free tier (non-sensitive test data only) and paid/enterprise access.
- Live WebMCP public origin-trial delivery remains unverified; `https://web.mcp-native.com/origin-trial` returned HTTP 503 during this recovery.
- The T4H policy still authorizes only its existing single-origin/single-tool trial profile. SYNAL and FrameOps were exercised directly through native WebMCP but have not been added to the extension allowlist.
