import { fetchAllLSPPrices, LSPPrice } from './lsp-api';
import { savePricesWithPerLSPCache, getLatestPrices as getLatestPricesFromDB } from './db';

// Price fetching service
export class PriceService {
  private static instance: PriceService;
  private isFetching: boolean = false;
  private lastFetchTime: Date | null = null;
  private fetchIntervalMs = 10 * 60 * 1000; // 10 minutes

  private constructor() {}

  public static getInstance(): PriceService {
    if (!PriceService.instance) {
      PriceService.instance = new PriceService();
    }
    return PriceService.instance;
  }

  // Fetch prices from all LSPs and save to database
  public async fetchAndSavePrices(): Promise<LSPPrice[]> {
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
      const prices = await fetchAllLSPPrices();
      
      if (prices.length > 0) {
        // Save to database
        const saved = await savePricesWithPerLSPCache(prices);
        if (saved) {
          this.lastFetchTime = new Date();
        }
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
  public async forceFetchPrices(): Promise<LSPPrice[]> {
    this.lastFetchTime = null;
    return await this.fetchAndSavePrices();
  }

  // Get latest prices (from cache or fetch if needed)
  public async getLatestPrices(): Promise<LSPPrice[]> {
    const cachedPrices = await getLatestPricesFromDB();
    
    if (cachedPrices.length === 0) {
      return await this.fetchAndSavePrices();
    }
    
    // Check if we need to refresh
    if (this.shouldRefreshPrices()) {
      // Fetch in background without blocking
      this.fetchAndSavePrices().catch(console.error);
    }
    
    return cachedPrices;
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
export async function fetchAndSavePrices(): Promise<LSPPrice[]> {
  return await priceService.fetchAndSavePrices();
}

export async function getLatestPrices(): Promise<LSPPrice[]> {
  return await priceService.getLatestPrices();
}

export async function forceFetchPrices(): Promise<LSPPrice[]> {
  return await priceService.forceFetchPrices();
}
