# Alby LSP Price Board — Project Summary and Roadmap

Last reviewed: 2025-09 (updated) • Repository snapshot analyzed locally

## What This Project Is
A real-time Lightning Service Provider (LSP) price comparison tool that fetches per-LSP channel-open pricing via LSPS1-compatible endpoints, stores snapshots in Vercel KV (Upstash Redis-compatible), and exposes:
- A public read-only API (`/api/prices`) for cached snapshots.
- A UI-focused API (`/api/prices-ui`) with smart caching and optional background refresh/fetch-bypass.
- A web UI (Next.js) to compare fees across supported LSPs and channel sizes.

Primary goals:
- Make LSP price discovery transparent before users pick a provider.
- Provide a stable, rate-limited public API with clear data-source signaling (live/cached/unavailable/mixed) and resilient caching.

## Current Capabilities (What’s Done)
- Next.js 15 + React 19 app with TypeScript and Tailwind.
- LSP catalog and LSPS1 integration utilities:
  - Autodiscovery candidates for LNServer Wave.
  - Strict request building for LSPS1 create-order; error taxonomy mapping.
- Price fetching service with background refresh and in-memory cache for local dev.
- Persistent Vercel KV storage (no TTL) with history preservation:
  - `alby:lsp:channel:{size}` for latest snapshot per size (overwritten on success, never by failures).
  - `alby:lsp:metadata` for summary info including last update.
  - `alby:lsp:history:*:{timestamp}` entries that archive previous snapshots before overwrite.
- Public API endpoints:
  - `GET /api/prices` — read-only, cached-only with CORS, rate-limited at the edge via middleware.
  - `GET /api/prices-ui` — smart cached response with options to refresh/bypass rate-limit per-LSP.
  - `GET /api/lsp-metadata` — fetches LSP metadata (including icons) with optional KV cache.
  - Debug/Inspector endpoints (`/api/debug*`, `/api/db-*`, `/api/rate-limits*`, cron job endpoint).
- Frontend components:
  - `PriceTable` with per-LSP status badges, retry and per-LSP force-fetch buttons, currency conversion using Alby Lightning Tools.
  - Channel size and currency selectors; non-blocking UI while refreshing.
- Deployment support:
  - Vercel config with daily cron for multi-size price fetch and function timeout.
  - Dockerfile + compose helper scripts.

Recent additions (from README and code):
- Historical data preservation before overwriting latest snapshots.
- Stronger error protection: failed fetches never overwrite good cached data.
- Dedicated public keys per LSP (e.g., Flashsats and Megalith) for correctness.
- “Fresh cache” rule: data < 1 hour old presents as live; otherwise cached.
- Per-LSP force fetch from the UI with bypass semantics in API.

Backend/frontend hardening:
- Frontend 20-second fetch timeouts to prevent a hanging UI (AbortController).
- Backend per-LSP timeout wrapper (~12s) and shorter LSPS1 request timeouts (5–8s) to avoid 504s.
- Raw LSP error snapshots stored on failures (`raw_lsp_error`) to aid debugging without blocking.

## Supported LSPs (Configured)
- Olympus
- LNServer Wave (autodiscovery candidates trialed)
- Megalith
- Flashsats

Note: Live data depends on LSP constraints (peering, whitelist, rate limits). Smart caching handles unavailability without blocking the UI.

## Architecture Overview
- Pages Router (Next.js `pages/`)
- Data flow:
  1. Fetch LSPS1 info/order per LSP (`lib/lsp-api.ts`).
  2. Aggregate to `LSPPrice` rows per channel size.
  3. Persist to KV (`lib/db.ts`) under per-size keys and append compact history.
  4. Serve via `/api/prices` or `/api/prices-ui` with clear source semantics.
  5. Frontend consumes `/api/prices-ui`, renders table, and optionally triggers per-LSP refresh/bypass.
- Caching strategy:
  - KV snapshots per channel size without TTL (persistent), with previous snapshots recorded under timestamped history keys.
  - In-memory cache for local development and as a soft fallback.
- Rate limiting:
  - Edge middleware on `/api/prices` using Upstash Ratelimit.
  - Per-LSP local cooldowns within `lib/lsp-api.ts` for live fetch attempts.

Provider notes:
- Megalith: uses a dedicated client pubkey and may require whitelisting; LSPS1 fields are handled as strings where applicable.

## Remaining Minor Items
- Migration script type imports:
  - `pages/api/migrate-db.ts` uses `LSPPrice` without importing the type (low priority - rarely used).
- API "estimated" data source:
  - Mentioned in UI copy but not implemented in backend response logic (removed from UI, low priority cleanup).


## Roadmap (Past and Future)

### Likely Past Milestones (Reconstructed)
1. MVP scaffold: Next.js pages, basic table, mock pricing.
2. Add LSP catalog + LSPS1 shape + initial fetch flows.
3. Add Vercel KV persistence and public API.
4. Add per-LSP error taxonomy and fallback logic.
5. Introduce smart caching, non-blocking UI, and metadata/icons.
6. Add rate limiting (edge middleware) and cron fetcher.
7. Add debug and inspector endpoints; background refresh and per-LSP force fetch.

### Proposed Future Milestones
1. Stabilization and Consistency ✅ **COMPLETED (September 2025)**
   - ✅ Removed duplicate `lib/db-improved.ts` and standardized single DB interface
   - ✅ Updated `/api/clear-cache` to clear new keyspace with wildcard deletion
   - ✅ Standardized LSPS1 paths - all modules use `/get_info`
   - ✅ Fixed LSP id mismatch in per-LSP cooldown map (`lnserver-wave` → `lnserver`)
   - ✅ Unified env detection with shared helper (`lib/redis-config.ts`)
   - 📝 TypeScript build setting documented (kept disabled for Next.js 15 compatibility)

2. Scheduling and Operations
   - Consider increasing cron frequency (e.g., every 15–30 minutes) if LSP rate limits allow; add jitter per size to distribute load.
   - Add observability: structured logs, basic metrics, and a health check for LSP reachability.

3. API and Data Quality
   - Define a stable API schema in `/api/prices` and publish a versioned contract.
   - Add integrity fields per entry (e.g., `observed_at`, provider endpoint used, raw blueprint of response for debugging).
   - Include currency conversion server-side option to reduce client network calls.

4. Testing and Reliability
   - Add unit tests for: LSPS1 response parsing, error mapping, DB serialization, and API handlers.
   - Add integration tests using mock LSP endpoints.
   - Add smoke checks for cron runs.

5. UX/DevEx
   - App Router migration (optional) or keep Pages Router and refine page-level data fetching.
   - Light admin view for recent history and LSP status.
   - Document provider-specific constraints (peering/whitelisting) in UI tooltips with links.

## Key Files and Endpoints (Quick Reference)
- Pricing engine: `lib/lsp-api.ts`, `lib/price-service.ts`
- Data access: `lib/db.ts` (standardize here; remove `lib/db-improved.ts`)
- Public API: `pages/api/prices.ts` (cached-only), `pages/api/prices-ui.ts` (smart)
- LSP metadata: `pages/api/lsp-metadata.ts`
- Cron: `pages/api/cron/fetch-prices.ts` + `vercel.json`
- UI: `pages/index.tsx`, `components/PriceTable.tsx`

## Recently Fixed Issues (September 2025)
- ✅ **Fixed**: Clear cache now handles new keyspace structure (`alby:lsp:channel:*`, `alby:lsp:metadata`, `alby:lsp:history:*`)
- ✅ **Fixed**: LSP cooldown key mismatch corrected (`lnserver-wave` → `lnserver`)
- ✅ **Fixed**: LSPS1 path consistency - all modules now use `/get_info`
- ✅ **Fixed**: Unified Redis env detection with shared helper (`lib/redis-config.ts`)
- ✅ **Fixed**: Removed duplicate database module (`lib/db-improved.ts`)
- ✅ **Documented**: TypeScript build setting kept disabled due to Next.js 15 API route compatibility

---
**Status**: Core stabilization and consistency improvements completed September 2025. System is production-ready with robust error handling, timeout protection, and unified architecture.
