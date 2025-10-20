// Redis import handled by getRedisInstance()
import { LSPPrice } from './lsp-api';
import { isRedisConfigured, getRedisInstance } from './redis-config';

// Initialize Redis client
const redis = getRedisInstance();

// IMPROVED DATABASE STRUCTURE - No redundancy
const METADATA_KEY = 'alby:lsp:metadata';

// Per-channel-size prices (better organization)
const getChannelPricesKey = (channelSize: number) => `alby:lsp:channel:${channelSize}`;

// Save latest prices to database with improved structure
export async function savePricesToDB(prices: LSPPrice[]): Promise<boolean> {
  try {
    if (!redis || !isRedisConfigured()) {
      console.error('Upstash Redis not configured or unavailable');
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

    if (!redis) {
      console.error('Redis not available');
      return false;
    }
    
    const pipeline = redis.pipeline();
    
    // FIRST: Save current data to history with precise timestamps
    for (const [size, channelPrices] of Object.entries(pricesByChannel)) {
      const date = now.split('T')[0]; // YYYY-MM-DD
      const historyKey = `alby:lsp:history:${date}`;
      
      try {
        // Get existing history for this date
        const existingHistory = await redis.get(historyKey);
        let historyData: Record<string, unknown> = {};
        
        if (existingHistory) {
          try {
            historyData = typeof existingHistory === 'string' 
              ? JSON.parse(existingHistory) 
              : existingHistory;
          } catch (error) {
            console.warn(`Could not parse existing history for ${date}:`, error);
            historyData = {};
          }
        }
        
        // Initialize channel data if it doesn't exist
        const channelKey = `channel_${size}`;
        if (!historyData[channelKey]) {
          historyData[channelKey] = {
            channelSize: Number(size),
            entries: []
          };
        }
        
        // Add new entry with precise timestamp
        const newEntry = {
          timestamp: now,
          prices: channelPrices
        };
        
        historyData[channelKey].entries.push(newEntry);
        
        // Update the last update timestamp
        historyData.lastUpdate = now;
        historyData.date = date;
        
        pipeline.set(historyKey, JSON.stringify(historyData));
        console.log(`Saved new data to history: ${historyKey} (channel ${size}) at ${now}`);
      } catch (error) {
        console.warn(`Could not save data to history for ${historyKey}:`, error);
      }
    }
    
    // THEN: Save new current data
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
    if (!redis || !isRedisConfigured()) {
      console.error('Upstash Redis not configured or unavailable');
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
    if (!redis || !isRedisConfigured()) {
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
    if (!redis || !isRedisConfigured()) {
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
  console.log('getPriceHistory called with limit:', limit);
  try {
    console.log('isRedisConfigured():', isRedisConfigured());
    if (!redis || !isRedisConfigured()) {
      console.log('Redis not configured for getPriceHistory');
      return [];
    }
    
    console.log('Redis is configured, getting keys...');

    // Get all history keys (date-based format: alby:lsp:history:YYYY-MM-DD)
    const allKeys = await redis.keys('alby:lsp:history:*');
    console.log('All history keys:', allKeys);
    
    const historyKeys = allKeys.filter(key => 
      key.startsWith('alby:lsp:history:') && 
      key !== 'alby:lsp:history' &&
      key.match(/^alby:lsp:history:\d{4}-\d{2}-\d{2}$/) // Match YYYY-MM-DD format
    );
    
    console.log('Filtered history keys:', historyKeys);
    
    // Sort by date (descending - newest first)
    historyKeys.sort((a, b) => {
      const dateA = a.split(':')[3]; // Get date part
      const dateB = b.split(':')[3];
      return dateB.localeCompare(dateA); // Descending (newest first)
    });
    
    // Get the data for the most recent entries
    const limitedKeys = historyKeys.slice(0, limit);
    const historyData = await Promise.all(
      limitedKeys.map(async (key) => {
        const data = await redis.get(key);
        if (!data) return null;
        
        // Handle both string and object data
        if (typeof data === 'string') {
          try {
            return JSON.parse(data);
          } catch (error) {
            console.error(`Error parsing JSON for key ${key}:`, error);
            return null;
          }
        } else if (typeof data === 'object') {
          return data;
        } else {
          console.error(`Unexpected data type for key ${key}:`, typeof data);
          return null;
        }
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
    if (!redis) {
      return {
        connected: false,
        keysCount: 0,
        configured: true,
        hasData: false,
        isStale: false,
        priceCount: 0,
        historyCount: 0,
        error: 'Redis instance not available'
      };
    }
    
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

// Health status cache key
const HEALTH_STATUS_KEY = 'alby:lsp:health:current';

// Save LSP health statuses to Redis cache
export async function saveHealthStatuses(healthStatuses: Array<{
  lsp_id: string;
  is_online: boolean;
  status: 'online' | 'offline';
  last_check: string;
  response_time_ms: number;
  error_message?: string;
}>): Promise<boolean> {
  try {
    if (!redis || !isRedisConfigured()) {
      console.error('Upstash Redis not configured or unavailable');
      return false;
    }

    await redis.set(HEALTH_STATUS_KEY, JSON.stringify({
      timestamp: new Date().toISOString(),
      statuses: healthStatuses
    }));

    console.log(`Saved health status for ${healthStatuses.length} LSPs to cache`);
    return true;
  } catch (error) {
    console.error('Error saving health statuses to cache:', error);
    return false;
  }
}

// Get cached LSP health statuses from Redis
export async function getHealthStatuses(): Promise<Array<{
  lsp_id: string;
  is_online: boolean;
  status: 'online' | 'offline';
  last_check: string;
  response_time_ms: number;
  error_message?: string;
}> | null> {
  try {
    if (!redis || !isRedisConfigured()) {
      console.error('Upstash Redis not configured or unavailable');
      return null;
    }

    const data = await redis.get(HEALTH_STATUS_KEY);
    if (!data) return null;

    const parsed = typeof data === 'string' ? JSON.parse(data) : data;
    return parsed.statuses || null;
  } catch (error) {
    console.error('Error getting health statuses from cache:', error);
    return null;
  }
}

// Clear all relevant cache keys
export async function clearCache(): Promise<string[]> {
  try {
    if (!redis || !isRedisConfigured()) {
      console.error('Upstash Redis not configured or unavailable');
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

