import { LSPPrice } from './lsp-api';

// Generate mock data for all channel sizes (1M to 10M sats)
function generateMockPrices(): LSPPrice[] {
  const lsps = [
    { id: 'olympus', name: 'Olympus', baseFee: 12000, feePercent: 0.012 },
    { id: 'lnserver', name: 'LNServer Wave', baseFee: 10000, feePercent: 0.01 },
    { id: 'megalith', name: 'Megalith', baseFee: 15000, feePercent: 0.015 },
    { id: 'flashsats', name: 'Flashsats', baseFee: 11000, feePercent: 0.011 },
  ];

  const prices: LSPPrice[] = [];

  // Generate prices for each LSP and each channel size (1M to 10M)
  for (let size = 1; size <= 10; size++) {
    const channelSizeSat = size * 1000000;
    
    lsps.forEach(lsp => {
      // Calculate fee based on channel size (larger channels get better rates)
      const sizeMultiplier = Math.max(0.7, 1 - (size - 1) * 0.03); // Decreasing fee rate for larger channels
      const totalFee = Math.round(lsp.baseFee * size * sizeMultiplier);
      const feePercent = lsp.feePercent * sizeMultiplier;
      
      prices.push({
        lsp_id: lsp.id,
        lsp_name: lsp.name,
        channel_size_sat: channelSizeSat,
        total_fee_msat: totalFee,
        channel_fee_percent: feePercent,
        channel_fee_base_msat: Math.round(totalFee * 0.4),
        lease_fee_base_msat: Math.round(totalFee * 0.6),
        lease_fee_basis: feePercent * 0.6,
        timestamp: new Date().toISOString(),
      });
    });
  }

  return prices;
}

// Mock data for development when Vercel KV is not configured
export const MOCK_PRICES: LSPPrice[] = generateMockPrices();

// Helper function to check if we should use mock data
export function shouldUseMockData(): boolean {
  return !process.env.KV_URL || !process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN;
}

// Get mock prices formatted for display
export function getMockPricesForDisplay() {
  return MOCK_PRICES.map(price => ({
    lsp_id: price.lsp_id,
    lsp_name: price.lsp_name,
    channel_size: price.channel_size_sat,
    price: price.total_fee_msat,
    channel_fee_percent: price.channel_fee_percent,
    channel_fee_base_msat: price.channel_fee_base_msat,
    lease_fee_base_msat: price.lease_fee_base_msat,
    lease_fee_basis: price.lease_fee_basis,
    timestamp: price.timestamp,
    error: null
  }));
}
