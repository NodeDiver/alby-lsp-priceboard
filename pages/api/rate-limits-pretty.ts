import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'GET') {
    return res.status(405).send('Method not allowed');
  }

  try {
    // Import the rate limiting data from lsp-api
    const { getRateLimitStatus } = await import('../../lib/lsp-api');
    
    const rateLimitStatus = getRateLimitStatus();
    
    let output = '🕐 RATE LIMITING STATUS\n\n';
    
    if (Object.keys(rateLimitStatus).length === 0) {
      output += 'No LSPs have been accessed yet.\n';
      output += 'Rate limits are created when LSPs are first requested.\n\n';
      output += '📋 CONFIGURED COOLDOWNS:\n';
      output += '  🔴 Flashsats: 3 hours (very rate limited)\n';
      output += '  🟡 Megalith: 1 hour (whitelist required)\n';
      output += '  🟢 Olympus: 10 minutes\n';
      output += '  🟢 LNServer Wave: 10 minutes\n';
      output += '  ⚪ Others: 10 minutes (default)\n';
    } else {
      Object.entries(rateLimitStatus).forEach(([lspId, status]) => {
        const statusEmoji = status.isRateLimited ? '🔴' : '🟢';
        const statusText = status.isRateLimited ? 'RATE LIMITED' : 'AVAILABLE';
        
        output += `${statusEmoji} ${lspId.toUpperCase()}: ${statusText}\n`;
        output += `   Last Request: ${status.lastRequest}\n`;
        output += `   Cooldown: ${status.cooldownMinutes} minutes\n`;
        
        if (status.isRateLimited) {
          output += `   Remaining: ${status.remainingMinutes} minutes\n`;
          output += `   Time Since Last: ${Math.round(status.timeSinceLastRequest / 1000)}s ago\n`;
        }
        output += '\n';
      });
    }
    
    output += `📊 SUMMARY:\n`;
    output += `Total LSPs: ${Object.keys(rateLimitStatus).length}\n`;
    output += `Rate Limited: ${Object.values(rateLimitStatus).filter((s: any) => s.isRateLimited).length}\n`;
    output += `Available: ${Object.values(rateLimitStatus).filter((s: any) => !s.isRateLimited).length}\n`;
    
    res.status(200).send(output);
  } catch (error) {
    console.error('Rate limits pretty API error:', error);
    res.status(500).send(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
