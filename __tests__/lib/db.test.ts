import { LSPPrice } from '../../lib/lsp-api';

// Mock Redis to avoid external dependencies in tests
jest.mock('@upstash/redis', () => ({
  Redis: {
    fromEnv: () => ({
      get: jest.fn(),
      set: jest.fn(),
      keys: jest.fn().mockResolvedValue([]),
      del: jest.fn(),
      pipeline: () => ({
        set: jest.fn(),
        exec: jest.fn().mockResolvedValue([])
      })
    })
  }
}));

// Mock the redis config
jest.mock('../../lib/redis-config', () => ({
  isRedisConfigured: () => false,
  getRedisInstance: () => null
}));

describe('Database Serialization', () => {
  const mockLSPPrice: LSPPrice = {
    lsp_id: 'test-lsp',
    lsp_name: 'Test LSP',
    channel_size: 1000000,
    total_fee_msat: 5000,
    channel_fee_percent: 0,
    channel_fee_base_msat: 0,
    lease_fee_base_msat: 0,
    lease_fee_basis: 0,
    timestamp: '2025-09-19T12:00:00.000Z',
    source: 'live' as const,
    error: null,
    stale_seconds: null,
    error_code: null
  };

  it('should serialize and deserialize LSPPrice correctly', () => {
    const serialized = JSON.stringify(mockLSPPrice);
    const deserialized = JSON.parse(serialized) as LSPPrice;
    
    expect(deserialized.lsp_id).toBe(mockLSPPrice.lsp_id);
    expect(deserialized.lsp_name).toBe(mockLSPPrice.lsp_name);
    expect(deserialized.channel_size).toBe(mockLSPPrice.channel_size);
    expect(deserialized.total_fee_msat).toBe(mockLSPPrice.total_fee_msat);
    expect(deserialized.timestamp).toBe(mockLSPPrice.timestamp);
    expect(deserialized.source).toBe(mockLSPPrice.source);
  });

  it('should handle array of LSPPrice objects', () => {
    const prices = [mockLSPPrice, { ...mockLSPPrice, lsp_id: 'test-lsp-2' }];
    const serialized = JSON.stringify(prices);
    const deserialized = JSON.parse(serialized) as LSPPrice[];
    
    expect(Array.isArray(deserialized)).toBe(true);
    expect(deserialized).toHaveLength(2);
    expect(deserialized[0].lsp_id).toBe('test-lsp');
    expect(deserialized[1].lsp_id).toBe('test-lsp-2');
  });

  it('should handle LSPPrice with error state', () => {
    const errorPrice: LSPPrice = {
      ...mockLSPPrice,
      source: 'unavailable' as const,
      error: 'Network timeout',
      error_code: 'TIMEOUT' as any,
      total_fee_msat: 0
    };

    const serialized = JSON.stringify(errorPrice);
    const deserialized = JSON.parse(serialized) as LSPPrice;
    
    expect(deserialized.source).toBe('unavailable');
    expect(deserialized.error).toBe('Network timeout');
    expect(deserialized.error_code).toBe('TIMEOUT');
    expect(deserialized.total_fee_msat).toBe(0);
  });

  it('should preserve numeric precision', () => {
    const priceWithDecimals: LSPPrice = {
      ...mockLSPPrice,
      total_fee_msat: 1234567890,
      channel_fee_percent: 0.25
    };

    const serialized = JSON.stringify(priceWithDecimals);
    const deserialized = JSON.parse(serialized) as LSPPrice;
    
    expect(deserialized.total_fee_msat).toBe(1234567890);
    expect(deserialized.channel_fee_percent).toBe(0.25);
  });
});
