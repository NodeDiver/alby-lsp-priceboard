import { fetchAllLSPPrices, LSPPrice } from './lsp-api';
import { savePricesWithPerLSPCache, getLatestPrices as getLatestPricesFromDB } from './db';

// Price fetching service
export class PriceService {
  private static instance: PriceService;
  private isFetching: boolean = false;
  private lastFetchTime: Date | null = null;
  private fetchIntervalMs = 10 * 60 * 1000; // 10 minutes
  private inMemoryCache: Map<number, LSPPrice[]> = new Map(); // channelSize -> prices

  private constructor() {}

  public static getInstance(): PriceService {
    if (!PriceService.instance) {
      PriceService.instance = new PriceService();
    }
    return PriceService.instance;
  }

  // Fetch prices from all LSPs and save to database
  public async fetchAndSavePrices(channelSizeSat: number = 1000000): Promise<LSPPrice[]> {
    if (this.isFetching) {
      return await getLatestPricesFromDB();
    }

    // Check if we need to fetch (based on time interval)
    if (this.lastFetchTime && 
        Date.now() - this.lastFetchTime.getTime() < this.fetchIntervalMs) {
      return await getLatestPricesFromDB();
    }

    this.isFetching = true;
    
    try {
      
      // Fetch prices from all LSPs
      const prices = await fetchAllLSPPrices(channelSizeSat);
      
      if (prices.length > 0) {
        // Save to database
        const saved = await savePricesWithPerLSPCache(prices);
        if (saved) {
          this.lastFetchTime = new Date();
        }
        
        // Also save to in-memory cache for local development
        this.inMemoryCache.set(channelSizeSat, prices);
      }
      
      return prices;
    } catch (error) {
      console.error('Error in price fetch service:', error);
      // Return cached prices if available
      return await getLatestPricesFromDB();
    } finally {
      this.isFetching = false;
    }
  }

  // Force fetch prices regardless of time interval
  public async forceFetchPrices(channelSizeSat: number = 1000000, bypassRateLimit: boolean = false): Promise<LSPPrice[]> {
    this.lastFetchTime = null;
    if (bypassRateLimit) {
      // Bypass rate limiting by directly calling fetchAllLSPPrices
      const { fetchAllLSPPrices } = await import('./lsp-api');
      const prices = await fetchAllLSPPrices(channelSizeSat, true);
      
      // Save to in-memory cache
      if (prices.length > 0) {
        this.inMemoryCache.set(channelSizeSat, prices);
      }
      
      return prices;
    }
    return await this.fetchAndSavePrices(channelSizeSat);
  }

  // Get latest prices (from cache or fetch if needed)
  public async getLatestPrices(channelSizeSat: number = 1000000): Promise<LSPPrice[]> {
    const cachedPrices = await getLatestPricesFromDB();
    
    // Filter cached prices by channel size
    const filteredCachedPrices = cachedPrices.filter(price => price.channel_size_sat === channelSizeSat);
    
    if (filteredCachedPrices.length === 0) {
      // No cached prices for this channel size in Redis
      // First check in-memory cache
      const inMemoryPrices = this.inMemoryCache.get(channelSizeSat);
      if (inMemoryPrices && inMemoryPrices.length > 0) {
        console.log(`Using in-memory cache for ${channelSizeSat} sats (${inMemoryPrices.length} prices)`);
        // Mark as cached data
        return inMemoryPrices.map(price => ({
          ...price,
          source: 'cached' as const,
          stale_seconds: Math.floor((Date.now() - Date.parse(price.timestamp)) / 1000)
        }));
      }
      
      // No in-memory cache either, check if we should fetch fresh
      if (this.shouldRefreshPrices()) {
        return await this.fetchAndSavePrices(channelSizeSat);
      } else {
        // Too soon to fetch fresh, return empty
        return [];
      }
    }
    
    // Check if we need to refresh
    if (this.shouldRefreshPrices()) {
      // Fetch in background without blocking
      this.fetchAndSavePrices(channelSizeSat).catch(console.error);
    }
    
    return filteredCachedPrices;
  }

  // Check if prices should be refreshed (with jitter to avoid thundering herd)
  private shouldRefreshPrices(): boolean {
    if (!this.lastFetchTime) return true;
    
    // Add small jitter to avoid multiple instances refreshing simultaneously
    const jitterMs = Math.floor(Math.random() * 15_000); // 0-15 seconds
    const timeSinceLastFetch = Date.now() - this.lastFetchTime.getTime();
    return timeSinceLastFetch >= (this.fetchIntervalMs + jitterMs);
  }

  // Get service status
  public getStatus(): {
    isFetching: boolean;
    lastFetchTime: Date | null;
    nextFetchTime: Date | null;
  } {
    const nextFetchTime = this.lastFetchTime 
      ? new Date(this.lastFetchTime.getTime() + this.fetchIntervalMs)
      : null;
    
    return {
      isFetching: this.isFetching,
      lastFetchTime: this.lastFetchTime,
      nextFetchTime
    };
  }

  // Set custom fetch interval
  public setFetchInterval(minutes: number): void {
    this.fetchIntervalMs = Math.max(1, minutes) * 60 * 1000;
  }
}

// Export singleton instance
export const priceService = PriceService.getInstance();

// Convenience functions
export async function fetchAndSavePrices(channelSizeSat: number = 1000000): Promise<LSPPrice[]> {
  return await priceService.fetchAndSavePrices(channelSizeSat);
}

export async function getLatestPrices(channelSizeSat: number = 1000000): Promise<LSPPrice[]> {
  return await priceService.getLatestPrices(channelSizeSat);
}

export async function forceFetchPrices(channelSizeSat: number = 1000000, bypassRateLimit: boolean = false): Promise<LSPPrice[]> {
  return await priceService.forceFetchPrices(channelSizeSat, bypassRateLimit);
}
