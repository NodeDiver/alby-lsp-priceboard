import type { NextApiRequest, NextApiResponse } from 'next';
import { getPriceHistory } from '../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const history = await getPriceHistory();
    
    res.status(200).json({
      success: true,
      count: history.length,
      history: history.slice(0, 10) // Show last 10 entries
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
