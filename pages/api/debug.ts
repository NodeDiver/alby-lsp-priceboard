import type { NextApiRequest, NextApiResponse } from 'next';
import { shouldUseMockData } from '../../lib/mock-data';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get system status
    const usingMockData = shouldUseMockData();
    
    // Check environment variables
    const envStatus = {
      KV_URL: !!process.env.KV_URL,
      KV_REST_API_URL: !!process.env.KV_REST_API_URL,
      KV_REST_API_TOKEN: !!process.env.KV_REST_API_TOKEN,
      KV_REST_API_READ_ONLY_TOKEN: !!process.env.KV_REST_API_READ_ONLY_TOKEN,
    };

    // Get current timestamp
    const now = new Date().toISOString();

    res.status(200).json({
      success: true,
      timestamp: now,
      system_status: {
        kv_configured: false,
        using_mock_data: usingMockData,
        environment: envStatus,
        node_env: process.env.NODE_ENV || 'development',
      },
      message: 'System running with mock data (Vercel KV not configured)',
      next_steps: 'Configure Vercel KV environment variables to use real database'
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
