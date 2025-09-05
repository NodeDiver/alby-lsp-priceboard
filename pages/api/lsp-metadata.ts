import type { NextApiRequest, NextApiResponse } from 'next';
import { getActiveLSPs } from '../../lib/lsps';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const activeLSPs = getActiveLSPs();
    
    // For now, return the LSPs with mock metadata since external fetching has CORS issues
    const lspMetadata = activeLSPs.map(lsp => ({
      ...lsp,
      metadata: {
        name: lsp.name,
        description: `${lsp.name} Lightning Service Provider`,
        icon: null, // Will fallback to initials - this is the correct behavior
        logo: null, // Will fallback to initials - this is the correct behavior
        website: lsp.url,
        min_channel_size: 100000, // 100k sats
        max_channel_size: 10000000, // 10M sats
      }
    }));

    res.status(200).json({
      success: true,
      lsps: lspMetadata
    });
  } catch (error) {
    console.error('Error fetching LSP metadata:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch LSP metadata' 
    });
  }
}
