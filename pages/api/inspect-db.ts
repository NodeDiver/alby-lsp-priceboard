import type { NextApiRequest, NextApiResponse } from 'next';
import { getRedisInstance } from '../../lib/redis-config';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const redis = getRedisInstance();
    if (!redis) {
      return res.status(500).json({ error: 'Redis not configured' });
    }

    // Get all keys matching our pattern
    const keys = await redis.keys('alby:lsp:*');
    
    const data: Record<string, any> = {};
    
    // Fetch data for each key
    for (const key of keys) {
      try {
        const value = await redis.get(key);
        data[key] = value;
      } catch (error) {
        data[key] = { error: `Failed to fetch: ${error}` };
      }
    }

    res.status(200).json({
      success: true,
      total_keys: keys.length,
      keys: keys,
      data: data,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Database inspection error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to inspect database',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
