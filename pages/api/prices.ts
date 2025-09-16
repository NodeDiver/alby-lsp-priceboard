import type { NextApiRequest, NextApiResponse } from 'next';
import { priceService } from '../../lib/price-service';

// TypeScript types for API response
type PriceApiResponse = {
  success: boolean;
  last_update: string;
  total_lsps: number;
  data_source: string;
  data_source_description: string;
  prices: Array<{
    lsp_id: string;
    lsp_name: string;
    channel_size: number;
    price: number;
    channel_fee_percent: number;
    channel_fee_base_msat: number;
    lease_fee_base_msat: number;
    lease_fee_basis: number;
    timestamp: string;
    error: string | null;
    source: string;
    stale_seconds: number | null;
    error_code: string | null;
  }>;
};

// Helper function to set CORS headers
function allowCORS(res: NextApiResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// Robust query parameter parsing
function parseChannelSize(q: unknown): number {
  const s = Array.isArray(q) ? q[0] : q;
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) return 1_000_000; // 1M default
  return Math.floor(n);
}

// Helper function to get data source description
function getDataSourceDescription(source: string): string {
  switch (source) {
    case 'live':
      return 'Live data from LSP APIs (includes fresh cached data < 1 hour old)';
    case 'cached':
      return 'Cached data from previous successful fetch (> 1 hour old)';
    case 'unavailable':
      return 'LSP unavailable';
    case 'mixed':
      return 'Mixed data (some live, some cached/unavailable)';
    default:
      return 'Unknown data source';
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<PriceApiResponse | { success: false; error: string; message: string; timestamp: string }>) {
  allowCORS(res);

  // Handle OPTIONS preflight request
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ 
      success: false,
      error: 'Method not allowed',
      message: 'Only GET requests are allowed for this endpoint',
      timestamp: new Date().toISOString()
    });
  }

  try {
    const channelSize = parseChannelSize(req.query.channelSize);
    const force = req.query.fresh === '1';
    const bypassRateLimit = req.query.force === '1';

    console.log(`Fetching prices for channel size ${channelSize} sats (force: ${force}, bypass rate limit: ${bypassRateLimit})`);

    // API endpoint is read-only - only serve cached data
    console.log(`API: Serving cached data only for channel size ${channelSize} sats`);
    const rows = await priceService.getCachedPricesOnly(channelSize);

    // Map to API response format
    const prices = rows.map(price => ({
      lsp_id: price.lsp_id,
      lsp_name: price.lsp_name,
      channel_size: price.channel_size_sat,
      price: price.total_fee_msat,
      channel_fee_percent: price.channel_fee_percent,
      channel_fee_base_msat: price.channel_fee_base_msat,
      lease_fee_base_msat: price.lease_fee_base_msat,
      lease_fee_basis: price.lease_fee_basis,
      timestamp: price.timestamp,
      error: price.error ?? null,
      source: price.source ?? 'unknown',
      stale_seconds: price.stale_seconds ?? null,
      error_code: price.error_code ?? null,
    }));

    // Determine overall data source with 1-hour rule
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000); // 1 hour ago
    
    // Check if cached data is fresh (less than 1 hour old)
    const adjustedSources = prices.map(p => {
      if (p.source === 'cached' && p.timestamp) {
        const priceTime = new Date(p.timestamp);
        if (priceTime > oneHourAgo) {
          return 'live'; // Treat fresh cached data as live
        }
      }
      return p.source;
    }).filter(Boolean);
    
    const sources = Array.from(new Set(adjustedSources));
    const dataSource = sources.length === 1 ? sources[0]! : (sources.length > 1 ? 'mixed' : 'unknown');

    // Calculate last update from actual data timestamps
    const lastUpdateMs = prices.reduce((acc, p) => Math.max(acc, Date.parse(p.timestamp)), 0);
    const lastUpdate = lastUpdateMs ? new Date(lastUpdateMs).toISOString() : new Date().toISOString();

    // Set data source header for caching layers
    res.setHeader('X-Data-Source', dataSource);
    
    // Return prices in the format expected by external applications
    return res.status(200).json({
      success: true,
      last_update: lastUpdate,
      total_lsps: prices.length,
      data_source: dataSource,
      data_source_description: getDataSourceDescription(dataSource),
      prices
    });
    
  } catch (error) {
    console.error('API error:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch prices',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
}
