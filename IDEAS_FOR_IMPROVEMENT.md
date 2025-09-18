# Ideas for Improvement — Pragmatic Shortlist

Focus on essentials that add value without adding complexity.

## Core Fixes (Low Effort, High Impact)
- Clear cache correctly: update `/api/clear-cache` to delete the new keyspace (`alby:lsp:channel:*`, `alby:lsp:metadata`, `alby:lsp:history:*`).
- Consolidate DB layer: remove `lib/db-improved.ts` and keep a single, minimal API in `lib/db.ts` (save, get by size, list sizes, metadata, history, clear). Ensure `LSPPrice` is imported where used (e.g., migration script).
- LSPS1 path consistency: use `get_info` across the board; if a provider needs `info`, handle it via a tiny per-provider path map (no heavy adapter layer).
- Rate-limit ID consistency: change `'lnserver-wave'` to `'lnserver'` in `lib/lsp-api.ts` cooldown map.
- Env detection consistency: rely on `Redis.fromEnv()` and one `isRedisConfigured()` helper so middleware/DB agree on configuration.
- Type safety toggle: set `typescript.ignoreBuildErrors` to `false` and fix trivial type errors (e.g., missing imports, JSON parse narrowings).

## Nice-to-Have (Optional, Minimal)
- Cron cadence: if you need fresher data and rate limits allow, bump the cron to every 15–30 minutes; otherwise keep daily.
- Docs alignment: ensure README/AGENTS reflect the same status and data-source terminology.
- Restrict debug routes (optional): leave public API open, but consider limiting `/api/debug*` and `/api/db-*` in production.

That’s it—no schema versioning, no server-side fiat conversion, no admin UI, no App Router migration, no heavy observability, and no Docker multi-stage required right now. Keep it lean.

