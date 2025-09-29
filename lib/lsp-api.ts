import { LSP } from './lsps';
// Removed old individual LSP caching functions - using improved structure

// Error taxonomy for better error handling
export enum LspErrorCode {
  URL_NOT_FOUND = 'URL_NOT_FOUND',
  TIMEOUT = 'TIMEOUT',
  BAD_STATUS = 'BAD_STATUS',
  INVALID_JSON = 'INVALID_JSON',
  SCHEMA_MISMATCH = 'SCHEMA_MISMATCH',
  CHANNEL_SIZE_TOO_SMALL = 'CHANNEL_SIZE_TOO_SMALL',
  CHANNEL_SIZE_TOO_LARGE = 'CHANNEL_SIZE_TOO_LARGE',
  RATE_LIMITED = 'RATE_LIMITED',
  TLS_ERROR = 'TLS_ERROR',
  CORS_BLOCKED = 'CORS_BLOCKED',
  PEER_NOT_CONNECTED = 'PEER_NOT_CONNECTED',
  WHITELIST_REQUIRED = 'WHITELIST_REQUIRED',
  LIVE_DATA_UNAVAILABLE = 'LIVE_DATA_UNAVAILABLE',
  CACHE_UNAVAILABLE = 'CACHE_UNAVAILABLE',
  UNKNOWN = 'UNKNOWN'
}

// Helper to map errors to typed codes
export function toLspError(error: unknown, response?: Response): { code: LspErrorCode; message: string } {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    
    if (message.includes('timeout') || message.includes('aborted')) {
      return { code: LspErrorCode.TIMEOUT, message: error.message };
    }
    if (message.includes('tls') || message.includes('certificate')) {
      return { code: LspErrorCode.TLS_ERROR, message: error.message };
    }
    if (message.includes('cors') || message.includes('cross-origin')) {
      return { code: LspErrorCode.CORS_BLOCKED, message: error.message };
    }
    if (message.includes('fetch')) {
      return { code: LspErrorCode.URL_NOT_FOUND, message: error.message };
    }
  }
  
  if (response) {
    if (response.status === 404) {
      return { code: LspErrorCode.URL_NOT_FOUND, message: 'LSP endpoint not found' };
    }
    if (response.status === 429) {
      return { code: LspErrorCode.RATE_LIMITED, message: 'Rate limited by LSP' };
    }
    if (response.status >= 400) {
      // Try to get more specific error from response body
      return { code: LspErrorCode.BAD_STATUS, message: `HTTP ${response.status}` };
    }
  }
  
  return { code: LspErrorCode.UNKNOWN, message: error instanceof Error ? error.message : 'Unknown error' };
}

// Enhanced error mapping for LSP responses
async function mapLspError(response: Response): Promise<{ code: LspErrorCode; message: string }> {
  try {
    const text = await response.text();
    const data = text ? JSON.parse(text) : {};
    const message = data.message || data.error || text;
    
    if (message.includes('connect') || message.includes('peer') || message.includes('not connected')) {
      return { code: LspErrorCode.PEER_NOT_CONNECTED, message: 'Node must be connected to LSP' };
    }
    if (message.includes('token') || message.includes('InvalidToken')) {
      return { code: LspErrorCode.SCHEMA_MISMATCH, message: 'Invalid or missing token' };
    }
    if (message.includes('rate') || message.includes('limit') || message.includes('too many')) {
      return { code: LspErrorCode.RATE_LIMITED, message: 'Rate limited by LSP' };
    }
    if (message.includes('schema') || message.includes('invalid') || message.includes('missing')) {
      return { code: LspErrorCode.SCHEMA_MISMATCH, message: 'Invalid request format' };
    }
    if (message.includes('json') || message.includes('parse')) {
      return { code: LspErrorCode.INVALID_JSON, message: 'Invalid JSON response' };
    }
    
    return { code: LspErrorCode.BAD_STATUS, message: `HTTP ${response.status}: ${message}` };
  } catch {
    return { code: LspErrorCode.BAD_STATUS, message: `HTTP ${response.status}` };
  }
}

// LNServer candidate URLs for autodiscovery
const LNSERVER_CANDIDATES = [
  'https://www.lnserver.com/lsp/wave',        // User's suggestion (likely UI route)
  'https://lnserver.com/lsp/wave',
  'https://lnserver.com/api/v1',              // Typical LSPS1 pattern
  'https://lnserver.com/lsps1/api/v1',
  'https://lsps1.lnserver.com/api/v1',        // Original attempt
  'https://api.lnserver.com/lsps1/api/v1',    // Alternative API subdomain
];

// Cache for resolved LSP base URLs
const resolvedBaseCache = new Map<string, string>();

// Resolve LSP base URL with autodiscovery for LNServer
async function resolveLspBase(lsp: LSP): Promise<string | null> {
  // Allow override via environment variable
  const envKey = `${lsp.id.toUpperCase()}_LSPS1_BASE`;
  const envBase = process.env[envKey as keyof NodeJS.ProcessEnv] as string | undefined;
  if (envBase) {
    console.log(`Using environment override for ${lsp.id}: ${envBase}`);
    return envBase;
  }

  // Check cache first
  if (resolvedBaseCache.has(lsp.id)) {
    return resolvedBaseCache.get(lsp.id)!;
  }

  // For LNServer, try multiple candidates; for others, use the configured URL
  const candidates = lsp.id === 'lnserver' ? LNSERVER_CANDIDATES : [lsp.url];
  
  for (const base of candidates) {
    try {
      const infoUrl = new URL('get_info', base + '/').toString();
      console.log(`Trying LNServer candidate: ${infoUrl}`);
      
      const response = await fetch(infoUrl, {
        method: 'GET',
        headers: { 
          'Accept': 'application/json',
          'User-Agent': 'Alby-LSP-PriceBoard/1.0'
        },
        signal: AbortSignal.timeout(5000)
      });
      
      if (response.ok) {
        console.log(`✅ LNServer endpoint found: ${base}`);
        resolvedBaseCache.set(lsp.id, base);
        return base;
      }
    } catch (error) {
      // Continue to next candidate
      console.log(`❌ LNServer candidate failed: ${base} - ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  console.log(`❌ No working LNServer endpoint found for ${lsp.id}`);
  return null;
}

// LSPS1 Protocol Types (matching actual LSP responses)
export interface LSPS1GetInfoResponse {
  uris: string[];
  min_channel_balance_sat: string;
  max_channel_balance_sat: string;
  min_initial_lsp_balance_sat: string;
  max_initial_lsp_balance_sat: string;
  min_initial_client_balance_sat: string;
  max_initial_client_balance_sat: string;
  max_channel_expiry_blocks: number;
  min_funding_confirms_within_blocks: number;
  min_required_channel_confirmations: number;
  supports_zero_channel_reserve: boolean;
  // Legacy options field for backward compatibility
  options?: {
    channel_lease_ms: number;
    channel_fee_percent: number;
    channel_fee_base_msat: number;
    lease_fee_base_msat: number;
    lease_fee_basis: number;
    max_channel_lease_msat: number;
    min_channel_lease_msat: number;
    max_lease_fee_msat: number;
    min_lease_fee_msat: number;
    max_channel_lease_ms: number;
    min_channel_lease_ms: number;
  };
}

export interface LSPS1CreateOrderRequest {
  lsp_id: string;
  channel_size_sat: number;
  announce_channel: boolean; // Fixed: was announcement_channel
  channel_expiry_blocks: number; // Fixed: was channel_lease_ms
  public_key: string;
  lsp_balance_sat: number;
  client_balance_sat: number;
}

export interface LSPS1CreateOrderResponse {
  order_id: string;
  channel_size_sat: number;
  channel_fee_percent: number;
  channel_fee_base_msat: number;
  lease_fee_base_msat: number;
  lease_fee_basis: number;
  total_fee_msat: number;
}

// Additional LSPS1 types for comprehensive LSP integration
export interface LSPS1ChannelInfo {
  channel_id: string;
  channel_point: string;
  lsp_id: string;
  channel_size_sat: number;
  channel_fee_percent: number;
  channel_fee_base_msat: number;
  lease_fee_base_msat: number;
  lease_fee_basis: number;
  total_fee_msat: number;
  created_at: string;
  expires_at: string;
  status: 'pending' | 'open' | 'closed';
}

export interface LSPS1InvoiceRequest {
  lsp_id: string;
  channel_size_sat: number;
  description?: string;
  expiry?: number;
}

export interface LSPS1InvoiceResponse {
  payment_request: string;
  payment_hash: string;
  amount_msat: number;
  description: string;
  expiry: number;
  created_at: string;
}


export interface LSPPrice {
  lsp_id: string;
  lsp_name: string;
  channel_size_sat: number;
  total_fee_msat: number;
  channel_fee_percent: number;
  channel_fee_base_msat: number;
  lease_fee_base_msat: number;
  lease_fee_basis: number;
  timestamp: string;
  error?: string;
  source?: 'live' | 'cached' | 'unavailable';
  stale_seconds?: number; // only when cached
  error_code?: LspErrorCode;
  raw_lsp_error?: unknown; // Store exact LSP error response for debugging
  // New fields for cached data with live fetch errors
  live_fetch_error?: string; // Error from failed live fetch
  live_fetch_error_code?: LspErrorCode; // Error code from failed live fetch
  live_fetch_timestamp?: string; // Timestamp of failed live fetch
  cached_timestamp?: string; // Timestamp of cached data being shown
}


// Fetch LSP info using LSPS1 protocol (matching Alby Hub implementation)
export async function fetchLSPInfo(lsp: LSP): Promise<{ info: LSPS1GetInfoResponse | null; error?: { code: LspErrorCode; message: string } }> {
  try {
    // Resolve the base URL (with autodiscovery for LNServer)
    const baseUrl = await resolveLspBase(lsp);
    if (!baseUrl) {
      const errorInfo = { code: LspErrorCode.URL_NOT_FOUND, message: 'LSP endpoint not found or not published' };
      console.error(`No working endpoint found for ${lsp.name}: ${errorInfo.message}`);
      return { info: null, error: errorInfo };
    }

    // URL safety: prevent double slashes
    const infoUrl = new URL('get_info', baseUrl + '/').toString();
    const response = await fetch(infoUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Alby-LSP-PriceBoard/1.0',
      },
      // Add timeout to prevent hanging requests
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });

    if (!response.ok) {
      const errorInfo = toLspError(null, response);
      console.error(`Failed to fetch info from ${lsp.name}: ${response.status} ${response.statusText} - ${errorInfo.message}`);
      return { info: null, error: errorInfo };
    }

    const data = await response.json();
    
    // Validate the response structure
    if (!data.uris || !Array.isArray(data.uris)) {
      console.error(`Invalid response structure from ${lsp.name}:`, data);
      return { info: null, error: { code: LspErrorCode.SCHEMA_MISMATCH, message: 'Invalid response structure' } };
    }

    return { info: data };
  } catch (error) {
    const errorInfo = toLspError(error);
    console.error(`Error fetching info from ${lsp.name}: ${errorInfo.message}`, error);
    console.error(`Error details:`, { error, errorInfo });
    return { info: null, error: errorInfo };
  }
}

// Get LSP-specific client public key
function getClientPubkeyForLSP(lspId: string): string {
  const lspPubkeys: Record<string, string> = {
    'flashsats': '02e36a9c9e03ffc4bbf1bc9df64bdacd7736d4c97c01a1930578154a4c616ff478', // Dedicated key for Flashsats
    'megalith': '0281575be148ae504458428cf31985b356d108e2c1bed1cc770f7ecef0bb593713', // Dedicated key for Megalith
    // Default key for all other LSPs
    'default': '028260d14351cfddedf5f171da5235fa958349e5d22cd75d9a6e3a8cf3f52aa16c'
  };
  
  return lspPubkeys[lspId] || lspPubkeys['default'];
}

// Build a strictly LSPS1-friendly body (strings + correct field names)
function buildOrderBodyFor(lspId: string, info: LSPS1GetInfoResponse, channelSizeSat: number, clientPubkey: string) {
  const sats = String(channelSizeSat);
  const base: Record<string, unknown> = {
    public_key: clientPubkey,                 // YOUR node pubkey
    channel_size_sat: sats,                   // string
    lsp_balance_sat: sats,                    // string
    client_balance_sat: "0",                  // string
    announce_channel: false,                  // correct field name (not announcement_channel)
    // conservative defaults bounded by get_info:
    funding_confirms_within_blocks: info?.min_funding_confirms_within_blocks ?? 6,
    required_channel_confirmations: info?.min_required_channel_confirmations ?? 3,
    channel_expiry_blocks: Math.min(13140, info?.max_channel_expiry_blocks ?? 144),
  };

  // Provider-specific tweaks if needed:
  const overrides: Record<string, Record<string, unknown>> = {
    olympus: { /* keep token off */ },
    megalith: { /* keep token off; ensure strings */ },
    flashsats: { /* parse fee from payment.bolt11 fallback */ },
  };
  
  return { ...base, ...(overrides[lspId] ?? {}) };
}

// Create order to get pricing using LSPS1 protocol (matching Alby Hub implementation)
export async function createLSPOrder(
  lsp: LSP, 
  channelSizeSat: number = 1000000,
  info?: LSPS1GetInfoResponse
): Promise<LSPS1CreateOrderResponse | { error: { code: LspErrorCode; message: string }; rawLspError?: unknown } | null> {
  try {
    // Validate channel size against LSP limits
    if (info) {
      const minChannelBalance = parseInt(info.min_channel_balance_sat, 10);
      const maxChannelBalance = parseInt(info.max_channel_balance_sat, 10);
      
      if (channelSizeSat < minChannelBalance) {
        console.error(`${lsp.name}: Channel size too small. Requested: ${channelSizeSat}, Min: ${minChannelBalance}`);
        return null;
      }
      if (channelSizeSat > maxChannelBalance) {
        console.error(`${lsp.name}: Channel size too large. Requested: ${channelSizeSat}, Max: ${maxChannelBalance}`);
        return null;
      }
    }

    // Build LSPS1-compliant request body with LSP-specific public key
    const clientPubkey = getClientPubkeyForLSP(lsp.id);
    const orderRequest = buildOrderBodyFor(
      lsp.id, 
      info || {} as LSPS1GetInfoResponse, 
      channelSizeSat, 
      clientPubkey
    );

    // Resolve the base URL (with autodiscovery for LNServer)
    const baseUrl = await resolveLspBase(lsp);
    if (!baseUrl) {
      const errorInfo = { code: LspErrorCode.URL_NOT_FOUND, message: 'LSP endpoint not found or not published' };
      console.error(`No working endpoint found for ${lsp.name}: ${errorInfo.message}`);
      return null;
    }

    // URL safety: prevent double slashes
    const orderUrl = new URL('create_order', baseUrl + '/').toString();
    
    // Log the request for debugging
    console.log(`Creating order with ${lsp.name}:`, JSON.stringify(orderRequest, null, 2));
    
    const response = await fetch(orderUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Alby-LSP-Priceboard/1.0 (+https://github.com/NodeDiver/alby-lsp-priceboard)',
      },
      body: JSON.stringify(orderRequest),
      // Add timeout to prevent hanging requests  
      signal: AbortSignal.timeout(8000), // 8 second timeout for order creation
    });

    // Read response body safely (never lose it)
    const rawBody = await response.text().catch(() => '');
    let data: unknown = null;
    try { 
      data = rawBody ? JSON.parse(rawBody) : null; 
    } catch (parseError) {
      console.error(`${lsp.name} response parse error:`, parseError);
    }

    if (!response.ok) {
      const errorInfo = await mapLspError(response);
      // Always log the full response body for debugging
      console.error(`[${lsp.name}] ${response.status} ${response.statusText} body:`, rawBody || '(empty)');
      console.error(`Failed to create order with ${lsp.name}: ${response.status} ${response.statusText} - ${errorInfo.message}`);
      
      // Store the raw LSP error response for debugging
      const rawLspError = {
        status: response.status,
        statusText: response.statusText,
        body: rawBody,
        headers: Object.fromEntries(response.headers.entries())
      };
      
      return { error: errorInfo, rawLspError };
    }

    // Basic validation - just check if we have some kind of order response
    if (!data || typeof data !== 'object') {
      console.error(`Invalid order response from ${lsp.name}:`, data);
      return null;
    }

    return data as LSPS1CreateOrderResponse;
  } catch (error) {
    const errorInfo = toLspError(error);
    console.error(`Error creating order with ${lsp.name}: ${errorInfo.message}`, error);
    return null;
  }
}

// Per-LSP rate limiting and backoff strategies
const lspRateLimits: Record<string, { lastRequest: number; cooldownMs: number }> = {};

// Export function to get current rate limit status
export function getRateLimitStatus() {
  const now = Date.now();
  const status: Record<string, { lastRequest: string; cooldownMs: number; timeSinceLastRequest: number; remainingCooldown: number; isRateLimited: boolean; remainingMinutes: number; cooldownMinutes: number }> = {};
  
  Object.entries(lspRateLimits).forEach(([lspId, limit]) => {
    const timeSinceLastRequest = now - limit.lastRequest;
    const remainingCooldown = Math.max(0, limit.cooldownMs - timeSinceLastRequest);
    const isRateLimited = remainingCooldown > 0;
    
    status[lspId] = {
      lastRequest: new Date(limit.lastRequest).toISOString(),
      cooldownMs: limit.cooldownMs,
      timeSinceLastRequest: timeSinceLastRequest,
      remainingCooldown: remainingCooldown,
      isRateLimited: isRateLimited,
      remainingMinutes: Math.round(remainingCooldown / (60 * 1000)),
      cooldownMinutes: Math.round(limit.cooldownMs / (60 * 1000))
    };
  });
  
  return status;
}

function getLspDelay(lspId: string): number {
  const now = Date.now();
  const limit = lspRateLimits[lspId];
  
  if (!limit) {
    // Set initial cooldown based on LSP
    const cooldowns: Record<string, number> = {
      'flashsats': 3 * 60 * 60 * 1000,  // 3 hours for Flashsats (very rate limited)
      'megalith': 60 * 60 * 1000,       // 1 hour for Megalith (whitelist required)
      'olympus': 10 * 60 * 1000,        // 10 minutes for Olympus
      'lnserver': 10 * 60 * 1000,  // 10 minutes for LNServer Wave
    };
    
    lspRateLimits[lspId] = {
      lastRequest: now,
      cooldownMs: cooldowns[lspId] || 10 * 60 * 1000  // 10 minutes default
    };
    return 0;
  }
  
  const timeSinceLastRequest = now - limit.lastRequest;
  const remainingCooldown = Math.max(0, limit.cooldownMs - timeSinceLastRequest);
  
  if (remainingCooldown > 0) {
    const minutes = Math.round(remainingCooldown / (60 * 1000));
    console.log(`${lspId} rate limited, waiting ${minutes} minutes (${remainingCooldown}ms)`);
    return remainingCooldown;
  }
  
  limit.lastRequest = now;
  return 0;
}

// Fetch price for a specific LSP with per-LSP fallback logic
export async function fetchLSPPrice(lsp: LSP, channelSizeSat: number = 1000000): Promise<LSPPrice | null> {
  const maxRetries = 2;
  let lastError: string = '';
  
  // Apply per-LSP rate limiting
  const delay = getLspDelay(lsp.id);
  if (delay > 0) {
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Fetching price from ${lsp.name} (attempt ${attempt}/${maxRetries}) for channel size ${channelSizeSat} sats`);

      // First get LSP info to validate the LSP is available
      const infoResult = await fetchLSPInfo(lsp);
      if (!infoResult.info) {
        // Use the error that was already classified in fetchLSPInfo
        lastError = infoResult.error?.message || 'Failed to fetch LSP info';
        const errorCode = infoResult.error?.code || LspErrorCode.UNKNOWN;
        if (attempt < maxRetries) {
          console.log(`Retrying ${lsp.name} in 2 seconds...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
          continue;
        }
        return createErrorPrice(lsp, channelSizeSat, lastError, errorCode);
      }

      // Validate channel size is within LSP limits
      const minChannelBalance = parseInt(infoResult.info.min_channel_balance_sat);
      const maxChannelBalance = parseInt(infoResult.info.max_channel_balance_sat);
      
      if (channelSizeSat < minChannelBalance) {
        lastError = `Channel size too small. Minimum: ${minChannelBalance} sats`;
        return createErrorPrice(lsp, channelSizeSat, lastError, LspErrorCode.CHANNEL_SIZE_TOO_SMALL);
      }

      if (channelSizeSat > maxChannelBalance) {
        lastError = `Channel size too large. Maximum: ${maxChannelBalance} sats`;
        return createErrorPrice(lsp, channelSizeSat, lastError, LspErrorCode.CHANNEL_SIZE_TOO_LARGE);
      }

      // Try to create order to get actual pricing
      const orderResult = await createLSPOrder(lsp, channelSizeSat, infoResult.info);
      if (orderResult && !('error' in orderResult)) {
        const order = orderResult as LSPS1CreateOrderResponse;
        const msat = extractMsatFromOrder(order as unknown as Record<string, unknown>);
        if (msat && msat > 0) {
          console.log(`Successfully fetched price from ${lsp.name}: ${msat} msat`);
          
          const livePrice: LSPPrice = {
            lsp_id: lsp.id,
            lsp_name: lsp.name,
            channel_size_sat: channelSizeSat,
            total_fee_msat: msat,
            channel_fee_percent: order.channel_fee_percent ?? 0,
            channel_fee_base_msat: order.channel_fee_base_msat ?? 0,
            lease_fee_base_msat: order.lease_fee_base_msat ?? 0,
            lease_fee_basis: order.lease_fee_basis ?? 0,
            timestamp: new Date().toISOString(),
            source: 'live'
          };

          // Save this successful price for future fallback
          // Individual LSP caching removed - using improved structure
          
          return livePrice;
        } else {
          console.log(`Invalid order response from ${lsp.name}:`, order);
        }
      }

      // Handle order creation error
      if (orderResult && 'error' in orderResult) {
        console.log(`Order creation failed for ${lsp.name}: ${orderResult.error.message}`);
        return createErrorPrice(lsp, channelSizeSat, orderResult.error.message, orderResult.error.code, orderResult.rawLspError);
      } else {
        console.log(`No live data available for ${lsp.name} (order creation failed)`);
        return createErrorPrice(lsp, channelSizeSat, 'Live fetch failed; no data available', LspErrorCode.BAD_STATUS);
      }

    } catch (error) {
      const errorInfo = toLspError(error);
      lastError = errorInfo.message;
      console.error(`Error fetching price from ${lsp.name} (attempt ${attempt}): ${errorInfo.message}`, error);
      
      if (attempt < maxRetries) {
        console.log(`Retrying ${lsp.name} in 2 seconds...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }

  // All retries failed - try per-LSP fallback
  console.log(`All retries failed for ${lsp.name}, trying cached fallback...`);
  
  // Try to get cached price for this LSP
  // Individual LSP caching removed - using improved structure
  // No cached price available

  // No cache available - return error
  const errorInfo = toLspError(null);
  return createErrorPrice(lsp, channelSizeSat, lastError, errorInfo.code);
}

// Fetch price for a specific LSP bypassing rate limiting
export async function fetchLSPPriceBypass(lsp: LSP, channelSizeSat: number = 1000000): Promise<LSPPrice | null> {
  const maxRetries = 2;
  let lastError: string = '';
  
  // Skip rate limiting - go directly to API calls
  console.log(`Fetching price from ${lsp.name} (bypassing rate limit) for channel size ${channelSizeSat} sats`);

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Fetching price from ${lsp.name} (attempt ${attempt}/${maxRetries}) for channel size ${channelSizeSat} sats`);
      
      // Get LSP info first
      const infoResult = await fetchLSPInfo(lsp);
      if (!infoResult.info) {
        lastError = typeof infoResult.error === 'string' ? infoResult.error : 'Failed to get LSP info';
        continue;
      }

      // Create order to get pricing
      const orderResult = await createLSPOrder(lsp, channelSizeSat, infoResult.info);
      if (!orderResult) {
        lastError = 'Failed to create order';
        continue;
      }

      // Check if we got an error response
      if ('error' in orderResult) {
        lastError = orderResult.error.message;
        continue;
      }

      const order = orderResult as LSPS1CreateOrderResponse;

      // Extract pricing from order
      const totalFeeMsat = extractMsatFromOrder(order as unknown as Record<string, unknown>);
      if (totalFeeMsat === null) {
        lastError = 'Invalid order response';
        continue;
      }

      // Calculate fees
      const channelFeePercent = (order.channel_fee_percent || 0) * 100;
      const channelFeeBaseMsat = order.channel_fee_base_msat || 0;
      const leaseFeeBaseMsat = order.lease_fee_base_msat || 0;
      const leaseFeeBasis = order.lease_fee_basis || 0;

      // Return successful price
      return {
        lsp_id: lsp.id,
        lsp_name: lsp.name,
        channel_size_sat: channelSizeSat,
        total_fee_msat: totalFeeMsat,
        channel_fee_percent: channelFeePercent,
        channel_fee_base_msat: channelFeeBaseMsat,
        lease_fee_base_msat: leaseFeeBaseMsat,
        lease_fee_basis: leaseFeeBasis,
        timestamp: new Date().toISOString(),
        error: undefined,
        source: 'live'
      };
    } catch (error) {
      const errorInfo = toLspError(error);
      lastError = errorInfo.message;
      console.error(`Error fetching from ${lsp.name} (attempt ${attempt}):`, error);
      
      if (attempt === maxRetries) {
        // Try to get cached price as fallback
        // Individual LSP caching removed - using improved structure
        // No cached price available
      }
    }
  }

  // No cache available - return error
  const errorInfo = toLspError(null);
  return createErrorPrice(lsp, channelSizeSat, lastError, errorInfo.code);
}

// Extract pricing from different LSP response formats
function extractMsatFromOrder(order: Record<string, unknown>): number | null {
  // Try direct msat field first
  if (typeof order?.total_fee_msat === 'number') {
    return order.total_fee_msat;
  }

  // Try Flashsats format: payment.bolt11.fee_total_sat or order_total_sat
  const payment = order?.payment as Record<string, unknown> | undefined;
  const bolt11 = payment?.bolt11 as Record<string, unknown> | undefined;
  const feeSat = bolt11?.fee_total_sat ?? bolt11?.order_total_sat;
  if (feeSat != null) {
    const n = typeof feeSat === 'string' ? parseInt(feeSat, 10) : (typeof feeSat === 'number' ? feeSat : 0);
    if (Number.isFinite(n) && n > 0) return n * 1000; // sats -> msat
  }

  // Try other possible fields
  if (typeof order?.fee_total_msat === 'number') return order.fee_total_msat;
  if (typeof order?.total_fee_sat === 'number') return order.total_fee_sat * 1000;
  if (typeof order?.fee_total_sat === 'number') return order.fee_total_sat * 1000;

  return null;
}

// Helper function to create error price response
function createErrorPrice(lsp: LSP, channelSizeSat: number, error: string, errorCode?: LspErrorCode, rawLspError?: unknown): LSPPrice {
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
    error: error,
    error_code: errorCode || LspErrorCode.UNKNOWN,
    raw_lsp_error: rawLspError, // Store the exact LSP error response
    source: 'unavailable'
  };
}


// Fetch prices from all active LSPs (matching Alby Hub implementation)
export async function fetchAllLSPPrices(channelSizeSat: number = 1000000, bypassRateLimit: boolean = false): Promise<LSPPrice[]> {
  const { getActiveLSPs } = await import('./lsps');
  const activeLSPs = getActiveLSPs();
  
  console.log(`Fetching prices from ${activeLSPs.length} LSPs for channel size ${channelSizeSat} sats (bypass rate limit: ${bypassRateLimit})`);
  
  // Use Promise.allSettled with individual timeouts to prevent hanging
  const pricePromises = activeLSPs.map(async (lsp) => {
    try {
      // Special handling for LNServer 1M channels - they don't support this size
      if (lsp.id === 'lnserver' && channelSizeSat === 1000000) {
        console.log(`LNServer doesn't support 1M channels, returning channel size too small error`);
        return createErrorPrice(lsp, channelSizeSat, 'Channel size too small', LspErrorCode.CHANNEL_SIZE_TOO_SMALL, {
          reason: 'LNServer does not support 1M channel size',
          timestamp: new Date().toISOString(),
          lspName: lsp.name
        });
      }
      
      // Add a timeout wrapper for each LSP to prevent hanging
      const timeoutPromise = new Promise<LSPPrice>((_, reject) => {
        setTimeout(() => reject(new Error(`LSP ${lsp.name} timeout after 12 seconds`)), 12000);
      });
      
      const fetchPromise = bypassRateLimit 
        ? fetchLSPPriceBypass(lsp, channelSizeSat)
        : fetchLSPPrice(lsp, channelSizeSat);
      
      // Race between fetch and timeout
      return await Promise.race([fetchPromise, timeoutPromise]);
    } catch (error) {
      console.error(`Error or timeout fetching from ${lsp.name}:`, error);
      const errorInfo = toLspError(error);
      const isTimeout = error instanceof Error && error.message.includes('timeout');
      const errorCode = isTimeout ? LspErrorCode.TIMEOUT : errorInfo.code;
      const errorMessage = isTimeout ? `LSP timeout after 12 seconds` : `Unexpected error: ${errorInfo.message}`;
      
      return createErrorPrice(lsp, channelSizeSat, errorMessage, errorCode, { 
        originalError: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        lspName: lsp.name
      });
    }
  });
  
  const results = await Promise.allSettled(pricePromises);
  const prices: LSPPrice[] = [];
  
  results.forEach((result, index) => {
    const lsp = activeLSPs[index];
    
    if (result.status === 'fulfilled' && result.value) {
      prices.push(result.value);
      console.log(`✅ ${lsp.name}: Success`);
    } else if (result.status === 'rejected') {
      console.error(`❌ ${lsp.name}: Failed -`, result.reason);
      const errorInfo = toLspError(result.reason);
      const isTimeout = result.reason instanceof Error && result.reason.message.includes('timeout');
      
      prices.push(createErrorPrice(lsp, channelSizeSat, 
        isTimeout ? `${lsp.name} timeout after 12 seconds` : `Promise rejected: ${errorInfo.message}`, 
        isTimeout ? LspErrorCode.TIMEOUT : errorInfo.code,
        {
          rejectionReason: result.reason instanceof Error ? result.reason.message : 'Unknown rejection',
          timestamp: new Date().toISOString(),
          lspName: lsp.name,
          channelSize: channelSizeSat
        }
      ));
    }
  });
  
  const successCount = prices.filter(p => !p.error).length;
  const timeoutCount = prices.filter(p => p.error_code === LspErrorCode.TIMEOUT).length;
  console.log(`📊 LSP Fetch Summary: ${successCount} successful, ${timeoutCount} timeouts, ${activeLSPs.length - successCount} total failed`);
  
  return prices;
}

// Additional utility functions for comprehensive LSP integration (matching Alby Hub)

// Fetch LSP metadata and capabilities
export async function fetchLSPCapabilities(lsp: LSP): Promise<{
  lsp: LSP;
  capabilities: LSPS1GetInfoResponse | null;
  isOnline: boolean;
  lastChecked: string;
}> {
  const capabilitiesResult = await fetchLSPInfo(lsp);
  const capabilities = capabilitiesResult.info;
  const isOnline = capabilities !== null;
  const lastChecked = new Date().toISOString();
  
  return {
    lsp,
    capabilities,
    isOnline,
    lastChecked
  };
}

// Get all LSP capabilities in parallel
export async function fetchAllLSPCapabilities(): Promise<Array<{
  lsp: LSP;
  capabilities: LSPS1GetInfoResponse | null;
  isOnline: boolean;
  lastChecked: string;
}>> {
  const { getActiveLSPs } = await import('./lsps');
  const activeLSPs = getActiveLSPs();
  
  const capabilityPromises = activeLSPs.map(lsp => fetchLSPCapabilities(lsp));
  return Promise.all(capabilityPromises);
}

// Validate LSP response data
export function validateLSPResponse(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  
  const response = data as Record<string, unknown>;
  
  // Check for required fields in order response
  if (response.order_id && typeof response.total_fee_msat === 'number') {
    return response.total_fee_msat >= 0;
  }
  
  // Check for required fields in info response (relaxed validation)
  if (response.uris && Array.isArray(response.uris)) {
    // Check for basic LSPS1 fields (options is optional)
    return typeof response.min_channel_balance_sat === 'string' || 
           typeof response.max_channel_balance_sat === 'string' ||
           response.options !== undefined;
  }
  
  return false;
}

// Calculate effective fee rate
export function calculateEffectiveFeeRate(price: LSPPrice): number {
  if (price.channel_size_sat === 0) return 0;
  return (price.total_fee_msat / 1000) / price.channel_size_sat;
}

// Format fee for display
export function formatFee(msat: number): string {
  if (msat >= 1000) {
    return `${(msat / 1000).toFixed(0)} sats`;
  }
  return `${msat} msat`;
}

// Check if LSP supports channel size
export function supportsChannelSize(capabilities: LSPS1GetInfoResponse | null, channelSizeSat: number): boolean {
  if (!capabilities) return false;
  
  // Use the correct fields from LSPS1 spec
  const minChannelBalance = parseInt(capabilities.min_channel_balance_sat || '0');
  const maxChannelBalance = parseInt(capabilities.max_channel_balance_sat || '0');
  
  if (minChannelBalance > 0 && channelSizeSat < minChannelBalance) {
    return false;
  }
  
  if (maxChannelBalance > 0 && channelSizeSat > maxChannelBalance) {
    return false;
  }
  
  return true;
}
