import type { NextApiRequest, NextApiResponse } from 'next';
import { fetchAndSavePrices } from '../../../lib/price-service';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow POST requests (Vercel Cron Jobs use POST)
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'Only POST requests are allowed for this endpoint'
    });
  }

  try {
    // Fetch prices from all LSPs and save to database
    const prices = await fetchAndSavePrices();
    
    // Return success response
    res.status(200).json({
      success: true,
      message: 'Prices fetched and saved successfully',
      count: prices.length,
      timestamp: new Date().toISOString(),
      prices: prices.map(price => ({
        lsp_id: price.lsp_id,
        lsp_name: price.lsp_name,
        channel_size_sat: price.channel_size_sat,
        total_fee_msat: price.total_fee_msat,
        timestamp: price.timestamp
      }))
    });
    
  } catch (error) {
    console.error('Cron job error:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to fetch prices',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
}
