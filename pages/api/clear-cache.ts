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
    
    // Get all keys with our namespace
    const allKeys = await redis.keys('alby:lsp:*');
    
    if (allKeys.length === 0) {
      return res.status(200).json({ 
        success: true, 
        message: 'No cache keys found to clear',
        clearedKeys: []
      });
    }
    
    // Delete all keys
    await redis.del(...allKeys);
    
    res.status(200).json({ 
      success: true, 
      message: 'Cache cleared successfully',
      clearedKeys: allKeys
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
