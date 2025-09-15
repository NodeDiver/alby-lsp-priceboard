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
    const inMemoryCache = (priceService as any).inMemoryCache;
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
    const { getLatestPricesFromDB } = await import('../../lib/db');
    const redisPrices = await getLatestPricesFromDB();
    const redisEntries = redisPrices.reduce((acc, price) => {
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
    }, {} as Record<number, any[]>);

    // Pretty format for terminal
    const formatPrice = (price: any) => {
      const feeSats = Math.round(price.total_fee_msat / 1000);
      const status = price.error ? '❌' : price.source === 'live' ? '🟢' : '🟡';
      return `${status} ${price.lsp_name}: ${feeSats} sats (${price.source})`;
    };

    const formatChannel = (channelSize: number, prices: any[]) => {
      const sizeLabel = channelSize >= 1000000 ? `${channelSize/1000000}M` : `${channelSize/1000}K`;
      return `\n📊 Channel Size: ${sizeLabel} sats (${prices.length} LSPs)\n` +
             prices.map(formatPrice).join('\n');
    };

    const inMemoryOutput = cacheEntries.length > 0 
      ? `\n🧠 IN-MEMORY CACHE (Local Dev):\n` + 
        cacheEntries.map(entry => formatChannel(entry.channelSize, entry.prices)).join('\n')
      : `\n🧠 IN-MEMORY CACHE: Empty`;

    const redisOutput = Object.keys(redisEntries).length > 0
      ? `\n🗄️  REDIS CACHE (Production):\n` +
        Object.entries(redisEntries).map(([channelSize, prices]) => 
          formatChannel(parseInt(channelSize), prices)
        ).join('\n')
      : `\n🗄️  REDIS CACHE: Empty`;

    const summary = `\n📈 SUMMARY:
🧠 In-Memory: ${cacheEntries.reduce((sum, entry) => sum + entry.count, 0)} prices across ${cacheEntries.length} channel sizes
🗄️  Redis: ${Object.values(redisEntries).reduce((sum, prices) => sum + prices.length, 0)} prices across ${Object.keys(redisEntries).length} channel sizes`;

    const output = `🔍 CACHED DATA DEBUG REPORT
${inMemoryOutput}
${redisOutput}
${summary}
`;

    res.status(200).send(output);
  } catch (error) {
    console.error('Debug cache error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
}
