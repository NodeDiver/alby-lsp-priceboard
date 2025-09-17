# Ideas for Improvement — Code, Architecture, and Ops

This list groups actionable recommendations with file pointers for clarity.

## Architecture & Consistency
- Single DB module: remove `lib/db-improved.ts` and consolidate functionality in `lib/db.ts` with a clear interface surface (save, get latest by size, list sizes, metadata, history, clear).
- Implement `getDatabaseStatus()` in `lib/db.ts` and fix import in `pages/api/debug.ts`.
- Standardize LSPS1 endpoints: reconcile `info` vs `get_info` usage across `lib/lsps.ts` and `lib/lsp-api.ts`. Consider a provider adapter table like `{ id, base, getInfoPath, createOrderPath }`.
- Align LSP ids with rate-limit keys: change `'lnserver-wave'` to `'lnserver'` in `lib/lsp-api.ts`.
- Remove legacy key usage in `/api/clear-cache` and add wildcard delete for `alby:lsp:channel:*`.

## API Design
- Freeze a versioned schema for `/api/prices` and document it. Include:
  - `observed_at` (server timestamp), `provider_endpoint` (resolved base used), `latency_ms` if available.
  - Optional `fiat` conversion on the server to reduce client network calls.
- Ensure `data_source` semantics are uniform (`live` for <1h cached, `cached` for older; consider adding `fresh_cached: true|false`).
- If “estimated” pricing is needed, implement server-side synthesis or remove references from UI until ready.

## Scheduling & Ops
- Change cron cadence in `vercel.json` to match desired freshness (e.g., every 15 minutes) and distribute per-channel-size work across runs to reduce burst load.
- Add structured logging fields in fetchers (lsp_id, channel_size, attempt, error_code) to simplify analysis.
- Add a light-weight health endpoint that returns reachable LSPs and their last successful fetch.

## Error Handling & Resilience
- Expand `LspErrorCode` mapping to cover common TLS/DNS/connectivity cases and unify display in the UI.
- Add exponential backoff with jitter for per-LSP retries and include a cap.
- Record minimal raw response snapshots (sanitized) for debugging when schema mismatches occur (behind a flag).

## Data Model & Storage
- Keep per-channel-size snapshots as today; add a daily roll-up key for quick aggregates (e.g., cheapest per LSP per size).
- Write-through caching: whenever a live response succeeds, immediately upsert the per-size snapshot and append a compact history item.
- Add a server-only data retention setting (e.g., history entries limit/TTL) to control cost.

## Type Safety & Linting
- Set `typescript.ignoreBuildErrors` to `false` in `next.config.ts` and fix TS issues:
  - Import `LSPPrice` in `pages/api/migrate-db.ts`.
  - Type narrowings in JSON-parsing branches.
- Add `eslint` rules for error handling (no-floating-promises) and consistent import ordering.

## Testing
- Unit tests:
  - LSPS1 info/order parsing + error mapping in `lib/lsp-api.ts`.
  - DB serialization/deserialization and TTL behaviors in `lib/db.ts`.
  - API handlers for `/api/prices` and `/api/prices-ui` (mock DB + mock fetch).
- Integration tests:
  - Mock LSP endpoints to simulate success, rate limits, whitelist errors, and peer-not-connected.
- Smoke tests for cron job path (single channel size) on CI.

## Frontend & UX
- Move currency conversion optionally to the server; cache rates per code for 10 minutes on the server to avoid multiple client-side requests.
- Clarify data source banners; if a row is `cached` but <1h old, display a “fresh-cached” chip to reduce confusion.
- Add tooltips that explain `PEER_NOT_CONNECTED`, `WHITELIST_REQUIRED`, etc., and link to a troubleshooting doc.
- Consider lazy-loading provider logos and use `next/image` domain allowlist with explicit hostnames when known.

## Security
- Review open CORS on all API routes; keep for public endpoints, restrict debug/inspector endpoints or add a feature flag for production.
- Ensure environment variables use a single convention; rely on `Redis.fromEnv()` and one `isRedisConfigured()` helper.

## Deployment & Docker
- Multi-stage Dockerfile to build in one stage and run in a minimal runtime stage; avoid uninstalling dev deps post-build (reduces image size and complexity).
- Add `HEALTHCHECK` to Dockerfile and a corresponding `/api/health` endpoint.

## Documentation
- Reconcile status statements (Production Ready vs Experimental) between `README.md` and `AGENTS.md`.
- Document LSP-specific requirements (peering, whitelist, rate limits) and how they affect “live” availability.
- Provide examples for `curl` usage against `/api/prices-ui` with `fresh` and `force` options.

## Concrete Next Steps (Suggested Order)
1. Implement `getDatabaseStatus` in `lib/db.ts` and update `/api/debug` import; fix `/api/clear-cache` to delete new keys.
2. Remove `lib/db-improved.ts` after merging functions into `lib/db.ts`; run a simple migration (if needed) via `pages/api/migrate-db.ts` with correct types.
3. Fix LSPS1 path and LSP id mismatches; add provider-specific path overrides.
4. Change cron schedule to every 15 minutes; add a quick metrics log line per run.
5. Flip `ignoreBuildErrors` to `false` and address type errors; add a first round of unit tests.

---
If you’d like, I can start by consolidating the DB layer and fixing the debug/clear-cache endpoints so the system status reflects reality and ops become safer.

