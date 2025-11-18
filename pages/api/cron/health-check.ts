import { NextApiRequest, NextApiResponse } from 'next';
import { simpleHealthMonitor } from '../../../lib/simple-health';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Accept both GET and POST requests (Vercel Cron can use either)
  const isVercelCron = req.headers['x-vercel-cron'] || req.headers['user-agent']?.includes('vercel-cron');

  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Log the request method for debugging
  console.log(`Health check cron request: method=${req.method}, isVercelCron=${isVercelCron}`);

  try {
    console.log('Starting scheduled health check for all LSPs...');

    // Check health status of all LSPs
    const healthStatuses = await simpleHealthMonitor.checkAllLSPs();

    // Save health statuses to Redis cache for use by price fetch cron
    const { saveHealthStatuses } = await import('../../../lib/db');
    const saved = await saveHealthStatuses(healthStatuses);

    const summary = {
      total_checked: healthStatuses.length,
      online: healthStatuses.filter(s => s.is_online).length,
      offline: healthStatuses.filter(s => !s.is_online).length,
      saved_to_cache: saved
    };

    console.log('Health check completed:', summary);

    res.status(200).json({
      success: true,
      message: 'Health check completed and saved to cache',
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
