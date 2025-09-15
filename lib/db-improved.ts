import { Redis } from '@upstash/redis';
import { LSPPrice } from './lsp-api';

// Initialize Redis client
const redis = Redis.fromEnv();

// Check if Redis is properly configured
const isRedisConfigured = () => {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
};

// IMPROVED DATABASE STRUCTURE
// Single source of truth with better organization

// Main prices with metadata
// Removed unused constant
const METADATA_KEY = 'alby:lsp:metadata';
const HISTORY_KEY = 'alby:lsp:history';

// Per-channel-size prices (better organization)
const getChannelPricesKey = (channelSize: number) => `alby:lsp:channel:${channelSize}`;

// Save prices with improved structure
export async function savePricesToDBImproved(prices: LSPPrice[]): Promise<boolean> {
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

// Get prices for specific channel size
export async function getPricesForChannel(channelSize: number): Promise<LSPPrice[]> {
  try {
    if (!isRedisConfigured()) {
      return [];
    }

    const key = getChannelPricesKey(channelSize);
    const data = await redis.get(key);
    
    if (!data) return [];
    
    // Handle different data types
    if (Array.isArray(data)) return data;
    if (typeof data === 'string') return JSON.parse(data);
    if (typeof data === 'object') return Array.isArray(data) ? data : [data];
    
    return [];
  } catch (error) {
    console.error('Error getting prices for channel:', error);
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

// Get metadata
export async function getMetadata(): Promise<{ lastUpdate: string; totalChannels: number; channelSizes: number[] } | null> {
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

// Get price history
export async function getPriceHistory(limit: number = 20): Promise<{ timestamp: string; channelSize: number; prices: LSPPrice[] }[]> {
  try {
    if (!isRedisConfigured()) {
      return [];
    }

    const history = await redis.lrange(HISTORY_KEY, 0, limit - 1);
    return history.map(entry => JSON.parse(entry as string));
  } catch (error) {
    console.error('Error getting price history:', error);
    return [];
  }
}

// Clear all data
export async function clearAllData(): Promise<string[]> {
  try {
    if (!isRedisConfigured()) {
      return [];
    }

    const keys = await redis.keys('alby:lsp:*');
    if (keys.length > 0) {
      await redis.del(...keys);
    }
    return keys;
  } catch (error) {
    console.error('Error clearing data:', error);
    return [];
  }
}
