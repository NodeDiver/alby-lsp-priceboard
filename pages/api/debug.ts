import type { NextApiRequest, NextApiResponse } from 'next';
import { getDatabaseStatus } from '../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get database status
    const dbStatus = await getDatabaseStatus();
    
    // Check environment variables
    const envStatus = {
      UPSTASH_REDIS_REST_URL: !!process.env.UPSTASH_REDIS_REST_URL,
      UPSTASH_REDIS_REST_TOKEN: !!process.env.UPSTASH_REDIS_REST_TOKEN,
      NODE_ENV: process.env.NODE_ENV || 'development',
    };

    // Get current timestamp
    const now = new Date().toISOString();

    res.status(200).json({
      success: true,
      timestamp: now,
      system_status: {
        database_configured: dbStatus.hasData,
        database_stale: dbStatus.isStale,
        last_update: dbStatus.lastUpdate,
        price_count: dbStatus.priceCount,
        history_count: dbStatus.historyCount,
        environment: envStatus,
      },
      message: dbStatus.hasData 
        ? `System running with ${dbStatus.isStale ? 'stale' : 'fresh'} data (${dbStatus.priceCount} prices)`
        : 'System running without cached data - will fetch live from LSPs',
      next_steps: dbStatus.hasData 
        ? 'System is operational with per-LSP fallback caching'
        : 'Configure Vercel KV environment variables for better performance'
    });

  } catch (error) {
    console.error('Debug endpoint error:', error);
    
    res.status(500).json({
      success: false,
      error: 'Debug endpoint failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
}
