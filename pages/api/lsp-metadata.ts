import type { NextApiRequest, NextApiResponse } from 'next';
import { getActiveLSPs, type LSP } from '../../lib/lsps';
import { Redis } from '@upstash/redis';

// Optional: Upstash for caching (safe to omit if not configured)
const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  ? Redis.fromEnv()
  : null;

type LspErrorCode =
  | 'TIMEOUT'
  | 'BAD_STATUS'
  | 'INVALID_JSON'
  | 'SCHEMA_MISMATCH'
  | 'URL_INVALID'
  | 'UNKNOWN';

type LspMetaResponse = {
  id: string;
  name: string;
  url: string;
  pubkey: string;
  active: boolean;
  metadata: {
    name: string;
    description?: string;
    icon?: string | null;
    logo?: string | null;
    website?: string | null;
    min_channel_size?: number | null;
    max_channel_size?: number | null;
  };
  status: 'live' | 'cached' | 'fallback' | 'error';
  stale_seconds?: number;
  error_code?: LspErrorCode;
  error?: string;
};

const TTL_SECONDS = 24 * 60 * 60; // 24h

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Don't cache diagnostics-like endpoints
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

    const lsps = getActiveLSPs();
    const results = await Promise.all(lsps.map(fetchSingleLspMetaSafe));

    const ok = results.some(r => r.status !== 'error');
    res.status(ok ? 200 : 206).json({ success: ok, lsps: results });
  } catch (error) {
    console.error('Error fetching LSP metadata:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch LSP metadata' 
    });
  }
}

async function fetchSingleLspMetaSafe(lsp: LSP): Promise<LspMetaResponse> {
  // First, try live
  const live = await fetchLspMetaLive(lsp);
  if (live.ok) {
    // cache and return
    await saveCache(lsp.id, live.payload);
    return live.payload;
  }

  // Then, try cache
  const cached = await loadCache(lsp.id);
  if (cached) {
    const staleSeconds = Math.floor((Date.now() - new Date(extractTimestamp(cached)).getTime()) / 1000);
    return { ...cached, status: 'cached', stale_seconds: staleSeconds, error_code: live.code, error: live.msg };
  }

  // Finally, fallback (minimal, no mock numbers)
  return {
    id: lsp.id,
    name: lsp.name,
    url: lsp.url,
    pubkey: lsp.pubkey,
    active: lsp.active,
    metadata: {
      name: lsp.name,
      description: `${lsp.name} lightning Service Provider`,
      icon: null,
      logo: null,
      website: safeWebsiteFromBase(lsp.url),
      min_channel_size: null,
      max_channel_size: null,
    },
    status: 'fallback',
    error_code: live.code,
    error: live.msg,
  };
}

function extractTimestamp(): string {
  // If you add a timestamp in metadata later, return it here; for now use "now"
  return new Date().toISOString();
}

async function fetchLspMetaLive(lsp: LSP): Promise<{ ok: true; payload: LspMetaResponse } | { ok: false; code: LspErrorCode; msg: string }> {
  try {
    // Build `get_info` endpoint from the base in lsps.ts
    // If your base already ends with /api/v1, this becomes /api/v1/get_info (correct for many LSPs).
    const infoUrl = new URL('get_info', lsp.url).toString();

    const ctl = AbortSignal.timeout(10_000);
    const rsp = await fetch(infoUrl, { signal: ctl, headers: { Accept: 'application/json' }});
    if (!rsp.ok) return { ok: false, code: 'BAD_STATUS', msg: `${rsp.status} ${rsp.statusText}` };

    const data = await rsp.json().catch(() => null);
    if (!data || !Array.isArray(data.uris)) {
      return { ok: false, code: 'SCHEMA_MISMATCH', msg: 'Missing or invalid "uris" in get_info' };
    }

    // Normalize fields (strings → numbers)
    const minStr = data.min_channel_balance_sat ?? data.min_channel_size ?? null;
    const maxStr = data.max_channel_balance_sat ?? data.max_channel_size ?? null;
    const min = minStr != null ? parseInt(String(minStr), 10) : null;
    const max = maxStr != null ? parseInt(String(maxStr), 10) : null;

    const payload: LspMetaResponse = {
      id: lsp.id,
      name: lsp.name,
      url: lsp.url,
      pubkey: lsp.pubkey,
      active: lsp.active,
      metadata: {
        name: data.name ?? lsp.name,
        description: data.description ?? `${lsp.name} lightning Service Provider`,
        icon: data.icon ?? data.logo ?? null,
        logo: data.logo ?? data.icon ?? null,
        website: data.website ?? safeWebsiteFromBase(lsp.url),
        min_channel_size: Number.isFinite(min as number) ? (min as number) : null,
        max_channel_size: Number.isFinite(max as number) ? (max as number) : null,
      },
      status: 'live'
    };

    return { ok: true, payload };
  } catch (e: unknown) {
    if (e && typeof e === 'object' && 'name' in e && e.name === 'TimeoutError') {
      return { ok: false, code: 'TIMEOUT', msg: 'Request timed out' };
    }
    if (e instanceof TypeError) {
      return { ok: false, code: 'URL_INVALID', msg: 'Invalid URL or network error' };
    }
    return { ok: false, code: 'UNKNOWN', msg: 'Unknown error' };
  }
}

function safeWebsiteFromBase(base: string): string | null {
  try {
    const u = new URL(base);
    // strip path like /api/v1; return scheme + host
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}

async function saveCache(id: string, value: LspMetaResponse) {
  if (!redis) return;
  try {
    await redis.set(`alby:lsp:meta:${id}`, JSON.stringify(value), { ex: TTL_SECONDS });
  } catch { /* ignore cache errors */ }
}

async function loadCache(id: string): Promise<LspMetaResponse | null> {
  if (!redis) return null;
  try {
    const raw = await redis.get<string>(`alby:lsp:meta:${id}`);
    return raw ? (JSON.parse(raw) as LspMetaResponse) : null;
  } catch {
    return null;
  }
}
