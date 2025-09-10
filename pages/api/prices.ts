import type { NextApiRequest, NextApiResponse } from 'next';
import { shouldUseMockData, getMockPricesForDisplay } from '../../lib/mock-data';
import { getLatestPrices, getLastUpdateTime } from '../../lib/db';

// Helper function to get data source description
function getDataSourceDescription(source: string): string {
  switch (source) {
    case 'real':
      return 'Real-time data from LSP APIs';
    case 'real_fresh':
      return 'Fresh real-time data from LSP APIs';
    case 'mock':
      return 'Mock data for development/testing';
    case 'mock_fallback':
      return 'Mixed data (real + estimated pricing)';
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
    let prices, lastUpdate, dataSource;
    
    // Get channel size from query parameter, default to 1M sats
    const channelSize = req.query.channelSize ? Number(req.query.channelSize) : 1000000;
    
    // Try to get real data first, then fallback to mock data
    let allPrices = [];
    
    if (!shouldUseMockData()) {
      // Try to get real data from database
      allPrices = await getLatestPrices();
    }
    
    if (allPrices.length > 0) {
      // Convert real data to display format
      prices = allPrices
        .filter(price => price.channel_size_sat === channelSize)
        .map(price => ({
          lsp_id: price.lsp_id,
          lsp_name: price.lsp_name,
          channel_size: price.channel_size_sat,
          price: price.total_fee_msat,
          channel_fee_percent: price.channel_fee_percent,
          channel_fee_base_msat: price.channel_fee_base_msat,
          lease_fee_base_msat: price.lease_fee_base_msat,
          lease_fee_basis: price.lease_fee_basis,
          timestamp: price.timestamp,
          error: price.error || null
        }));
      lastUpdate = await getLastUpdateTime() || new Date().toISOString();
      dataSource = 'real';
    } else {
      // Try to fetch fresh data from LSPs
      try {
        const { fetchAllLSPPrices } = await import('../../lib/lsp-api');
        const freshPrices = await fetchAllLSPPrices(channelSize);
        
        if (freshPrices.length > 0 && freshPrices.some(p => p.total_fee_msat > 0)) {
          // Use fresh real data
          prices = freshPrices
            .filter(price => price.channel_size_sat === channelSize)
            .map(price => ({
              lsp_id: price.lsp_id,
              lsp_name: price.lsp_name,
              channel_size: price.channel_size_sat,
              price: price.total_fee_msat,
              channel_fee_percent: price.channel_fee_percent,
              channel_fee_base_msat: price.channel_fee_base_msat,
              lease_fee_base_msat: price.lease_fee_base_msat,
              lease_fee_basis: price.lease_fee_basis,
              timestamp: price.timestamp,
              error: price.error || null
            }));
          lastUpdate = new Date().toISOString();
          dataSource = 'real_fresh';
        } else {
          // Fallback to mock data
          const allPrices = getMockPricesForDisplay();
          prices = allPrices.filter(price => price.channel_size === channelSize);
          lastUpdate = new Date().toISOString();
          dataSource = 'mock_fallback';
        }
      } catch (error) {
        console.error('Error fetching fresh prices:', error);
        // Fallback to mock data
        const allPrices = getMockPricesForDisplay();
        prices = allPrices.filter(price => price.channel_size === channelSize);
        lastUpdate = new Date().toISOString();
        dataSource = 'mock_fallback';
      }
    }
    
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
