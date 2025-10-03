import { NextApiRequest, NextApiResponse } from 'next';
import { Redis } from '@upstash/redis';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Create Redis instance directly using environment variables
    const redis = Redis.fromEnv();
    
    if (!redis) {
      return res.status(500).json({ 
        error: 'Redis not available',
        message: 'Redis instance could not be created. Check environment variables.'
      });
    }

    const { action = 'list', key, pattern = 'alby:lsp:*' } = req.query;

    switch (action) {
      case 'list':
        // List all keys matching pattern
        const keys = await redis.keys(pattern as string);
        const keyData = await Promise.all(
          keys.slice(0, 50).map(async (k) => {
            try {
              const type = await redis.type(k);
              const ttl = await redis.ttl(k);
              let size = 'N/A';
              
              // Get size based on data type
              if (type === 'string') {
                size = await redis.strlen(k) || 'N/A';
              } else if (type === 'list') {
                size = await redis.llen(k) || 'N/A';
              } else if (type === 'set') {
                size = await redis.scard(k) || 'N/A';
              } else if (type === 'hash') {
                size = await redis.hlen(k) || 'N/A';
              }
              
              return {
                key: k,
                type,
                ttl: ttl > 0 ? ttl : 'No expiration',
                size
              };
            } catch {
              return {
                key: k,
                type: 'error',
                ttl: 'N/A',
                size: 'Error reading key'
              };
            }
          })
        );

        return res.status(200).json({
          success: true,
          action: 'list',
          pattern,
          totalKeys: keys.length,
          keys: keyData
        });

      case 'get':
        if (!key) {
          return res.status(400).json({ error: 'Key parameter required for get action' });
        }

        const data = await redis.get(key as string);
        const dataType = await redis.type(key as string);
        
        let parsedData;
        try {
          parsedData = typeof data === 'string' ? JSON.parse(data) : data;
        } catch {
          parsedData = data;
        }

        return res.status(200).json({
          success: true,
          action: 'get',
          key,
          type: dataType,
          data: parsedData,
          rawData: data
        });

      case 'search':
        const searchPattern = req.query.pattern || 'alby:lsp:*';
        const searchKeys = await redis.keys(searchPattern as string);
        
        const searchResults = await Promise.all(
          searchKeys.slice(0, 20).map(async (k) => {
            const data = await redis.get(k);
            const type = await redis.type(k);
            let parsedData;
            try {
              parsedData = typeof data === 'string' ? JSON.parse(data) : data;
            } catch {
              parsedData = data;
            }
            return {
              key: k,
              type,
              data: parsedData
            };
          })
        );

        return res.status(200).json({
          success: true,
          action: 'search',
          pattern: searchPattern,
          results: searchResults
        });

      default:
        return res.status(400).json({ 
          error: 'Invalid action',
          validActions: ['list', 'get', 'search']
        });
    }

  } catch (error) {
    console.error('Database viewer error:', error);
    return res.status(500).json({
      success: false,
      error: 'Database operation failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
