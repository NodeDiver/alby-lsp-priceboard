import { fetchAllLSPPrices } from './lsp-api';
import { savePricesToDB, getLatestPrices } from './db';
import { LSPPrice } from './lsp-api';

// Price fetching service
export class PriceService {
  private static instance: PriceService;
  private isFetching: boolean = false;
  private lastFetchTime: Date | null = null;
  private readonly FETCH_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

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
      return await getLatestPrices();
    }

    // Check if we need to fetch (based on time interval)
    if (this.lastFetchTime && 
        Date.now() - this.lastFetchTime.getTime() < this.FETCH_INTERVAL_MS) {
      return await getLatestPrices();
    }

    this.isFetching = true;
    
    try {
      
      // Fetch prices from all LSPs
      const prices = await fetchAllLSPPrices();
      
      if (prices.length > 0) {
        // Save to database
        const saved = await savePricesToDB(prices);
        if (saved) {
          this.lastFetchTime = new Date();
        }
      }
      
      return prices;
    } catch (error) {
      console.error('Error in price fetch service:', error);
      // Return cached prices if available
      return await getLatestPrices();
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
    const cachedPrices = await getLatestPrices();
    
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

  // Check if prices should be refreshed
  private shouldRefreshPrices(): boolean {
    if (!this.lastFetchTime) return true;
    
    const timeSinceLastFetch = Date.now() - this.lastFetchTime.getTime();
    return timeSinceLastFetch >= this.FETCH_INTERVAL_MS;
  }

  // Get service status
  public getStatus(): {
    isFetching: boolean;
    lastFetchTime: Date | null;
    nextFetchTime: Date | null;
  } {
    const nextFetchTime = this.lastFetchTime 
      ? new Date(this.lastFetchTime.getTime() + this.FETCH_INTERVAL_MS)
      : null;
    
    return {
      isFetching: this.isFetching,
      lastFetchTime: this.lastFetchTime,
      nextFetchTime
    };
  }

  // Set custom fetch interval
  public setFetchInterval(minutes: number): void {
    this.FETCH_INTERVAL_MS = minutes * 60 * 1000;
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
