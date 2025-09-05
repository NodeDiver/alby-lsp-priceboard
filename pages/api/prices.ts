import type { NextApiRequest, NextApiResponse } from 'next';
import { shouldUseMockData, getMockPricesForDisplay } from '../../lib/mock-data';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'Only GET requests are allowed for this endpoint'
    });
  }

  try {
    let prices, lastUpdate;
    
    // Get channel size from query parameter, default to 1M sats
    const channelSize = req.query.channelSize ? Number(req.query.channelSize) : 1000000;
    // Using mock data for development (Vercel KV not configured)
    const allPrices = getMockPricesForDisplay();
    
    // Filter prices for the requested channel size
    prices = allPrices.filter(price => price.channel_size === channelSize);
    lastUpdate = new Date().toISOString();
    
    // Set CORS headers for cross-origin requests
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // Return prices in the format expected by external applications
    res.status(200).json({
      success: true,
      last_update: lastUpdate,
      total_lsps: prices.length,
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
        error: price.error || null
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
