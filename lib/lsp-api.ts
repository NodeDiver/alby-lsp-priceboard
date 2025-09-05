import { LSP } from './lsps';

// LSPS1 Protocol Types
export interface LSPS1GetInfoResponse {
  uris: string[];
  options: {
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
  announcement_channel: boolean;
  channel_lease_ms: number;
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
}

// Fetch LSP info using LSPS1 protocol
export async function fetchLSPInfo(lsp: LSP): Promise<LSPS1GetInfoResponse | null> {
  try {
    const response = await fetch(`${lsp.url}/get_info`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`Failed to fetch info from ${lsp.name}: ${response.status}`);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error(`Error fetching info from ${lsp.name}:`, error);
    return null;
  }
}

// Create order to get pricing using LSPS1 protocol
export async function createLSPOrder(
  lsp: LSP, 
  channelSizeSat: number = 1000000
): Promise<LSPS1CreateOrderResponse | null> {
  try {
    const orderRequest: LSPS1CreateOrderRequest = {
      lsp_id: lsp.id,
      channel_size_sat: channelSizeSat,
      announcement_channel: false,
      channel_lease_ms: 86400000, // 24 hours in milliseconds
    };

    const response = await fetch(`${lsp.url}/create_order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderRequest),
    });

    if (!response.ok) {
      console.error(`Failed to create order with ${lsp.name}: ${response.status}`);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error(`Error creating order with ${lsp.name}:`, error);
    return null;
  }
}

// Fetch price for a specific LSP
export async function fetchLSPPrice(lsp: LSP, channelSizeSat: number = 1000000): Promise<LSPPrice | null> {
  try {
    // First get LSP info
    const info = await fetchLSPInfo(lsp);
    if (!info) {
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
        error: 'Failed to fetch LSP info'
      };
    }

    // Then create order to get actual pricing
    const order = await createLSPOrder(lsp, channelSizeSat);
    if (!order) {
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
        error: 'Failed to create order'
      };
    }

    return {
      lsp_id: lsp.id,
      lsp_name: lsp.name,
      channel_size_sat: order.channel_size_sat,
      total_fee_msat: order.total_fee_msat,
      channel_fee_percent: order.channel_fee_percent,
      channel_fee_base_msat: order.channel_fee_base_msat,
      lease_fee_base_msat: order.lease_fee_base_msat,
      lease_fee_basis: order.lease_fee_basis,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error(`Error fetching price from ${lsp.name}:`, error);
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
      error: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

// Fetch prices from all active LSPs
export async function fetchAllLSPPrices(channelSizeSat: number = 1000000): Promise<LSPPrice[]> {
  const { getActiveLSPs } = await import('./lsps');
  const activeLSPs = getActiveLSPs();
  
  const pricePromises = activeLSPs.map(lsp => fetchLSPPrice(lsp, channelSizeSat));
  const prices = await Promise.all(pricePromises);
  
  return prices.filter(price => price !== null) as LSPPrice[];
}
