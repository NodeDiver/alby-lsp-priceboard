import { Redis } from '@upstash/redis';
import { LSPPrice } from './lsp-api';

// Initialize Redis client
const redis = Redis.fromEnv();

// Database keys with namespacing
const PRICES_KEY = 'alby:lsp:prices';
const LAST_UPDATE_KEY = 'alby:lsp:last_update';
const PRICE_HISTORY_KEY = 'alby:lsp:price_history';

// Save latest prices to database with pipeline and atomic operations
export async function savePricesToDB(prices: LSPPrice[]): Promise<boolean> {
  try {
    if (!redis) {
      console.error('Upstash Redis not configured');
      return false;
    }

    const now = new Date().toISOString();
    const historyEntry = JSON.stringify({ timestamp: now, prices });
    
    // Use pipeline for atomic operations and better performance
    const pipeline = redis.pipeline();
    
    // Save current prices with TTL (1 hour for staleness detection)
    pipeline.set(PRICES_KEY, JSON.stringify(prices), { ex: 3600 });
    
    // Save timestamp
    pipeline.set(LAST_UPDATE_KEY, now);
    
    // Add to history using atomic LIST operations
    pipeline.lpush(PRICE_HISTORY_KEY, historyEntry);
    pipeline.ltrim(PRICE_HISTORY_KEY, 0, 99); // Keep only last 100 entries
    
    // Execute all operations atomically
    await pipeline.exec();
    
    return true;
  } catch (error) {
    console.error('Error saving prices to database:', error);
    return false;
  }
}

// Get latest prices from database
export async function getLatestPrices(): Promise<LSPPrice[]> {
  try {
    if (!redis) {
      console.error('Upstash Redis not configured');
      return [];
    }

    const pricesJson = await redis.get<string>(PRICES_KEY);
    return pricesJson ? JSON.parse(pricesJson) : [];
  } catch (error) {
    console.error('Error getting latest prices from database:', error);
    return [];
  }
}

// Get last update timestamp
export async function getLastUpdateTime(): Promise<string | null> {
  try {
    if (!redis) {
      return null;
    }

    return await redis.get<string>(LAST_UPDATE_KEY);
  } catch (error) {
    console.error('Error getting last update time:', error);
    return null;
  }
}

// Get price history from LIST
export async function getPriceHistory(): Promise<Array<{timestamp: string, prices: LSPPrice[]}>> {
  try {
    if (!redis) {
      return [];
    }

    // Get all entries from the LIST (most recent first)
    const historyEntries = await redis.lrange<string>(PRICE_HISTORY_KEY, 0, -1);
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

// Clear all data (useful for testing/reset)
export async function clearAllData(): Promise<boolean> {
  try {
    if (!redis) {
      return false;
    }

    await redis.del(PRICES_KEY);
    await redis.del(LAST_UPDATE_KEY);
    await redis.del(PRICE_HISTORY_KEY);
    
    return true;
  } catch (error) {
    console.error('Error clearing database:', error);
    return false;
  }
}

// Get database status (optimized with pipeline)
export async function getDatabaseStatus(): Promise<{
  hasData: boolean;
  lastUpdate: string | null;
  priceCount: number;
  historyCount: number;
  isStale: boolean;
}> {
  try {
    if (!redis) {
      return {
        hasData: false,
        lastUpdate: null,
        priceCount: 0,
        historyCount: 0,
        isStale: true
      };
    }

    // Use pipeline for efficient status check
    const pipeline = redis.pipeline();
    pipeline.get(PRICES_KEY);
    pipeline.get(LAST_UPDATE_KEY);
    pipeline.llen(PRICE_HISTORY_KEY);
    pipeline.ttl(PRICES_KEY); // Check if data is stale
    
    const [pricesJson, lastUpdate, historyCount, ttl] = await pipeline.exec();
    
    const prices = pricesJson ? JSON.parse(pricesJson as string) : [];
    const isStale = ttl === -2; // Key doesn't exist (expired or never set)
    
    return {
      hasData: prices.length > 0,
      lastUpdate: lastUpdate as string | null,
      priceCount: prices.length,
      historyCount: historyCount as number,
      isStale
    };
  } catch (error) {
    console.error('Error getting database status:', error);
    return {
      hasData: false,
      lastUpdate: null,
      priceCount: 0,
      historyCount: 0,
      isStale: true
    };
  }
}
