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
      pipeline.set(key, JSON.stringify(channelPrices)); // No TTL - store forever
    });
    
    // Save metadata
    const metadata = {
      lastUpdate: now,
      totalChannels: Object.keys(pricesByChannel).length,
      totalPrices: prices.length,
      channelSizes: Object.keys(pricesByChannel).map(Number).sort((a, b) => a - b)
    };
    pipeline.set(METADATA_KEY, JSON.stringify(metadata)); // No TTL - store forever
    
    // Add to history using timestamp-based keys for better organization
    Object.entries(pricesByChannel).forEach(([size, channelPrices]) => {
      const historyKey = `alby:lsp:history:${size}:${now}`;
      const historyEntry = {
        timestamp: now,
        channelSize: Number(size),
        prices: channelPrices
      };
      pipeline.set(historyKey, JSON.stringify(historyEntry));
    });
    
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

// Get price history from timestamp-based keys
export async function getPriceHistory(limit: number = 50): Promise<Array<{timestamp: string, channelSize: number, prices: LSPPrice[]}>> {
  try {
    if (!isRedisConfigured()) {
      return [];
    }

    // Get all history keys and sort by timestamp (most recent first)
    const allKeys = await redis.keys('alby:lsp:history:*');
    const historyKeys = allKeys.filter(key => key.startsWith('alby:lsp:history:') && key !== 'alby:lsp:history');
    
    // Sort by timestamp (extract from key)
    historyKeys.sort((a, b) => {
      const timestampA = a.split(':').slice(4).join(':'); // Get timestamp part
      const timestampB = b.split(':').slice(4).join(':');
      return timestampB.localeCompare(timestampA); // Descending (newest first)
    });
    
    // Get the data for the most recent entries
    const limitedKeys = historyKeys.slice(0, limit);
    const historyData = await Promise.all(
      limitedKeys.map(async (key) => {
        const data = await redis.get(key);
        return data ? JSON.parse(data as string) : null;
      })
    );
    
    return historyData.filter(entry => entry !== null);
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
  hasData: boolean;
  isStale: boolean;
  lastUpdate?: string;
  priceCount: number;
  historyCount: number;
  error?: string;
}> {
  try {
    const configured = isRedisConfigured();
    if (!configured) {
      return {
        connected: false,
        keysCount: 0,
        configured: false,
        hasData: false,
        isStale: false,
        priceCount: 0,
        historyCount: 0,
        error: 'Redis not configured'
      };
    }

    // Test connection by getting all keys
    const keys = await redis.keys('alby:lsp:*');
    
    // Check if we have price data
    const priceKeys = keys.filter(key => key.startsWith('alby:lsp:channel:'));
    const hasData = priceKeys.length > 0;
    
    // Get metadata for staleness check
    const metadata = await getMetadata();
    const lastUpdate = metadata?.lastUpdate;
    const isStale = lastUpdate ? (Date.now() - Date.parse(lastUpdate)) > (12 * 60 * 1000) : true;
    
    return {
      connected: true,
      keysCount: keys.length,
      configured: true,
      hasData,
      isStale,
      lastUpdate,
      priceCount: metadata?.totalPrices || 0,
      historyCount: (await redis.keys('alby:lsp:history:*')).filter(key => key !== 'alby:lsp:history').length
    };
  } catch (error) {
    return {
      connected: false,
      keysCount: 0,
      configured: isRedisConfigured(),
      hasData: false,
      isStale: false,
      priceCount: 0,
      historyCount: 0,
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

