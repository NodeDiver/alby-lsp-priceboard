import { Redis } from '@upstash/redis';
import { LSPPrice } from './lsp-api';

// Initialize Redis client
const redis = Redis.fromEnv();

// Database keys
const PRICES_KEY = 'lsp_prices';
const LAST_UPDATE_KEY = 'last_update';
const PRICE_HISTORY_KEY = 'price_history';

// Save latest prices to database
export async function savePricesToDB(prices: LSPPrice[]): Promise<boolean> {
  try {
    if (!redis) {
      console.error('Upstash Redis not configured');
      return false;
    }

    // Save current prices
    await redis.set(PRICES_KEY, JSON.stringify(prices));
    
    // Save timestamp of last update
    await redis.set(LAST_UPDATE_KEY, new Date().toISOString());
    
    // Save to history (keep last 100 entries)
    const history = await getPriceHistory();
    history.push({
      timestamp: new Date().toISOString(),
      prices: prices
    });
    
    // Keep only last 100 entries
    if (history.length > 100) {
      history.splice(0, history.length - 100);
    }
    
    await redis.set(PRICE_HISTORY_KEY, JSON.stringify(history));
    
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

// Get price history
export async function getPriceHistory(): Promise<Array<{timestamp: string, prices: LSPPrice[]}>> {
  try {
    if (!redis) {
      return [];
    }

    const historyJson = await redis.get<string>(PRICE_HISTORY_KEY);
    return historyJson ? JSON.parse(historyJson) : [];
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

// Get database status
export async function getDatabaseStatus(): Promise<{
  hasData: boolean;
  lastUpdate: string | null;
  priceCount: number;
  historyCount: number;
}> {
  try {
    const prices = await getLatestPrices();
    const lastUpdate = await getLastUpdateTime();
    const history = await getPriceHistory();
    
    return {
      hasData: prices.length > 0,
      lastUpdate,
      priceCount: prices.length,
      historyCount: history.length
    };
  } catch (error) {
    console.error('Error getting database status:', error);
    return {
      hasData: false,
      lastUpdate: null,
      priceCount: 0,
      historyCount: 0
    };
  }
}
