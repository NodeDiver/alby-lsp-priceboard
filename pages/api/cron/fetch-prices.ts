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
    // Fetch prices for multiple channel sizes
    const channelSizes = [
      1000000, 2000000, 3000000, 4000000, 5000000, 
      6000000, 7000000, 8000000, 9000000, 10000000
    ]; // 1M, 2M, 3M, 4M, 5M, 6M, 7M, 8M, 9M, 10M
    const allPrices = [];
    
    for (const channelSize of channelSizes) {
      console.log(`Fetching prices for ${channelSize} sats...`);
      // Use the PriceService with fallback logic instead of direct fetchAndSavePrices
      const { PriceService } = await import('../../../lib/price-service');
      const priceService = PriceService.getInstance();
      const prices = await priceService.forceFetchPricesNew(channelSize, true);
      allPrices.push(...prices);
    }
    
    // Return success response
    res.status(200).json({
      success: true,
      message: 'Prices fetched and saved successfully for all channel sizes (1M-10M)',
      count: allPrices.length,
      channelSizes,
      timestamp: new Date().toISOString(),
      prices: allPrices.map(price => ({
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
