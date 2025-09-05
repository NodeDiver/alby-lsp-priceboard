import React, { useState, useEffect } from 'react';
import { PriceTable, DisplayPrice } from '../components/PriceTable';
import { LSP } from '../lib/lsps';
import { SUPPORTED_CURRENCIES } from '../lib/currency';

export default function Home() {
  const [prices, setPrices] = useState<DisplayPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [lspMetadata, setLspMetadata] = useState<LSP[]>([]);
  const [selectedChannelSize, setSelectedChannelSize] = useState<number>(1000000); // Default to 1M sats
  const [selectedCurrency, setSelectedCurrency] = useState<string>('usd'); // Default to USD
  const [dataSource, setDataSource] = useState<string>('unknown');
  const [dataSourceDescription, setDataSourceDescription] = useState<string>('');

  // Fetch prices from API
  const fetchPrices = async (channelSize: number = selectedChannelSize) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/prices?channelSize=${channelSize}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success && data.prices) {
        setPrices(data.prices);
        setLastUpdate(data.last_update);
        setDataSource(data.data_source || 'unknown');
        setDataSourceDescription(data.data_source_description || '');
      } else {
        throw new Error(data.message || 'Failed to fetch prices');
      }
    } catch (err) {
      console.error('Error fetching prices:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch prices');
    } finally {
      setLoading(false);
    }
  };

  // Fetch LSP metadata from our API
  const fetchLSPData = async () => {
    try {
      const response = await fetch('/api/lsp-metadata');
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.lsps) {
          setLspMetadata(data.lsps);
        }
      }
    } catch (err) {
      console.error('Error fetching LSP metadata:', err);
    }
  };

  // Fetch prices on component mount
  useEffect(() => {
    fetchPrices();
    fetchLSPData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Refresh prices manually
  const handleRefresh = () => {
    fetchPrices(selectedChannelSize);
  };

  // Handle channel size change
  const handleChannelSizeChange = (newChannelSize: number) => {
    setSelectedChannelSize(newChannelSize);
    fetchPrices(newChannelSize);
  };

  const handleCurrencyChange = (newCurrency: string) => {
    setSelectedCurrency(newCurrency);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Alby LSP Price Board
              </h1>
              <p className="mt-2 text-gray-600">
                Lightning Service Provider price comparison
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Error Display */}
        {error && (
          <div className="mb-8 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error loading prices</h3>
                <div className="mt-2 text-sm text-red-700">{error}</div>
              </div>
            </div>
          </div>
        )}

        {/* Price Table */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 bg-gray-100 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">LSP Price Comparison</h2>
                <p className="mt-1 text-sm text-gray-600">
                  Compare Lightning Service Provider fees for different channel sizes
                </p>
              </div>
              
              {/* Channel Size Selector */}
                                        <div className="flex items-center space-x-4">
                            <div className="flex items-center space-x-2">
                              <label htmlFor="channelSize" className="text-sm font-medium text-gray-700">
                                Channel Size:
                              </label>
                              <select
                                id="channelSize"
                                value={selectedChannelSize}
                                onChange={(e) => handleChannelSizeChange(Number(e.target.value))}
                                className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                              >
                                {Array.from({ length: 10 }, (_, i) => {
                                  const size = (i + 1) * 1000000; // 1M to 10M
                                  return (
                                    <option key={size} value={size}>
                                      {(size / 1000000).toFixed(0)}M sats
                                    </option>
                                  );
                                })}
                              </select>
                            </div>
                            
                            <div className="flex items-center space-x-2">
                              <label htmlFor="currency" className="text-sm font-medium text-gray-700">
                                Currency:
                              </label>
                              <select
                                id="currency"
                                value={selectedCurrency}
                                onChange={(e) => handleCurrencyChange(e.target.value)}
                                className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                              >
                                {SUPPORTED_CURRENCIES.slice(0, 20).map((currency) => (
                                  <option key={currency.code} value={currency.code}>
                                    {currency.symbol} {currency.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
            </div>
          </div>
          <PriceTable 
            prices={prices} 
            loading={loading} 
            lspMetadata={lspMetadata} 
            selectedChannelSize={selectedChannelSize}
            selectedCurrency={selectedCurrency}
            lastUpdate={lastUpdate}
            dataSource={dataSource}
            dataSourceDescription={dataSourceDescription}
          />
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex justify-end">
          <div className="flex items-center space-x-4">
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="px-4 py-2 bg-slate-500 text-white rounded-md hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Refreshing...' : 'Refresh Prices'}
            </button>
            
            <button
              onClick={() => window.open('/api/debug', '_blank')}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
            >
              Debug Info
            </button>
          </div>
        </div>

        {/* API Info */}
        <div className="mt-8 bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Public API Access</h3>
          <p className="text-sm text-gray-500 mb-4 italic">
            Note: Currently using mock data for development - real LSP integration pending
          </p>
          <p className="text-sm text-gray-600 mb-4">
            Other applications can access this pricing data via our public REST API:
          </p>
          
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-2">Endpoint</h4>
              <div className="bg-gray-50 rounded p-3 font-mono text-sm">
                <div>GET /api/prices</div>
                <div className="text-gray-500 mt-1">Optional: ?channelSize=1000000 (1M-10M sats)</div>
              </div>
            </div>
            
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-2">Response Format</h4>
              <div className="bg-gray-50 rounded p-3 font-mono text-xs overflow-x-auto">
                <pre>{`{
  "success": true,
  "last_update": "2025-09-05T16:24:06.744Z",
  "total_lsps": 4,
  "prices": [
    {
      "lsp_id": "olympus",
      "lsp_name": "Olympus", 
      "channel_size": 1000000,
      "price": 12000,
      "channel_fee_percent": 0.012,
      "timestamp": "2025-09-05T16:24:06.744Z"
    }
  ]
}`}</pre>
              </div>
            </div>
            
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-2">How to Use</h4>
              <div className="text-sm text-gray-600 space-y-2">
                <div>• <strong>No authentication required</strong> - completely open API</div>
                <div>• <strong>CORS enabled</strong> - works from any website</div>
                <div>• <strong>Channel size filtering</strong> - add ?channelSize=2000000 for 2M sats</div>
                <div>• <strong>Real-time data</strong> - prices update every 10 minutes automatically</div>
              </div>
            </div>
            
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-2">Limitations</h4>
              <div className="text-sm text-gray-600 space-y-1">
                <div>• Rate limit: ~100 requests/minute (Vercel free tier)</div>
                <div>• Data retention: Latest prices only (no historical data)</div>
                <div>• Channel sizes: 1M-10M sats supported</div>
                <div>• LSPs: Currently 4 providers (Olympus, LNServer, Megalith, Flashsats)</div>
              </div>
            </div>
          </div>
          
          <div className="mt-4 pt-4 border-t border-gray-200">
            <h4 className="text-sm font-medium text-gray-900 mb-2">Current Status</h4>
            <div className="text-xs text-gray-600 space-y-1">
              <div>• ✅ API endpoint active and responding</div>
              <div>• ✅ Mock data enabled for development</div>
              <div>• ⏳ Vercel KV configuration pending (real data storage)</div>
              <div>• ⏳ Cron jobs will activate after Vercel deployment</div>
              <div>• Use Debug Info button to check detailed system status</div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
