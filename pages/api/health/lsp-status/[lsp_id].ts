import { NextApiRequest, NextApiResponse } from 'next';
import { simpleHealthMonitor } from '../../../../lib/simple-health';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { lsp_id } = req.query;

  if (!lsp_id || typeof lsp_id !== 'string') {
    return res.status(400).json({ error: 'LSP ID is required' });
  }

  try {
    const healthStatus = await simpleHealthMonitor.getHealthStatus(lsp_id);
    
    if (!healthStatus) {
      return res.status(404).json({
        success: false,
        error: 'Health status not found for this LSP',
        lsp_id
      });
    }

    res.status(200).json({
      success: true,
      data: healthStatus,
      timestamp: new Date().toISOString(),
      message: 'Health status checked every 30 minutes'
    });
  } catch (error) {
    console.error(`Error fetching health status for ${lsp_id}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch health status',
      lsp_id,
      timestamp: new Date().toISOString()
    });
  }
}
