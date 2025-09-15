import { NextApiRequest, NextApiResponse } from 'next';
import { PriceService } from '../../lib/price-service';

// CORS headers
function allowCORS(res: NextApiResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// Parse channel size from query parameter
function parseChannelSize(channelSize: string | string[] | undefined): number {
  if (typeof channelSize === 'string') {
    const parsed = parseInt(channelSize, 10);
    return isNaN(parsed) ? 1000000 : Math.max(100000, Math.min(10000000, parsed));
  }
  return 1000000;
}

// Helper function to get data source description
function getDataSourceDescription(source: string): string {
  switch (source) {
    case 'live':
      return 'Live data from LSP APIs';
    case 'cached':
      return 'Cached data from previous successful fetch';
    case 'unavailable':
      return 'LSP unavailable';
    case 'mixed':
      return 'Mixed data (some live, some cached/unavailable)';
    default:
      return 'Unknown data source';
  }
}

// Helper function to determine overall data source
function determineDataSource(prices: any[]): string {
  const sources = prices.map(p => p.source).filter(Boolean);
  const uniqueSources = [...new Set(sources)];
  
  if (uniqueSources.length === 0) return 'unknown';
  if (uniqueSources.length === 1) return uniqueSources[0];
  return 'mixed';
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  allowCORS(res);

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

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

    console.log(`UI: Fetching prices for channel size ${channelSize} sats (force: ${force}, bypass rate limit: ${bypassRateLimit})`);

    const priceService = PriceService.getInstance();
    let rows;
    
    if (bypassRateLimit) {
      // Force fetch with rate limiting bypassed
      rows = await priceService.forceFetchPricesNew(channelSize, true);
    } else if (force) {
      // Refresh prices - try live first, fallback to cached
      rows = await priceService.refreshPrices(channelSize);
    } else {
      // Smart caching - show cached first, fetch live in background
      rows = await priceService.getSmartPrices(channelSize);
    }

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
      error: price.error || null,
      source: price.source || 'unknown',
      stale_seconds: price.stale_seconds || null,
      error_code: price.error_code || null
    }));

    const dataSource = determineDataSource(prices);
    const dataSourceDescription = getDataSourceDescription(dataSource);

    // Set cache headers
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');

    res.status(200).json({
      success: true,
      prices,
      last_update: prices.length > 0 ? prices[0].timestamp : new Date().toISOString(),
      data_source: dataSource,
      data_source_description: dataSourceDescription,
      channel_size: channelSize,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in prices UI API:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to fetch prices',
      timestamp: new Date().toISOString()
    });
  }
}
