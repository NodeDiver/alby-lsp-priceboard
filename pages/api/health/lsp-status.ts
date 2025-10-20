import { NextApiRequest, NextApiResponse } from 'next';
import { simpleHealthMonitor } from '../../../lib/simple-health';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Perform REAL-TIME health check when this endpoint is called
    // This runs every time a user visits the site
    const healthStatuses = await simpleHealthMonitor.checkAllLSPs();

    res.status(200).json({
      success: true,
      data: healthStatuses,
      timestamp: new Date().toISOString(),
      message: 'Real-time LSPS1 API availability check - checks HTTP API endpoints, not Lightning nodes'
    });
  } catch (error) {
    console.error('Error fetching LSP health statuses:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch health statuses',
      timestamp: new Date().toISOString()
    });
  }
}
