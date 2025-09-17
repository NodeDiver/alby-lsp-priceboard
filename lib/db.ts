import { Redis } from '@upstash/redis';
import { LSPPrice } from './lsp-api';

// Initialize Redis client
const redis = Redis.fromEnv();

// Check if Redis is properly configured
const isRedisConfigured = () => {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
};

// IMPROVED DATABASE STRUCTURE - No redundancy
const METADATA_KEY = 'alby:lsp:metadata';
const HISTORY_KEY = 'alby:lsp:history';

// Per-channel-size prices (better organization)
const getChannelPricesKey = (channelSize: number) => `alby:lsp:channel:${channelSize}`;

// Save latest prices to database with improved structure
export async function savePricesToDB(prices: LSPPrice[]): Promise<boolean> {
  try {
    if (!isRedisConfigured()) {
      console.error('Upstash Redis not configured');
      return false;
    }

    const now = new Date().toISOString();
    // Remove unused variable
    
    // Group prices by channel size for better organization
    const pricesByChannel = prices.reduce((acc, price) => {
      const size = price.channel_size_sat;
      if (!acc[size]) acc[size] = [];
      acc[size].push(price);
      return acc;
    }, {} as Record<number, LSPPrice[]>);

    const pipeline = redis.pipeline();
    
    // Save each channel size separately
    Object.entries(pricesByChannel).forEach(([size, channelPrices]) => {
      const key = getChannelPricesKey(Number(size));
      pipeline.set(key, JSON.stringify(channelPrices), { ex: 3600 }); // 1 hour TTL
    });
    
    // Save metadata
    const metadata = {
      lastUpdate: now,
      totalChannels: Object.keys(pricesByChannel).length,
      totalPrices: prices.length,
      channelSizes: Object.keys(pricesByChannel).map(Number).sort((a, b) => a - b)
    };
    pipeline.set(METADATA_KEY, JSON.stringify(metadata), { ex: 3600 });
    
    // Add to history (keep last 50 entries per channel size)
    Object.entries(pricesByChannel).forEach(([size, channelPrices]) => {
      const historyEntry = {
        timestamp: now,
        channelSize: Number(size),
        prices: channelPrices
      };
      pipeline.lpush(HISTORY_KEY, JSON.stringify(historyEntry));
    });
    
    // Keep only last 50 entries total
    pipeline.ltrim(HISTORY_KEY, 0, 49);
    
    await pipeline.exec();
    return true;
  } catch (error) {
    console.error('Error saving prices to database:', error);
    return false;
  }
}

// Get latest prices from database for specific channel size
export async function getLatestPrices(channelSize: number = 1000000): Promise<LSPPrice[]> {
  try {
    if (!isRedisConfigured()) {
      console.error('Upstash Redis not configured');
      return [];
    }

    const key = getChannelPricesKey(channelSize);
    const data = await redis.get(key);
    
    if (!data) return [];
    
    // Handle different data types
    if (Array.isArray(data)) return data;
    if (typeof data === 'string') return JSON.parse(data);
    if (typeof data === 'object') return Array.isArray(data) ? data : [];
    
    return [];
  } catch (error) {
    console.error('Error getting latest prices from database:', error);
    return [];
  }
}

// Get all available channel sizes
export async function getAvailableChannelSizes(): Promise<number[]> {
  try {
    if (!isRedisConfigured()) {
      return [];
    }

    const keys = await redis.keys('alby:lsp:channel:*');
    return keys
      .map(key => key.replace('alby:lsp:channel:', ''))
      .map(Number)
      .sort((a, b) => a - b);
  } catch (error) {
    console.error('Error getting available channel sizes:', error);
    return [];
  }
}

// Get metadata (includes last update timestamp)
export async function getMetadata(): Promise<{lastUpdate: string, totalChannels: number, totalPrices: number, channelSizes: number[]} | null> {
  try {
    if (!isRedisConfigured()) {
      return null;
    }

    const data = await redis.get(METADATA_KEY);
    return data ? JSON.parse(data as string) : null;
  } catch (error) {
    console.error('Error getting metadata:', error);
    return null;
  }
}

// Get last update timestamp (for backward compatibility)
export async function getLastUpdateTime(): Promise<string | null> {
  try {
    const metadata = await getMetadata();
    return metadata?.lastUpdate || null;
  } catch (error) {
    console.error('Error getting last update time:', error);
    return null;
  }
}

// Get price history from LIST
export async function getPriceHistory(): Promise<Array<{timestamp: string, prices: LSPPrice[]}>> {
  try {
    if (!isRedisConfigured()) {
      return [];
    }

    // Get all entries from the LIST (most recent first)
    const historyEntries = await redis.lrange<string>(HISTORY_KEY, 0, -1);
    return historyEntries.map(entry => JSON.parse(entry));
  } catch (error) {
    console.error('Error getting price history:', error);
    return [];
  }
}

// Get prices for a specific LSP
export async function getLSPPrices(lspId: string): Promise<LSPPrice[]> {
  try {
    const history = await getPriceHistory();
    const lspPrices: LSPPrice[] = [];
    
    history.forEach(entry => {
      const lspPrice = entry.prices.find(price => price.lsp_id === lspId);
      if (lspPrice) {
        lspPrices.push(lspPrice);
      }
    });
    
    return lspPrices;
  } catch (error) {
    console.error(`Error getting prices for LSP ${lspId}:`, error);
    return [];
  }
}




// Get database status for debugging
export async function getDatabaseStatus(): Promise<{
  connected: boolean;
  keysCount: number;
  configured: boolean;
  error?: string;
}> {
  try {
    const configured = isRedisConfigured();
    if (!configured) {
      return {
        connected: false,
        keysCount: 0,
        configured: false,
        error: 'Redis not configured'
      };
    }

    // Test connection by getting all keys
    const keys = await redis.keys('alby:lsp:*');
    return {
      connected: true,
      keysCount: keys.length,
      configured: true
    };
  } catch (error) {
    return {
      connected: false,
      keysCount: 0,
      configured: isRedisConfigured(),
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Clear all relevant cache keys
export async function clearCache(): Promise<string[]> {
  try {
    if (!isRedisConfigured()) {
      console.error('Upstash Redis not configured');
      return [];
    }
    
    // Get all keys with our namespace
    const keys = await redis.keys('alby:lsp:*');
    if (keys.length > 0) {
      await redis.del(...keys);
    }
    return keys;
  } catch (error) {
    console.error('Error clearing cache:', error);
    return [];
  }
}

