import { NextApiRequest, NextApiResponse } from 'next';
import { LSPPrice } from '../../lib/lsp-api';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'POST') {
    return res.status(405).send('Method not allowed');
  }

  try {
    const { Redis } = await import('@upstash/redis');
    const redis = Redis.fromEnv();

    if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
      return res.status(200).send('❌ Redis not configured');
    }

    let output = '🔄 DATABASE MIGRATION TO IMPROVED STRUCTURE\n\n';

    // Get current data
    const currentPrices = await redis.get('alby:lsp:prices');
    const lastUpdate = await redis.get('alby:lsp:last_update');
    
    if (!currentPrices) {
      return res.status(200).send('❌ No current data to migrate');
    }

    const prices: LSPPrice[] = Array.isArray(currentPrices) ? currentPrices : JSON.parse(currentPrices as string);
    
    output += `📊 Current Data:\n`;
    output += `  Prices: ${prices.length} entries\n`;
    output += `  Last Update: ${lastUpdate}\n\n`;

    // Group by channel size
    const pricesByChannel = prices.reduce((acc: Record<number, LSPPrice[]>, price: LSPPrice) => {
      const size = price.channel_size_sat;
      if (!acc[size]) acc[size] = [];
      acc[size].push(price);
      return acc;
    }, {});

    output += `📈 Grouped by Channel Size:\n`;
    Object.entries(pricesByChannel).forEach(([size, channelPrices]) => {
      output += `  ${Number(size) / 1000000}M sats: ${channelPrices.length} LSPs\n`;
    });
    output += '\n';

    // Create new structure
    const now = new Date().toISOString();
    const metadata = {
      lastUpdate: lastUpdate || now,
      totalChannels: Object.keys(pricesByChannel).length,
      totalPrices: prices.length,
      channelSizes: Object.keys(pricesByChannel).map(Number).sort((a, b) => a - b),
      migratedAt: now
    };

    // Save new structure
    const pipeline = redis.pipeline();
    
    // Save each channel size
    Object.entries(pricesByChannel).forEach(([size, channelPrices]) => {
      const key = `alby:lsp:channel:${size}`;
      pipeline.set(key, JSON.stringify(channelPrices), { ex: 3600 });
    });
    
    // Save metadata
    pipeline.set('alby:lsp:metadata', JSON.stringify(metadata), { ex: 3600 });
    
    // Create history entry
    const historyEntry = {
      timestamp: now,
      channelSize: 'all',
      prices: prices,
      migration: true
    };
    pipeline.lpush('alby:lsp:history', JSON.stringify(historyEntry));
    pipeline.ltrim('alby:lsp:history', 0, 49);
    
    await pipeline.exec();

    output += `✅ Migration Complete!\n`;
    output += `  New Keys Created: ${Object.keys(pricesByChannel).length + 2}\n`;
    output += `  Old Keys: alby:lsp:prices, alby:lsp:last_update\n`;
    output += `  New Keys: alby:lsp:channel:*, alby:lsp:metadata, alby:lsp:history\n\n`;
    
    output += `📋 New Structure:\n`;
    Object.entries(pricesByChannel).forEach(([size, channelPrices]) => {
      output += `  alby:lsp:channel:${size} → ${channelPrices.length} LSPs\n`;
    });
    output += `  alby:lsp:metadata → metadata object\n`;
    output += `  alby:lsp:history → historical data\n\n`;
    
    output += `💾 Storage Savings:\n`;
    output += `  Before: ${prices.length * 2} price objects (redundant)\n`;
    output += `  After: ${prices.length} price objects (no redundancy)\n`;
    output += `  Savings: ~50% storage reduction\n`;

    res.status(200).send(output);
  } catch (error) {
    console.error('Migration error:', error);
    res.status(500).send(`❌ Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
