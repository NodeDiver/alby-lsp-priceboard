import { LSPPrice, LspErrorCode } from './lsp-api';

// Alby API response types based on the actual API structure
export interface AlbyChannelSuggestion {
  paymentMethod: string;
  network: string;
  identifier: string;
  lspType: string;
  type: string;
  lspUrl: string;
  url: string;
  lspNodeAddress: string;
  nodeAddress: string;
  pubkey: string;
  minimumChannelSize: number;
  maximumChannelSize: number;
  name: string;
  image?: string;
  description?: string;
  publicChannelsAllowed: boolean;
  terms?: string;
  contactUrl?: string;
  feeTotalSat1m?: number | null;
  feeTotalSat2m?: number | null;
  feeTotalSat3m?: number | null;
}

// LSP identifier mapping from Alby API to our LSP IDs
const ALBY_LSP_ID_MAPPING: Record<string, string> = {
  'megalith': 'megalith',
  'lnserver': 'lnserver', 
  'olympus': 'olympus',
  'flashsats': 'flashsats'
};

// Channel size mapping for Alby API fields
const CHANNEL_SIZE_MAPPING: Record<number, keyof AlbyChannelSuggestion> = {
  1000000: 'feeTotalSat1m',
  2000000: 'feeTotalSat2m', 
  3000000: 'feeTotalSat3m'
};

/**
 * Fetch channel suggestions from Alby API with timeout and retry
 */
export async function fetchAlbyChannelSuggestions(): Promise<AlbyChannelSuggestion[]> {
  const maxRetries = 1;
  const timeoutMs = 8000;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Fetching Alby channel suggestions (attempt ${attempt + 1}/${maxRetries + 1})`);
      
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      
      const response = await fetch('https://getalby.com/api/internal/channel_suggestions', {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Alby-LSP-PriceBoard/1.0 (+https://github.com/NodeDiver/alby-lsp-priceboard)'
        },
        signal: controller.signal
      });
      
      clearTimeout(timeout);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!Array.isArray(data)) {
        throw new Error('Invalid response format - expected array');
      }
      
      console.log(`✅ Successfully fetched ${data.length} channel suggestions from Alby API`);
      return data as AlbyChannelSuggestion[];
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.warn(`❌ Alby API attempt ${attempt + 1} failed: ${errorMessage}`);
      
      if (attempt === maxRetries) {
        console.error('All Alby API attempts failed, will fallback to LSPS1');
        throw new Error(`Failed to fetch from Alby API after ${maxRetries + 1} attempts: ${errorMessage}`);
      }
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }
  
  throw new Error('This should never be reached');
}

/**
 * Parse Alby API data and convert to our LSPPrice format
 */
export function parseAlbyPriceData(
  albyData: AlbyChannelSuggestion[], 
  requestedChannelSize: number
): LSPPrice[] {
  const results: LSPPrice[] = [];
  
  // Filter for Lightning Network Bitcoin LSPs
  const lightningLSPs = albyData.filter(item => 
    item.paymentMethod === 'lightning' && 
    item.network === 'bitcoin' &&
    ALBY_LSP_ID_MAPPING[item.identifier]
  );
  
  console.log(`Found ${lightningLSPs.length} Lightning Bitcoin LSPs in Alby data`);
  
  for (const albyLSP of lightningLSPs) {
    const lspId = ALBY_LSP_ID_MAPPING[albyLSP.identifier];
    const feeField = CHANNEL_SIZE_MAPPING[requestedChannelSize];
    
    // Check if this LSP supports the requested channel size
    const minSize = albyLSP.minimumChannelSize || 0;
    const maxSize = albyLSP.maximumChannelSize || Infinity;
    
    if (requestedChannelSize < minSize || requestedChannelSize > maxSize) {
      console.log(`${albyLSP.name}: Channel size ${requestedChannelSize} not supported (min: ${minSize}, max: ${maxSize})`);
      continue;
    }
    
    // Get the fee for this channel size
    let totalFeeMsat = 0;
    let hasData = false;
    
    if (feeField && albyLSP[feeField] !== null && albyLSP[feeField] !== undefined) {
      const feeSat = albyLSP[feeField] as number;
      if (feeSat > 0) {
        totalFeeMsat = feeSat * 1000; // Convert sats to msat
        hasData = true;
        console.log(`✅ ${albyLSP.name}: ${feeSat} sats (${totalFeeMsat} msat) for ${requestedChannelSize} sats`);
      }
    }
    
    // Create LSPPrice object
    const lspPrice: LSPPrice = {
      lsp_id: lspId,
      lsp_name: albyLSP.name,
      channel_size_sat: requestedChannelSize,
      total_fee_msat: totalFeeMsat,
      channel_fee_percent: 0, // Not provided by Alby API
      channel_fee_base_msat: 0, // Not provided by Alby API
      lease_fee_base_msat: 0, // Not provided by Alby API
      lease_fee_basis: 0, // Not provided by Alby API
      timestamp: new Date().toISOString(),
      source: 'alby_api'
    };
    
    if (!hasData) {
      // No pricing data available from Alby for this size
      lspPrice.error = 'No pricing data available from Alby API';
      lspPrice.error_code = LspErrorCode.LIVE_DATA_UNAVAILABLE;
      console.log(`⚠️ ${albyLSP.name}: No pricing data for ${requestedChannelSize} sats`);
    }
    
    results.push(lspPrice);
  }
  
  const successCount = results.filter(r => !r.error).length;
  console.log(`📊 Alby API parsing complete: ${successCount}/${results.length} LSPs have pricing data`);
  
  return results;
}

/**
 * Fetch and parse Alby channel suggestions for a specific channel size
 */
export async function fetchAlbyPricesForChannelSize(channelSizeSat: number): Promise<LSPPrice[]> {
  try {
    console.log(`Fetching Alby prices for ${channelSizeSat} sats`);
    const albyData = await fetchAlbyChannelSuggestions();
    const prices = parseAlbyPriceData(albyData, channelSizeSat);
    
    const successCount = prices.filter(p => !p.error).length;
    console.log(`🎯 Alby API result: ${successCount} successful prices for ${channelSizeSat} sats`);
    
    return prices;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Failed to fetch Alby prices for ${channelSizeSat} sats: ${errorMessage}`);
    
    // Return empty array so calling code can fallback to LSPS1
    return [];
  }
}

/**
 * Check if Alby API has data for a specific LSP and channel size
 */
export function albyHasDataForLSP(
  albyPrices: LSPPrice[], 
  lspId: string, 
  channelSizeSat: number
): boolean {
  return albyPrices.some(price => 
    price.lsp_id === lspId && 
    price.channel_size_sat === channelSizeSat &&
    !price.error &&
    price.total_fee_msat > 0
  );
}

/**
 * Get Alby price for a specific LSP and channel size
 */
export function getAlbyPriceForLSP(
  albyPrices: LSPPrice[], 
  lspId: string, 
  channelSizeSat: number
): LSPPrice | null {
  return albyPrices.find(price => 
    price.lsp_id === lspId && 
    price.channel_size_sat === channelSizeSat
  ) || null;
}
