import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Import the rate limiting data from lsp-api
    const { getRateLimitStatus } = await import('../../lib/lsp-api');
    
    const rateLimitStatus = getRateLimitStatus();
    
    res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      rateLimits: rateLimitStatus
    });
  } catch (error) {
    console.error('Rate limits API error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get rate limit status',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
