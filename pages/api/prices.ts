import type { NextApiRequest, NextApiResponse } from 'next';
import { getLatestPrices, getLastUpdateTime } from '../../lib/db';
import { fetchAllLSPPrices } from '../../lib/lsp-api';

// Helper function to get data source description
function getDataSourceDescription(source: string): string {
  switch (source) {
    case 'live':
      return 'Live data from LSP APIs';
    case 'cached':
      return 'Cached data from previous successful fetch';
    case 'estimated':
      return 'Estimated pricing (LSP unavailable)';
    case 'mixed':
      return 'Mixed data (some live, some cached/estimated)';
    default:
      return 'Unknown data source';
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'Only GET requests are allowed for this endpoint'
    });
  }

  try {
    // Get channel size from query parameter, default to 1M sats
    const channelSize = req.query.channelSize ? Number(req.query.channelSize) : 1000000;
    
    // Always try to fetch fresh data from LSPs (with per-LSP fallback)
    console.log(`Fetching prices for channel size ${channelSize} sats`);
    const freshPrices = await fetchAllLSPPrices(channelSize);
    
    // Convert to display format with source tracking
    const prices = freshPrices.map(price => ({
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

    // Determine overall data source
    const sources = prices.map(p => p.source).filter(Boolean);
    const uniqueSources = [...new Set(sources)];
    let dataSource = 'unknown';
    
    if (uniqueSources.length === 1) {
      dataSource = uniqueSources[0];
    } else if (uniqueSources.length > 1) {
      dataSource = 'mixed';
    }

    const lastUpdate = new Date().toISOString();
    
    // Set CORS headers for cross-origin requests
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // Return prices in the format expected by external applications
    res.status(200).json({
      success: true,
      last_update: lastUpdate,
      total_lsps: prices.length,
      data_source: dataSource,
      data_source_description: getDataSourceDescription(dataSource),
      prices: prices.map(price => ({
        lsp_id: price.lsp_id,
        lsp_name: price.lsp_name,
        channel_size: price.channel_size,
        price: price.price,
        channel_fee_percent: price.channel_fee_percent,
        channel_fee_base_msat: price.channel_fee_base_msat,
        lease_fee_base_msat: price.lease_fee_base_msat,
        lease_fee_basis: price.lease_fee_basis,
        timestamp: price.timestamp,
        error: price.error || null,
        source: price.source || 'unknown',
        stale_seconds: price.stale_seconds || null,
        error_code: price.error_code || null
      }))
    });
    
  } catch (error) {
    console.error('API error:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to fetch prices',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
}
