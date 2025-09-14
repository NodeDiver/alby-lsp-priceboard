import { LSP } from './lsps';
import { getLastGoodPriceForLSP, saveLatestForLsp } from './db';

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
  UNKNOWN = 'UNKNOWN'
}

// Helper to map errors to typed codes
function toLspError(error: unknown, response?: Response): { code: LspErrorCode; message: string } {
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
  source?: 'live' | 'cached' | 'estimated';
  stale_seconds?: number; // only when cached
  error_code?: LspErrorCode;
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
      signal: AbortSignal.timeout(10000), // 10 second timeout
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
): Promise<LSPS1CreateOrderResponse | null> {
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

    // Build LSPS1-compliant request body
    const orderRequest = buildOrderBodyFor(
      lsp.id, 
      info || {} as LSPS1GetInfoResponse, 
      channelSizeSat, 
      '028260d14351cfddedf5f171da5235fa958349e5d22cd75d9a6e3a8cf3f52aa16c'
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
      signal: AbortSignal.timeout(15000), // 15 second timeout for order creation
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
      return null;
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

function getLspDelay(lspId: string): number {
  const now = Date.now();
  const limit = lspRateLimits[lspId];
  
  if (!limit) {
    // Set initial cooldown based on LSP
    const cooldowns: Record<string, number> = {
      'flashsats': 3 * 60 * 60 * 1000,  // 3 hours for Flashsats (very rate limited)
      'megalith': 60 * 60 * 1000,       // 1 hour for Megalith (whitelist required)
      'olympus': 10 * 60 * 1000,        // 10 minutes for Olympus
      'lnserver-wave': 10 * 60 * 1000,  // 10 minutes for LNServer Wave
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
      const order = await createLSPOrder(lsp, channelSizeSat, infoResult.info);
      if (order) {
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
          await saveLatestForLsp(lsp.id, livePrice);
          
          return livePrice;
        } else {
          console.log(`Invalid order response from ${lsp.name}:`, order);
        }
      }

      // Fallback: Estimate fees based on LSP info and channel size
      console.log(`Using estimated pricing for ${lsp.name} (order creation failed)`);
      const estimatedPrice = estimateLSPPrice(lsp, channelSizeSat);
      
      return {
        lsp_id: lsp.id,
        lsp_name: lsp.name,
        channel_size_sat: channelSizeSat,
        total_fee_msat: estimatedPrice.total_fee_msat,
        channel_fee_percent: estimatedPrice.channel_fee_percent,
        channel_fee_base_msat: estimatedPrice.channel_fee_base_msat,
        lease_fee_base_msat: estimatedPrice.lease_fee_base_msat,
        lease_fee_basis: estimatedPrice.lease_fee_basis,
        timestamp: new Date().toISOString(),
        source: 'estimated',
        error: 'Live fetch failed; showing estimated price'
      };

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
  const cachedPrice = await getLastGoodPriceForLSP(lsp.id);
  if (cachedPrice) {
    const staleSeconds = Math.floor((Date.now() - new Date(cachedPrice.timestamp).getTime()) / 1000);
    console.log(`Using cached price for ${lsp.name} (${staleSeconds}s old)`);
    
    return {
      ...cachedPrice,
      source: 'cached',
      stale_seconds: staleSeconds,
      error: `Live fetch failed: ${lastError}`,
      error_code: LspErrorCode.UNKNOWN
    };
  }

  // No cache available - return error with estimated fallback
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

      // Extract pricing from order
      const totalFeeMsat = extractMsatFromOrder(orderResult as unknown as Record<string, unknown>);
      if (totalFeeMsat === null) {
        lastError = 'Invalid order response';
        continue;
      }

      // Calculate fees
      const channelFeePercent = (orderResult.channel_fee_percent || 0) * 100;
      const channelFeeBaseMsat = orderResult.channel_fee_base_msat || 0;
      const leaseFeeBaseMsat = orderResult.lease_fee_base_msat || 0;
      const leaseFeeBasis = orderResult.lease_fee_basis || 0;

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
        const cachedPrice = await getLastGoodPriceForLSP(lsp.id);
        if (cachedPrice) {
          console.log(`Using cached price for ${lsp.name} as fallback`);
          return {
            ...cachedPrice,
            source: 'cached',
            stale_seconds: Math.floor((Date.now() - Date.parse(cachedPrice.timestamp)) / 1000)
          };
        }
      }
    }
  }

  // No cache available - return error with estimated fallback
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
function createErrorPrice(lsp: LSP, channelSizeSat: number, error: string, errorCode?: LspErrorCode): LSPPrice {
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
    source: 'estimated'
  };
}

// Estimate LSP pricing based on channel size and LSP characteristics
function estimateLSPPrice(lsp: LSP, channelSizeSat: number): {
  total_fee_msat: number;
  channel_fee_percent: number;
  channel_fee_base_msat: number;
  lease_fee_base_msat: number;
  lease_fee_basis: number;
} {
  // Base pricing model - these are realistic estimates based on typical LSP pricing
  const baseFees = {
    olympus: { base: 10000, percent: 0.01 },
    lnserver: { base: 8000, percent: 0.008 },
    megalith: { base: 12000, percent: 0.012 },
    flashsats: { base: 9000, percent: 0.009 }
  };

  const lspPricing = baseFees[lsp.id as keyof typeof baseFees] || { base: 10000, percent: 0.01 };
  
  // Calculate fees based on channel size
  const baseFeeMsat = lspPricing.base * (channelSizeSat / 1000000); // Scale with channel size
  const percentFeeMsat = channelSizeSat * lspPricing.percent * 1000; // Convert to msat
  const totalFeeMsat = Math.round(baseFeeMsat + percentFeeMsat);
  
  // Split fees between channel and lease components
  const channelFeeBaseMsat = Math.round(totalFeeMsat * 0.4);
  const leaseFeeBaseMsat = Math.round(totalFeeMsat * 0.6);
  const channelFeePercent = lspPricing.percent * 0.4;
  const leaseFeeBasis = lspPricing.percent * 0.6;

  return {
    total_fee_msat: totalFeeMsat,
    channel_fee_percent: channelFeePercent,
    channel_fee_base_msat: channelFeeBaseMsat,
    lease_fee_base_msat: leaseFeeBaseMsat,
    lease_fee_basis: leaseFeeBasis
  };
}

// Fetch prices from all active LSPs (matching Alby Hub implementation)
export async function fetchAllLSPPrices(channelSizeSat: number = 1000000, bypassRateLimit: boolean = false): Promise<LSPPrice[]> {
  const { getActiveLSPs } = await import('./lsps');
  const activeLSPs = getActiveLSPs();
  
  console.log(`Fetching prices from ${activeLSPs.length} LSPs for channel size ${channelSizeSat} sats (bypass rate limit: ${bypassRateLimit})`);
  
  // Use Promise.allSettled to ensure all requests complete even if some fail
  const pricePromises = activeLSPs.map(async (lsp) => {
    try {
      if (bypassRateLimit) {
        // Bypass rate limiting by calling fetchLSPPrice with skipRateLimit
        return await fetchLSPPriceBypass(lsp, channelSizeSat);
      } else {
        return await fetchLSPPrice(lsp, channelSizeSat);
      }
    } catch (error) {
      console.error(`Unexpected error fetching from ${lsp.name}:`, error);
      const errorInfo = toLspError(error);
      return createErrorPrice(lsp, channelSizeSat, `Unexpected error: ${errorInfo.message}`, errorInfo.code);
    }
  });
  
  const results = await Promise.allSettled(pricePromises);
  const prices: LSPPrice[] = [];
  
  results.forEach((result, index) => {
    if (result.status === 'fulfilled' && result.value) {
      prices.push(result.value);
    } else if (result.status === 'rejected') {
      const lsp = activeLSPs[index];
      console.error(`Failed to fetch from ${lsp.name}:`, result.reason);
      const errorInfo = toLspError(result.reason);
      prices.push(createErrorPrice(lsp, channelSizeSat, `Promise rejected: ${errorInfo.message}`, errorInfo.code));
    }
  });
  
  const successCount = prices.filter(p => !p.error).length;
  const errorCount = prices.filter(p => p.error).length;
  
  console.log(`Price fetch completed: ${successCount} successful, ${errorCount} errors`);
  
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
