import { NextApiRequest, NextApiResponse } from 'next';
import { Redis } from '@upstash/redis';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const redis = Redis.fromEnv();
    
    // Clear all cache keys
    const keys = [
      'alby:lsp:prices',
      'alby:lsp:last_update',
      'alby:lsp:price_history'
    ];
    
    // Delete all keys
    await Promise.all(keys.map(key => redis.del(key)));
    
    res.status(200).json({ 
      success: true, 
      message: 'Cache cleared successfully',
      clearedKeys: keys
    });
  } catch (error) {
    console.error('Clear cache error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to clear cache',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
