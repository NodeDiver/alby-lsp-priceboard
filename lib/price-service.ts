import { fetchAllLSPPrices, LSPPrice, LspErrorCode } from './lsp-api';
import { savePricesToDB, getLatestPrices as getLatestPricesFromDB } from './db';
import { fetchAlbyPricesForChannelSize, getAlbyPriceForLSP } from './alby-api';

// LRU Cache configuration
const MAX_CACHE_ENTRIES = 100; // Maximum number of cache entries to keep
const CACHE_ENTRY_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CacheEntry {
  prices: LSPPrice[];
  timestamp: number;
}

// Price fetching service
export class PriceService {
  private static instance: PriceService;
  private isFetching: boolean = false;
  private lastFetchTime: Date | null = null;
  private fetchIntervalMs = 10 * 60 * 1000; // 10 minutes
  private inMemoryCache: Map<number, CacheEntry> = new Map(); // channelSize -> {prices, timestamp}

  private constructor() {}

  public static getInstance(): PriceService {
    if (!PriceService.instance) {
      PriceService.instance = new PriceService();
    }
    return PriceService.instance;
  }

  /**
   * Evict old cache entries to prevent memory leak
   * Implements LRU-like eviction: removes oldest entries when cache is full
   */
  private evictOldCacheEntries(): void {
    const now = Date.now();

    // Remove stale entries (older than max age)
    for (const [channelSize, entry] of this.inMemoryCache.entries()) {
      if (now - entry.timestamp > CACHE_ENTRY_MAX_AGE_MS) {
        this.inMemoryCache.delete(channelSize);
      }
    }

    // If still over limit, remove oldest entries
    if (this.inMemoryCache.size > MAX_CACHE_ENTRIES) {
      const entries = Array.from(this.inMemoryCache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp);

      const toRemove = entries.slice(0, this.inMemoryCache.size - MAX_CACHE_ENTRIES);
      for (const [channelSize] of toRemove) {
        this.inMemoryCache.delete(channelSize);
      }
    }
  }

  /**
   * Get prices from in-memory cache
   */
  private getCachedPrices(channelSize: number): LSPPrice[] | null {
    const entry = this.inMemoryCache.get(channelSize);
    if (!entry) return null;

    // Check if cache entry is still valid
    if (Date.now() - entry.timestamp > CACHE_ENTRY_MAX_AGE_MS) {
      this.inMemoryCache.delete(channelSize);
      return null;
    }

    return entry.prices;
  }

  /**
   * Set prices in in-memory cache with eviction
   */
  private setCachedPrices(channelSize: number, prices: LSPPrice[]): void {
    this.inMemoryCache.set(channelSize, {
      prices,
      timestamp: Date.now()
    });

    // Evict old entries after adding new one
    this.evictOldCacheEntries();
  }

  // Helper method to determine if cached data should be treated as "live" (less than 1 hour old)
  private isFreshCachedData(timestamp: string): boolean {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000); // 1 hour ago
    const priceTime = new Date(timestamp);
    return priceTime > oneHourAgo;
  }

  // Fetch prices from all LSPs and save to database
  public async fetchAndSavePrices(channelSizeSat: number = 1000000): Promise<LSPPrice[]> {
    if (this.isFetching) {
      return await getLatestPricesFromDB(channelSizeSat);
    }

    // Check if we need to fetch (based on time interval)
    if (this.lastFetchTime && 
        Date.now() - this.lastFetchTime.getTime() < this.fetchIntervalMs) {
      return await getLatestPricesFromDB(channelSizeSat);
    }

    this.isFetching = true;
    
    try {
      // NEW: Try Alby API first
      console.log(`🔄 Fetching prices for ${channelSizeSat} sats - trying Alby API first`);
      const allPrices: LSPPrice[] = [];
      
      try {
        const albyPrices = await fetchAlbyPricesForChannelSize(channelSizeSat);
        allPrices.push(...albyPrices);
        
        const albySuccessCount = albyPrices.filter(p => !p.error).length;
        console.log(`📊 Alby API: ${albySuccessCount}/${albyPrices.length} LSPs have data`);
      } catch (albyError) {
        console.warn(`⚠️ Alby API failed, falling back to LSPS1: ${albyError instanceof Error ? albyError.message : 'Unknown error'}`);
      }
      
      // For any LSPs not covered by Alby API, try LSPS1
      const { getActiveLSPs } = await import('./lsps');
      const activeLSPs = getActiveLSPs();
      const albyLspIds = new Set(allPrices.map(p => p.lsp_id));
      const missingLSPs = activeLSPs.filter(lsp => !albyLspIds.has(lsp.id));
      
      if (missingLSPs.length > 0) {
        console.log(`🔍 Missing LSPs from Alby API: ${missingLSPs.map(l => l.name).join(', ')} - trying LSPS1`);
        try {
          const lsps1Prices = await fetchAllLSPPrices(channelSizeSat);
          // Only add LSPS1 prices for LSPs not already covered by Alby
          const additionalLsps1Prices = lsps1Prices.filter(price => !albyLspIds.has(price.lsp_id));
          allPrices.push(...additionalLsps1Prices);
          
          const lsps1SuccessCount = additionalLsps1Prices.filter(p => !p.error).length;
          console.log(`📊 LSPS1 fallback: ${lsps1SuccessCount}/${additionalLsps1Prices.length} additional LSPs`);
        } catch (lsps1Error) {
          console.error(`❌ LSPS1 fallback also failed: ${lsps1Error instanceof Error ? lsps1Error.message : 'Unknown error'}`);
        }
      }
      
      if (allPrices.length > 0) {
        // Save to database
        const saved = await savePricesToDB(allPrices);
        if (saved) {
          this.lastFetchTime = new Date();
        }
        
        // Also save to in-memory cache for local development
        this.setCachedPrices(channelSizeSat, allPrices);
        
        const totalSuccessCount = allPrices.filter(p => !p.error).length;
        console.log(`✅ Price fetch complete: ${totalSuccessCount}/${allPrices.length} LSPs successful`);
      }
      
      return allPrices;
    } catch (error) {
      console.error('Error in price fetch service:', error);
      // Return cached prices if available
      return await getLatestPricesFromDB(channelSizeSat);
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
        this.setCachedPrices(channelSizeSat, prices);
      }
      
      return prices;
    }
    return await this.fetchAndSavePrices(channelSizeSat);
  }

  // Smart caching: Show cached first, then fetch live per LSP
  public async getSmartPrices(channelSizeSat: number = 1000000): Promise<LSPPrice[]> {
    const { getActiveLSPs } = await import('./lsps');
    const activeLSPs = getActiveLSPs();
    
    // First, get all cached prices for this channel size
    const cachedPrices = await getLatestPricesFromDB(channelSizeSat);
    
    // Check in-memory cache if no Redis cache
    let availablePrices = cachedPrices;
    if (availablePrices.length === 0) {
      const inMemoryPrices = this.getCachedPrices(channelSizeSat);
      if (inMemoryPrices && inMemoryPrices.length > 0) {
        console.log(`Using in-memory cache for ${channelSizeSat} sats (${inMemoryPrices.length} prices)`);
        availablePrices = inMemoryPrices.map(price => ({
          ...price,
          source: this.isFreshCachedData(price.timestamp) ? 'live' as const : 'cached' as const,
          stale_seconds: Math.floor((Date.now() - Date.parse(price.timestamp)) / 1000)
        }));
      }
    }
    
    // For each active LSP, return cached data or unavailable
    const results = activeLSPs.map(lsp => {
      const cachedPrice = availablePrices.find(price => price.lsp_id === lsp.id);
      
      if (cachedPrice) {
        console.log(`Returning cached data for ${lsp.name}`);
        return {
          ...cachedPrice,
          source: this.isFreshCachedData(cachedPrice.timestamp) ? 'live' as const : 'cached' as const,
          stale_seconds: Math.floor((Date.now() - Date.parse(cachedPrice.timestamp)) / 1000)
        };
      } else {
        console.log(`No cached data available for ${lsp.name}`);
        return {
          lsp_id: lsp.id,
          lsp_name: lsp.name,
          channel_size_sat: channelSizeSat,
          total_fee_msat: 0,
          channel_fee_percent: 0,
          channel_fee_base_msat: 0,
          lease_fee_base_msat: 0,
          lease_fee_basis: 0,
          timestamp: new Date().toISOString(),
          error: 'Cached data unavailable',
          error_code: LspErrorCode.CACHE_UNAVAILABLE,
          source: 'unavailable' as const
        };
      }
    });
    
    // Fetch live data in background without blocking
    console.log(`Fetching live data in background for ${channelSizeSat} sats`);
    this.fetchLiveDataPerLSP(channelSizeSat, false).catch(console.error);
    
    return results;
  }

  // Refresh prices: Try live data first, fallback to cached
  public async refreshPrices(channelSizeSat: number = 1000000): Promise<LSPPrice[]> {
    console.log(`Refreshing prices for ${channelSizeSat} sats`);
    return await this.fetchLiveDataPerLSP(channelSizeSat, false);
  }

  // Force fetch: Same as refresh but bypass rate limits
  public async forceFetchPricesNew(channelSizeSat: number = 1000000, bypassRateLimit: boolean = false): Promise<LSPPrice[]> {
    console.log(`Force fetching prices for ${channelSizeSat} sats (bypass rate limit: ${bypassRateLimit})`);
    return await this.fetchLiveDataPerLSP(channelSizeSat, bypassRateLimit);
  }

  // Force fetch a single LSP
  public async forceFetchSingleLSP(lspId: string, channelSizeSat: number = 1000000): Promise<LSPPrice[]> {
    console.log(`Force fetching prices for LSP ${lspId} at ${channelSizeSat} sats`);
    
    const { getActiveLSPs } = await import('./lsps');
    const { fetchLSPPriceBypass } = await import('./lsp-api');
    const activeLSPs = getActiveLSPs();
    
    // Find the specific LSP
    const targetLSP = activeLSPs.find(lsp => lsp.id === lspId);
    if (!targetLSP) {
      console.error(`LSP ${lspId} not found`);
      return [];
    }
    
    // Get existing cached prices for fallback
    const cachedPrices = await getLatestPricesFromDB(channelSizeSat);
    
    try {
      // NEW: Try Alby API first
      console.log(`🔄 Force fetching ${targetLSP.name} - trying Alby API first`);
      let livePrice: LSPPrice | null = null;
      
      try {
        const albyPrices = await fetchAlbyPricesForChannelSize(channelSizeSat);
        const albyPriceForLSP = getAlbyPriceForLSP(albyPrices, lspId, channelSizeSat);
        
        if (albyPriceForLSP && !albyPriceForLSP.error && albyPriceForLSP.total_fee_msat > 0) {
          console.log(`✅ Got data from Alby API for ${targetLSP.name}: ${albyPriceForLSP.total_fee_msat} msat`);
          livePrice = { ...albyPriceForLSP, source: 'live' as const };
        } else {
          console.log(`⚠️ No Alby data for ${targetLSP.name} at ${channelSizeSat} sats`);
        }
      } catch (albyError) {
        console.warn(`⚠️ Alby API failed for ${targetLSP.name}, trying LSPS1: ${albyError instanceof Error ? albyError.message : 'Unknown error'}`);
      }
      
      // FALLBACK: Try LSPS1 if Alby didn't provide data
      if (!livePrice) {
        console.log(`🔍 Trying LSPS1 for ${targetLSP.name}`);
        const lsps1Price = await fetchLSPPriceBypass(targetLSP, channelSizeSat);
        
        if (lsps1Price && lsps1Price.source === 'live') {
          console.log(`✅ Got data from LSPS1 for ${targetLSP.name}`);
          // Convert old error codes to new ones
          const convertedPrice = this.convertErrorCodes(lsps1Price);
          livePrice = { ...convertedPrice, source: 'live' as const };
        } else {
          console.log(`⚠️ No LSPS1 data for ${targetLSP.name}`);
        }
      }
      
      if (livePrice) {
        console.log(`🎯 Successfully fetched live data for ${targetLSP.name} from ${livePrice.source === 'alby_api' ? 'Alby API' : 'LSPS1'}`);
        
        // Merge with existing data - keep other LSPs' original timestamps and sources
        const otherPrices = cachedPrices.filter(p => p.lsp_id !== lspId);
        const allPrices = [livePrice, ...otherPrices];
        
        // Save only the updated LSP to database to avoid updating other LSPs' timestamps
        await savePricesToDB([livePrice]);
        
        // Update in-memory cache with all prices
        this.setCachedPrices(channelSizeSat, allPrices);
        
        // Return all prices (the specific LSP + others from cache)
        return allPrices;
      } else {
        // No live data - return cached data for this LSP if available
        const cachedPrice = cachedPrices.find(p => p.lsp_id === lspId);
        if (cachedPrice) {
          console.log(`Using cached data for ${targetLSP.name} (no live data available)`);
          return cachedPrices;
        } else {
          // No cached data either - return unavailable for this LSP
          const unavailablePrice = this.createErrorPrice(lspId, targetLSP.name, channelSizeSat, LspErrorCode.LIVE_DATA_UNAVAILABLE, 'Unable to fetch live data');
          const otherPrices = cachedPrices.filter(p => p.lsp_id !== lspId);
          return [unavailablePrice, ...otherPrices];
        }
      }
    } catch (error) {
      console.error(`Error force fetching data for ${targetLSP.name}:`, error);
      // Try cached data as fallback
      const cachedPrice = cachedPrices.find(p => p.lsp_id === lspId);
      if (cachedPrice) {
        console.log(`Using cached data for ${targetLSP.name} (error occurred)`);
        return cachedPrices;
      } else {
        const errorPrice = this.createErrorPrice(lspId, targetLSP.name, channelSizeSat, LspErrorCode.LIVE_DATA_UNAVAILABLE, 'Unable to fetch live data');
        const otherPrices = cachedPrices.filter(p => p.lsp_id !== lspId);
        return [errorPrice, ...otherPrices];
      }
    }
  }

  // Fetch live data per LSP, with fallback to cached data
  private async fetchLiveDataPerLSP(channelSizeSat: number, bypassRateLimit: boolean): Promise<LSPPrice[]> {
    const { getActiveLSPs } = await import('./lsps');
    const { fetchLSPPrice, fetchLSPPriceBypass } = await import('./lsp-api');
    const activeLSPs = getActiveLSPs();
    
    // Get existing cached prices for fallback
    const cachedPrices = await getLatestPricesFromDB(channelSizeSat);
    // Prices are already filtered by channel size in the new structure
    
    // NEW: Try Alby API first for all LSPs
    console.log(`🔄 Fetching live data per LSP for ${channelSizeSat} sats - trying Alby API first`);
    let albyPrices: LSPPrice[] = [];
    try {
      albyPrices = await fetchAlbyPricesForChannelSize(channelSizeSat);
      const albySuccessCount = albyPrices.filter(p => !p.error).length;
      console.log(`📊 Alby API: ${albySuccessCount}/${albyPrices.length} LSPs have data`);
    } catch (albyError) {
      console.warn(`⚠️ Alby API failed, will try LSPS1 per LSP: ${albyError instanceof Error ? albyError.message : 'Unknown error'}`);
    }
    
    const promises = activeLSPs.map(async (lsp) => {
      try {
        // NEW: Check if Alby API has data for this LSP first
        const albyPriceForLSP = getAlbyPriceForLSP(albyPrices, lsp.id, channelSizeSat);
        
        if (albyPriceForLSP && !albyPriceForLSP.error && albyPriceForLSP.total_fee_msat > 0) {
          console.log(`✅ Got data from Alby API for ${lsp.name}: ${albyPriceForLSP.total_fee_msat} msat`);
          return { ...albyPriceForLSP, source: 'live' as const };
        }
        
        // FALLBACK: Try LSPS1 if Alby didn't provide data
        console.log(`🔍 No Alby data for ${lsp.name}, trying LSPS1`);
        const livePrice = bypassRateLimit 
          ? await fetchLSPPriceBypass(lsp, channelSizeSat)
          : await fetchLSPPrice(lsp, channelSizeSat);
        
        if (livePrice && !livePrice.error && livePrice.total_fee_msat > 0) {
          console.log(`Got successful live data for ${lsp.name}`);
          // Convert old error codes to new ones
          const convertedPrice = this.convertErrorCodes(livePrice);
          return { ...convertedPrice, source: 'live' as const };
        } else {
          // Live fetch failed - try good cached data for this LSP
          let cachedPrice = cachedPrices.find(price => 
            price.lsp_id === lsp.id && 
            !price.error && 
            price.total_fee_msat > 0
          );
          
          // If no good cached data in current cache, try historical data
          if (!cachedPrice) {
            console.log(`No good cached data for ${lsp.name}, checking historical data...`);
            try {
              const { getPriceHistory } = await import('./db');
              const historyData = await getPriceHistory(100);
              
              // Find the most recent good historical data for this LSP and channel size
              // The new format has daily snapshots with channel-specific data
              let historicalPrice = null;
              
              for (const entry of historyData) {
                if (entry && typeof entry === 'object') {
                  // Look for channel-specific data in the entry
                  const channelKey = `channel_${channelSizeSat}`;
                  if (entry[channelKey] && entry[channelKey].prices) {
                    const price = entry[channelKey].prices.find(p => 
                      p.lsp_id === lsp.id && 
                      !p.error && 
                      p.total_fee_msat > 0
                    );
                    if (price) {
                      historicalPrice = price;
                      break; // Use the most recent (first) match
                    }
                  }
                }
              }
              
              if (historicalPrice) {
                console.log(`Found historical data for ${lsp.name}: ${historicalPrice.total_fee_msat} msat from ${historicalPrice.timestamp}`);
                cachedPrice = historicalPrice;
              }
            } catch (error) {
              console.error(`Error fetching historical data for ${lsp.name}:`, error);
            }
          }
          
          if (cachedPrice) {
            console.log(`Using cached data for ${lsp.name} (live fetch failed)`);
            
            // Check if this is a "channel size too small" error - don't show cached data for this
            if (livePrice && livePrice.error_code === LspErrorCode.CHANNEL_SIZE_TOO_SMALL) {
              console.log(`Channel size too small for ${lsp.name} - not showing cached data`);
              return { ...livePrice, source: 'unavailable' as const };
            }
            
            // Return cached data with live fetch error information
            return {
              ...cachedPrice,
              source: 'cached' as const,
              // Preserve the live fetch error information
              live_fetch_error: livePrice?.error || 'Live fetch failed',
              live_fetch_error_code: livePrice?.error_code || LspErrorCode.BAD_STATUS,
              live_fetch_timestamp: new Date().toISOString(),
              // Keep the cached data timestamp
              cached_timestamp: cachedPrice.timestamp
            };
          } else {
            // No good cached data either - return the live fetch error
            if (livePrice && livePrice.error) {
              console.log(`Live fetch failed for ${lsp.name}: ${livePrice.error}`);
              return { ...livePrice, source: 'unavailable' as const };
            } else {
              console.log(`No data available for ${lsp.name} (no live or cached data)`);
              return {
                lsp_id: lsp.id,
                lsp_name: lsp.name,
                channel_size_sat: channelSizeSat,
                total_fee_msat: 0,
                channel_fee_percent: 0,
                channel_fee_base_msat: 0,
                lease_fee_base_msat: 0,
                lease_fee_basis: 0,
                timestamp: new Date().toISOString(),
                error: 'Unable to fetch live data',
                error_code: LspErrorCode.LIVE_DATA_UNAVAILABLE,
                source: 'unavailable' as const
              };
            }
          }
        }
      } catch (error) {
        console.error(`Error fetching data for ${lsp.name}:`, error);
        // Try cached data as fallback
        const cachedPrice = cachedPrices.find(price => price.lsp_id === lsp.id);
        if (cachedPrice) {
          console.log(`Using cached data for ${lsp.name} (error occurred)`);
          return { ...cachedPrice, source: 'cached' as const };
        } else {
          return {
            lsp_id: lsp.id,
            lsp_name: lsp.name,
            channel_size_sat: channelSizeSat,
            total_fee_msat: 0,
            channel_fee_percent: 0,
            channel_fee_base_msat: 0,
            lease_fee_base_msat: 0,
            lease_fee_basis: 0,
            timestamp: new Date().toISOString(),
            error: 'Unable to fetch live data',
            error_code: LspErrorCode.LIVE_DATA_UNAVAILABLE,
            source: 'unavailable' as const
          };
        }
      }
    });
    
    const prices = await Promise.all(promises);
    
    // Merge successful live data with existing cached data
    const successfulLivePrices = prices.filter(price => 
      price.source === 'live' && 
      !price.error && 
      price.total_fee_msat > 0
    );
    
    if (successfulLivePrices.length > 0) {
      // Get existing cached data
      const existingCachedPrices = await getLatestPricesFromDB(channelSizeSat);
      
      // Merge: new successful data + existing data for LSPs that failed
      const successfulLspIds = new Set(successfulLivePrices.map(p => p.lsp_id));
      const preservedCachedPrices = existingCachedPrices.filter(p => 
        !successfulLspIds.has(p.lsp_id) && 
        !p.error && 
        p.total_fee_msat > 0
      );
      
      const mergedPrices = [...successfulLivePrices, ...preservedCachedPrices];
      
      await savePricesToDB(mergedPrices);
      this.setCachedPrices(channelSizeSat, mergedPrices);
      console.log(`Saved ${successfulLivePrices.length} new + ${preservedCachedPrices.length} preserved prices`);
    } else {
      console.log('No successful live prices to save - preserving existing cached data');
    }
    
    return prices;
  }

  // Convert old error codes to new readable ones
  private createErrorPrice(lspId: string, lspName: string, channelSize: number, errorCode: LspErrorCode, errorMessage: string): LSPPrice {
    return {
      lsp_id: lspId,
      lsp_name: lspName,
      channel_size_sat: channelSize,
      total_fee_msat: 0,
      channel_fee_percent: 0,
      channel_fee_base_msat: 0,
      lease_fee_base_msat: 0,
      lease_fee_basis: 0,
      timestamp: new Date().toISOString(),
      error: errorMessage,
      error_code: errorCode,
      source: 'unavailable' as const
    };
  }

  private convertErrorCodes(price: LSPPrice): LSPPrice {
    if (!price.error_code) return price;
    
    let newErrorCode = price.error_code;
    let newError = price.error;
    
    switch (price.error_code) {
      case 'BAD_STATUS':
        if (price.error?.includes('Peer not connected')) {
          newErrorCode = LspErrorCode.PEER_NOT_CONNECTED;
          newError = 'Peer not connected - please connect to this LSP';
        } else if (price.error?.includes('Contact The Megalith Node')) {
          newErrorCode = LspErrorCode.WHITELIST_REQUIRED;
          newError = 'Whitelist required - contact LSP for access';
        } else if (price.error?.includes('Too many orders')) {
          newErrorCode = LspErrorCode.RATE_LIMITED;
          newError = 'Rate limited - too many requests';
        } else {
          newErrorCode = LspErrorCode.LIVE_DATA_UNAVAILABLE;
          newError = 'Unable to fetch live data';
        }
        break;
      case 'CHANNEL_SIZE_TOO_SMALL':
        newError = 'Channel size too small for this LSP';
        break;
      case 'CHANNEL_SIZE_TOO_LARGE':
        newError = 'Channel size too large for this LSP';
        break;
    }
    
    return {
      ...price,
      error_code: newErrorCode,
      error: newError
    };
  }

  // Get cached prices only (for API endpoint - never fetches live data)
  public async getCachedPricesOnly(channelSizeSat: number = 1000000): Promise<LSPPrice[]> {
    const { getActiveLSPs } = await import('./lsps');
    const activeLSPs = getActiveLSPs();
    
    // Get cached prices from database
    const cachedPrices = await getLatestPricesFromDB(channelSizeSat);
    // Prices are already filtered by channel size in the new structure
    
    // Check in-memory cache if no Redis cache
    let availablePrices = cachedPrices;
    if (availablePrices.length === 0) {
      const inMemoryPrices = this.getCachedPrices(channelSizeSat);
      if (inMemoryPrices && inMemoryPrices.length > 0) {
        console.log(`Using in-memory cache for ${channelSizeSat} sats (${inMemoryPrices.length} prices)`);
        availablePrices = inMemoryPrices.map(price => ({
          ...price,
          source: this.isFreshCachedData(price.timestamp) ? 'live' as const : 'cached' as const,
          stale_seconds: Math.floor((Date.now() - Date.parse(price.timestamp)) / 1000)
        }));
      }
    }
    
    // For each active LSP, return cached data or unavailable message
    const results = await Promise.all(activeLSPs.map(async lsp => {
      let cachedPrice = availablePrices.find(price => price.lsp_id === lsp.id);
      
      // If no good cached data in current cache, try historical data
      if (!cachedPrice || (cachedPrice.error && cachedPrice.total_fee_msat === 0)) {
        console.log(`No good cached data for ${lsp.name}, checking historical data...`);
        try {
          const { getPriceHistory } = await import('./db');
          const historyData = await getPriceHistory(channelSizeSat);
          
          // Find the most recent good historical data for this LSP
          const historicalPrice = historyData
            .filter(entry => entry.prices)
            .flatMap(entry => entry.prices)
            .find(price => 
              price.lsp_id === lsp.id && 
              !price.error && 
              price.total_fee_msat > 0
            );
          
          if (historicalPrice) {
            console.log(`Found historical data for ${lsp.name}: ${historicalPrice.total_fee_msat} msat from ${historicalPrice.timestamp}`);
            cachedPrice = historicalPrice;
          }
        } catch (error) {
          console.error(`Error fetching historical data for ${lsp.name}:`, error);
        }
      }
      
      if (cachedPrice && !cachedPrice.error && cachedPrice.total_fee_msat > 0) {
        console.log(`Returning cached data for ${lsp.name}`);
        return {
          ...cachedPrice,
          source: this.isFreshCachedData(cachedPrice.timestamp) ? 'live' as const : 'cached' as const,
          stale_seconds: Math.floor((Date.now() - Date.parse(cachedPrice.timestamp)) / 1000)
        };
      } else {
        console.log(`No cached data available for ${lsp.name}`);
        return {
          lsp_id: lsp.id,
          lsp_name: lsp.name,
          channel_size_sat: channelSizeSat,
          total_fee_msat: 0,
          channel_fee_percent: 0,
          channel_fee_base_msat: 0,
          lease_fee_base_msat: 0,
          lease_fee_basis: 0,
          timestamp: new Date().toISOString(),
          error: 'Cached data unavailable',
          error_code: LspErrorCode.CACHE_UNAVAILABLE,
          source: 'unavailable' as const
        };
      }
    }));
    
    return results;
  }

  // Get latest prices (from cache or fetch if needed)
  public async getLatestPrices(channelSizeSat: number = 1000000): Promise<LSPPrice[]> {
    // Get cached prices for this channel size
    const cachedPrices = await getLatestPricesFromDB(channelSizeSat);
    
    // Filter cached prices by channel size
    // Prices are already filtered by channel size in the new structure
    
    if (cachedPrices.length === 0) {
      // No cached prices for this channel size in Redis
      // First check in-memory cache
      const inMemoryPrices = this.getCachedPrices(channelSizeSat);
      if (inMemoryPrices && inMemoryPrices.length > 0) {
        console.log(`Using in-memory cache for ${channelSizeSat} sats (${inMemoryPrices.length} prices)`);
        // Mark as cached data
        return inMemoryPrices.map(price => ({
          ...price,
          source: this.isFreshCachedData(price.timestamp) ? 'live' as const : 'cached' as const,
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

  // Get in-memory cache for debug purposes (read-only)
  public getInMemoryCacheSnapshot(): Array<{channelSize: number, prices: LSPPrice[], count: number}> {
    return Array.from(this.inMemoryCache.entries()).map(([channelSize, prices]) => ({
      channelSize,
      prices: [...prices], // Return copy to prevent mutation
      count: prices.length
    }));
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
