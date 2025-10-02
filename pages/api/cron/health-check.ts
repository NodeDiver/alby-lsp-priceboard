import { NextApiRequest, NextApiResponse } from 'next';
import { simpleHealthMonitor } from '../../../lib/simple-health';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow POST requests (for cron jobs)
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify this is a cron job request (optional security check)
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    console.log('Starting scheduled health check for all LSPs...');
    
    const healthStatuses = await simpleHealthMonitor.checkAllLSPs();
    
    const summary = {
      total_checked: healthStatuses.length,
      online: healthStatuses.filter(s => s.is_online).length,
      offline: healthStatuses.filter(s => !s.is_online).length
    };
    
    console.log('Health check completed:', summary);
    
    res.status(200).json({
      success: true,
      message: 'Health check completed successfully',
      summary,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error during scheduled health check:', error);
    res.status(500).json({
      success: false,
      error: 'Health check failed',
      timestamp: new Date().toISOString()
    });
  }
}
