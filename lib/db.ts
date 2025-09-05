import { kv } from './vercel-kv';
import { LSPPrice } from './lsp-api';

// Database keys
const PRICES_KEY = 'lsp_prices';
const LAST_UPDATE_KEY = 'last_update';
const PRICE_HISTORY_KEY = 'price_history';

// Save latest prices to database
export async function savePricesToDB(prices: LSPPrice[]): Promise<boolean> {
  try {
    if (!kv) {
      console.error('Vercel KV not configured');
      return false;
    }

    // Save current prices
    await kv.set(PRICES_KEY, prices);
    
    // Save timestamp of last update
    await kv.set(LAST_UPDATE_KEY, new Date().toISOString());
    
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
    
    await kv.set(PRICE_HISTORY_KEY, history);
    
    return true;
  } catch (error) {
    console.error('Error saving prices to database:', error);
    return false;
  }
}

// Get latest prices from database
export async function getLatestPrices(): Promise<LSPPrice[]> {
  try {
    if (!kv) {
      console.error('Vercel KV not configured');
      return [];
    }

    const prices = await kv.get<LSPPrice[]>(PRICES_KEY);
    return prices || [];
  } catch (error) {
    console.error('Error getting latest prices from database:', error);
    return [];
  }
}

// Get last update timestamp
export async function getLastUpdateTime(): Promise<string | null> {
  try {
    if (!kv) {
      return null;
    }

    return await kv.get<string>(LAST_UPDATE_KEY);
  } catch (error) {
    console.error('Error getting last update time:', error);
    return null;
  }
}

// Get price history
export async function getPriceHistory(): Promise<Array<{timestamp: string, prices: LSPPrice[]}>> {
  try {
    if (!kv) {
      return [];
    }

    const history = await kv.get<Array<{timestamp: string, prices: LSPPrice[]}>>(PRICE_HISTORY_KEY);
    return history || [];
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
    if (!kv) {
      return false;
    }

    await kv.del(PRICES_KEY);
    await kv.del(LAST_UPDATE_KEY);
    await kv.del(PRICE_HISTORY_KEY);
    
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
