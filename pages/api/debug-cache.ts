import { NextApiRequest, NextApiResponse } from 'next';
import { PriceService } from '../../lib/price-service';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const priceService = PriceService.getInstance();
    
    // Get in-memory cache (local development)
    const inMemoryCache = (priceService as { inMemoryCache: Map<number, LSPPrice[]> }).inMemoryCache;
    const cacheEntries = Array.from(inMemoryCache.entries()).map(([channelSize, prices]) => ({
      channelSize,
      count: prices.length,
      prices: prices.map(p => ({
        lsp_id: p.lsp_id,
        lsp_name: p.lsp_name,
        total_fee_msat: p.total_fee_msat,
        source: p.source,
        timestamp: p.timestamp,
        error: p.error
      }))
    }));

    // Get Redis cache (production)
    const { getLatestPrices } = await import('../../lib/db');
    const redisPrices = await getLatestPrices();
    const redisEntries = redisPrices.reduce((acc: Record<number, LSPPrice[]>, price) => {
      const channelSize = price.channel_size_sat;
      if (!acc[channelSize]) acc[channelSize] = [];
      acc[channelSize].push({
        lsp_id: price.lsp_id,
        lsp_name: price.lsp_name,
        total_fee_msat: price.total_fee_msat,
        source: price.source,
        timestamp: price.timestamp,
        error: price.error
      });
      return acc;
    }, {} as Record<number, LSPPrice[]>);

    res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      inMemoryCache: {
        entries: cacheEntries,
        totalChannels: cacheEntries.length,
        totalPrices: cacheEntries.reduce((sum, entry) => sum + entry.count, 0)
      },
      redisCache: {
        entries: Object.entries(redisEntries).map(([channelSize, prices]) => ({
          channelSize: parseInt(channelSize),
          count: prices.length,
          prices
        })),
        totalChannels: Object.keys(redisEntries).length,
        totalPrices: Object.values(redisEntries).reduce((sum, prices) => sum + prices.length, 0)
      }
    });
  } catch (error) {
    console.error('Debug cache error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
}
