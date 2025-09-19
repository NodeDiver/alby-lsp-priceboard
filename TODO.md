# TODO — Pragmatic Improvements

Focus on essentials that add value without adding complexity.

## Verified OK (no action)
- Clear cache keyspace: `pages/api/clear-cache.ts` deletes all `alby:lsp:*` keys (channels, metadata, history).
- Rate-limit ID consistency: `lib/lsp-api.ts` uses `'lnserver'` in cooldown map.

## Core Fixes (Low Effort, High Impact)
- Consolidate DB layer: remove `lib/db-improved.ts` and keep a single, minimal API in `lib/db.ts` (save, get by size, list sizes, metadata, history, clear). Ensure `LSPPrice` is imported where used (e.g., migration script).
- LSPS1 path consistency: use `get_info` across the board; if a provider needs `info`, handle it via a tiny per-provider path map (no heavy adapter layer).
- Env detection consistency: rely on `Redis.fromEnv()` and one `isRedisConfigured()` helper so middleware/DB agree on configuration.
- Type safety toggle: set `typescript.ignoreBuildErrors` to `false` and fix trivial type errors (e.g., missing imports, JSON parse narrowings).
- Hide buttons when live: only show Force/Retry when the row has an error or non-live source.

### Extra Steps (Simple and Targeted)
- Add tiny shared Redis helper (keep it minimal):
  - File: `lib/redis-config.ts`
  - Exports:
    - `export const getRedis = () => Redis.fromEnv();`
    - `export const isRedisConfigured = () => { try { Redis.fromEnv(); return true; } catch { return false; } }`
  - Use in: `lib/db.ts`, `middleware.ts`, `pages/api/lsp-metadata.ts` (optional), to remove duplicate env checks.
  - After implementing, review and update these call sites to use the helper consistently:
    - `lib/db.ts` (replace local `Redis.fromEnv()` and `isRedisConfigured()`)
    - `middleware.ts` (stop checking UPSTASH_* directly; use `isRedisConfigured()` and `getRedis()`)
    - `pages/api/clear-cache.ts` (use `getRedis()`)
    - `pages/api/db-inspector.ts` (use `getRedis()`; keep `info()` guarded or removed)
    - `pages/api/lsp-metadata.ts` (if caching enabled, use `getRedis()`)
- Confirm rate-limit scope is correct: keep matcher at `/api/prices` only. If you later need to limit `/api/prices-ui`, add explicitly (don’t broaden by default).
- Document rate-limit behavior: note sliding window (60/min by IP) and why it protects free tier; add a short note in README under API Usage.

## Strict Typecheck Cleanup (TS strict + Next 15)
- API handler return types (Next validator):
  - Change handlers to `Promise<void>` and avoid returning the `res.json(...)` value. Just send the response, then `return;`.
  - Review especially: `pages/api/prices.ts`, and mirror the pattern across other routes.
- Debug cache endpoints accessing private state:
  - `pages/api/debug-cache.ts`, `pages/api/debug-cache-pretty.ts`, `pages/api/debug-simple.ts`
  - Don’t cast to access `PriceService.inMemoryCache` (it’s private). Add a public getter like `getInMemoryCacheSnapshot()` in `lib/price-service.ts` and use it instead.
  - Import `type { LSPPrice }` from `lib/lsp-api` where referenced.
- DB Inspector shape and Upstash specifics:
  - `pages/api/db-inspector.ts`: extend the value shape to allow `error?: string` in branches that catch errors.
  - Remove/guard `redis.info()` (Upstash client doesn’t expose `info()`). Return a note instead.
- LSP metadata timeout compatibility:
  - `pages/api/lsp-metadata.ts`: if `AbortSignal.timeout(...)` causes a TS lib mismatch, replace with manual `AbortController` + `setTimeout` polyfill pattern for compatibility.
- Migration script typings:
  - `pages/api/migrate-db.ts`: import `type { LSPPrice }` and cast parsed JSON to `LSPPrice[]`; avoid using `unknown` directly.
- Prices UI typings:
  - `pages/api/prices-ui.ts`: import `type { LSPPrice }` (used in helper signatures like `determineDataSource`).
- Rate limits pretty endpoint type drift:
  - `pages/api/rate-limits-pretty.ts`: include `timeSinceLastRequest: number` in the displayed type to match `getRateLimitStatus()`.

### Optional Tiny Improvements (Non-breaking)
- Normalize API handlers to `Promise<void>` pattern everywhere to satisfy Next validator.
- Add `getInMemoryCacheSnapshot()` to `PriceService` for debug endpoints (read-only copy), then remove all casts to private state.

## Nice-to-Have (Optional, Minimal)
- Cron cadence: if you need fresher data and rate limits allow, bump the cron to every 15–30 minutes; otherwise keep daily.
- Docs alignment: ensure README/AGENTS reflect the same status and data-source terminology.
- Restrict debug routes (optional): leave public API open, but consider limiting `/api/debug*` and `/api/db-*` in production.

That’s it—no schema versioning, no server-side fiat conversion, no admin UI, no App Router migration, no heavy observability, and no Docker multi-stage required right now. Keep it lean.
