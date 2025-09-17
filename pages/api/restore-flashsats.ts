import type { NextApiRequest, NextApiResponse } from 'next';
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get the good Flashsats data from history
    const historyData = await redis.get('alby:lsp:history:1000000:2025-09-17T19:26:19.107Z');
    if (!historyData) {
      return res.status(404).json({ error: 'No historical data found' });
    }

    const parsedHistory = JSON.parse(historyData as string);
    const goodFlashsatsData = parsedHistory.prices.find((p: any) => 
      p.lsp_id === 'flashsats' && 
      !p.error && 
      p.total_fee_msat > 0
    );

    if (!goodFlashsatsData) {
      return res.status(404).json({ error: 'No good Flashsats data in history' });
    }

    // Get current 1M data
    const currentData = await redis.get('alby:lsp:channel:1000000');
    if (!currentData) {
      return res.status(404).json({ error: 'No current 1M data found' });
    }

    const currentPrices = JSON.parse(currentData as string);
    
    // Replace the corrupted Flashsats data with the good historical data
    const updatedPrices = currentPrices.map((p: any) => 
      p.lsp_id === 'flashsats' ? { ...goodFlashsatsData, source: 'cached' } : p
    );

    // Save the corrected data
    await redis.set('alby:lsp:channel:1000000', JSON.stringify(updatedPrices));

    res.status(200).json({
      success: true,
      message: 'Restored good Flashsats data from history',
      restoredData: goodFlashsatsData
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
