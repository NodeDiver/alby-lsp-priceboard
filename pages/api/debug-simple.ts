import { NextApiRequest, NextApiResponse } from 'next';
import { PriceService } from '../../lib/price-service';
import { LSPPrice } from '../../lib/lsp-api';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'GET') {
    return res.status(405).send('Method not allowed');
  }

  try {
    const priceService = PriceService.getInstance();
    
    // Get in-memory cache
    const inMemoryCache = (priceService as { inMemoryCache: Map<number, LSPPrice[]> }).inMemoryCache;
    const cacheEntries = Array.from(inMemoryCache.entries());
    
    // Get Redis cache
    const { getLatestPrices } = await import('../../lib/db');
    const redisPrices = await getLatestPrices();
    
    let output = '🔍 SIMPLE CACHE DEBUG\n\n';
    
    // In-memory cache
    output += '🧠 LOCAL CACHE:\n';
    if (cacheEntries.length === 0) {
      output += '  Empty\n';
    } else {
      cacheEntries.forEach(([channelSize, prices]) => {
        const sizeLabel = channelSize >= 1000000 ? `${channelSize/1000000}M` : `${channelSize/1000}K`;
        output += `  📊 ${sizeLabel} sats: ${prices.length} LSPs\n`;
        prices.forEach(price => {
          const feeSats = Math.round(price.total_fee_msat / 1000);
          const status = price.error ? '❌' : price.source === 'live' ? '🟢' : '🟡';
          output += `    ${status} ${price.lsp_name}: ${feeSats} sats (${price.source})\n`;
        });
      });
    }
    
    // Redis cache
    output += '\n🗄️  PRODUCTION CACHE:\n';
    if (redisPrices.length === 0) {
      output += '  Empty\n';
    } else {
      const redisByChannel = redisPrices.reduce((acc: Record<number, LSPPrice[]>, price) => {
        const channelSize = price.channel_size_sat;
        if (!acc[channelSize]) acc[channelSize] = [];
        acc[channelSize].push(price);
        return acc;
      }, {});
      
      Object.entries(redisByChannel).forEach(([channelSize, prices]) => {
        const size = parseInt(channelSize);
        const sizeLabel = size >= 1000000 ? `${size/1000000}M` : `${size/1000}K`;
        output += `  📊 ${sizeLabel} sats: ${prices.length} LSPs\n`;
        prices.forEach(price => {
          const feeSats = Math.round(price.total_fee_msat / 1000);
          const status = price.error ? '❌' : price.source === 'live' ? '🟢' : '🟡';
          output += `    ${status} ${price.lsp_name}: ${feeSats} sats (${price.source})\n`;
        });
      });
    }
    
    output += `\n📈 SUMMARY:\n`;
    output += `🧠 Local: ${cacheEntries.reduce((sum, [,prices]) => sum + prices.length, 0)} prices\n`;
    output += `🗄️  Production: ${redisPrices.length} prices\n`;
    
    res.status(200).send(output);
  } catch (error) {
    console.error('Simple Debug API Error:', error);
    res.status(500).send(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
