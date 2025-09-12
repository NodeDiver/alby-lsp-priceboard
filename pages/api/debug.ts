import type { NextApiRequest, NextApiResponse } from 'next';
import { getDatabaseStatus } from '../../lib/db';

const STALE_MS = parseInt(process.env.PRICE_STALE_MS || '', 10) || (12 * 60 * 1000);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Prevent caching of diagnostics endpoint
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

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

    // Determine if database is properly configured (has env vars)
    const databaseConfigured = envStatus.UPSTASH_REDIS_REST_URL && envStatus.UPSTASH_REDIS_REST_TOKEN;

    // Determine appropriate status code
    let statusCode = 200;
    if (!databaseConfigured && !dbStatus.hasData) {
      statusCode = 503; // Service unavailable - no Redis and no data
    } else if (dbStatus.isStale) {
      statusCode = 206; // Partial content - stale but usable
    }

    res.status(statusCode).json({
      success: true,
      timestamp: now,
      system_status: {
        database_configured: databaseConfigured,
        database_has_data: dbStatus.hasData,
        database_stale: dbStatus.isStale,
        last_update: dbStatus.lastUpdate,
        price_count: dbStatus.priceCount,
        history_count: dbStatus.historyCount,
        environment: envStatus,
        stale_threshold_ms: STALE_MS
      },
      message: dbStatus.hasData 
        ? `System running with ${dbStatus.isStale ? 'stale' : 'fresh'} data (${dbStatus.priceCount} prices)`
        : 'No cached data; will fetch live from LSPs if possible',
      next_steps: databaseConfigured
        ? (dbStatus.isStale ? 'Trigger refresh or check LSP reachability' : 'All good')
        : 'Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN for caching/performance'
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
