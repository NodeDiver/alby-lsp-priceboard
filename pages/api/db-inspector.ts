import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { Redis } = await import('@upstash/redis');
    const redis = Redis.fromEnv();

    // Check if Redis is configured
    if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
      return res.status(200).json({
        success: false,
        error: 'Redis not configured',
        message: 'KV_REST_API_URL and KV_REST_API_TOKEN environment variables not set'
      });
    }

    // Get all keys with our namespace
    const allKeys = await redis.keys('alby:lsp:*');
    
    const dbData: Record<string, { type: string; size: number | null; value: unknown }> = {};
    
    // Read each key
    for (const key of allKeys) {
      try {
        const value = await redis.get(key);
        dbData[key] = {
          type: typeof value,
          value: value,
          size: JSON.stringify(value).length
        };
      } catch (error) {
        dbData[key] = {
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }

    // Get additional Redis info (skip if not available)
    let redisInfo = null;
    try {
      redisInfo = await redis.info();
    } catch {
      // info() might not be available in all Redis configurations
      redisInfo = { note: 'info() not available' };
    }
    
    res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      redisInfo: {
        connected: true,
        keysFound: allKeys.length,
        keys: allKeys,
        info: redisInfo
      },
      data: dbData,
      summary: {
        totalKeys: allKeys.length,
        totalSize: Object.values(dbData).reduce((sum: number, item) => 
          sum + (item.size || 0), 0
        )
      }
    });
  } catch (error) {
    console.error('DB Inspector error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to inspect database',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
