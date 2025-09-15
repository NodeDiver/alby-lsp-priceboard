import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'GET') {
    return res.status(405).send('Method not allowed');
  }

  try {
    const { Redis } = await import('@upstash/redis');
    const redis = Redis.fromEnv();

    // Check if Redis is configured
    if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
      return res.status(200).send('❌ Redis not configured\nMissing KV_REST_API_URL and KV_REST_API_TOKEN environment variables');
    }

    // Get all keys with our namespace
    const allKeys = await redis.keys('alby:lsp:*');
    
    let output = '🗄️  VERCEL KV (REDIS) DATABASE INSPECTOR\n\n';
    
    if (allKeys.length === 0) {
      output += '📭 Database is empty\n';
      output += 'No keys found with namespace "alby:lsp:*"\n';
      return res.status(200).send(output);
    }

    output += `📊 FOUND ${allKeys.length} KEYS:\n`;
    allKeys.forEach((key, index) => {
      output += `  ${index + 1}. ${key}\n`;
    });
    output += '\n';

    // Read and display each key
    for (const key of allKeys) {
      try {
        const value = await redis.get(key);
        const valueStr = JSON.stringify(value, null, 2);
        const size = valueStr.length;
        
        output += `🔑 KEY: ${key}\n`;
        output += `   Type: ${typeof value}\n`;
        output += `   Size: ${size} characters\n`;
        
        if (key === 'alby:lsp:last_update') {
          output += `   Value: ${value}\n`;
        } else if (key === 'alby:lsp:price_history') {
          const history = Array.isArray(value) ? value : [];
          output += `   Value: List with ${history.length} entries\n`;
          if (history.length > 0) {
            output += `   Latest Entry: ${JSON.stringify(history[0], null, 4)}\n`;
          }
        } else if (key === 'alby:lsp:prices') {
          const prices = Array.isArray(value) ? value : [];
          output += `   Value: Array with ${prices.length} price entries\n`;
          if (prices.length > 0) {
            output += `   Sample Entry: ${JSON.stringify(prices[0], null, 4)}\n`;
          }
        } else if (key.startsWith('alby:lsp:price:')) {
          const lspId = key.replace('alby:lsp:price:', '');
          output += `   LSP ID: ${lspId}\n`;
          output += `   Value: ${valueStr}\n`;
        } else {
          output += `   Value: ${valueStr}\n`;
        }
        output += '\n';
      } catch (error) {
        output += `🔑 KEY: ${key}\n`;
        output += `   ❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}\n\n`;
      }
    }

    // Summary
    output += `📈 SUMMARY:\n`;
    output += `Total Keys: ${allKeys.length}\n`;
    output += `Namespace: alby:lsp:*\n`;
    output += `Database Type: Redis (Key-Value)\n`;
    output += `Provider: Vercel KV (Upstash Redis)\n`;

    res.status(200).send(output);
  } catch (error) {
    console.error('DB Inspector Pretty error:', error);
    res.status(500).send(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
