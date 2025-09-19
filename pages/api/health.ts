import { NextApiRequest, NextApiResponse } from 'next';
import { getDatabaseStatus, getAvailableChannelSizes } from '../../lib/db';

type HealthResponse = {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  database: {
    connected: boolean;
    last_update?: string;
    price_count?: number;
    channel_sizes?: number[];
  };
  uptime: number;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse<HealthResponse>) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      database: { connected: false },
      uptime: process.uptime()
    });
  }

  try {
    const startTime = process.hrtime();
    
    // Check database status
    const dbStatus = await getDatabaseStatus();
    const channelSizes = await getAvailableChannelSizes();
    
    const endTime = process.hrtime(startTime);
    const responseTimeMs = endTime[0] * 1000 + endTime[1] / 1000000;
    
    // Determine health status
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (!dbStatus.connected) {
      status = 'unhealthy';
    } else if (dbStatus.priceCount === 0) {
      status = 'degraded';
    } else if (responseTimeMs > 1000) {
      status = 'degraded';
    }

    const response: HealthResponse = {
      status,
      timestamp: new Date().toISOString(),
      database: {
        connected: dbStatus.connected,
        last_update: dbStatus.lastUpdate,
        price_count: dbStatus.priceCount,
        channel_sizes: channelSizes
      },
      uptime: process.uptime()
    };

    // Set appropriate HTTP status code
    const httpStatus = status === 'healthy' ? 200 : status === 'degraded' ? 200 : 503;
    
    return res.status(httpStatus).json(response);
    
  } catch (error) {
    console.error('Health check error:', error);
    
    return res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      database: { connected: false },
      uptime: process.uptime()
    });
  }
}
