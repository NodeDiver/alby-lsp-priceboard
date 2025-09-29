import React, { useState, useEffect } from 'react';
import { PriceTable, DisplayPrice } from '../components/PriceTable';
import { LSP } from '../lib/lsps';
import { COMMON_CURRENCIES } from '../lib/currency';
import { Tooltip } from '../components/Tooltip';


export default function Home() {
  const [prices, setPrices] = useState<DisplayPrice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [lspMetadata, setLspMetadata] = useState<LSP[]>([]);
  // Load preferences from localStorage or use defaults
  const [selectedChannelSize, setSelectedChannelSize] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('alby-lsp-channel-size');
      return saved ? Number(saved) : 1000000;
    }
    return 1000000;
  });
  const [selectedCurrency, setSelectedCurrency] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('alby-lsp-currency');
      return saved || 'usd';
    }
    return 'usd';
  });
  const [dataSource, setDataSource] = useState<string>('unknown');
  const [dataSourceDescription, setDataSourceDescription] = useState<string>('');
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [forceFetching, setForceFetching] = useState<Record<string, boolean>>({});
  const [showNotification, setShowNotification] = useState(false);
  const [showApiSection, setShowApiSection] = useState(false);
  const [proMode, setProMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('alby-lsp-pro-mode');
      return saved === 'true';
    }
    return false;
  });

  // Retry function for individual LSPs (non-blocking)
  const handleRetryLSP = async () => {
    try {
      setShowNotification(true);
      setError(null);
      
      // Fetch fresh data for all LSPs (the API will handle per-LSP logic)
      const response = await fetch(`/api/prices?channelSize=${selectedChannelSize}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        setPrices(data.prices);
        setLastUpdate(data.last_update);
        setDataSource(data.data_source);
        setDataSourceDescription(data.data_source_description);
      } else {
        setError(data.message || 'Failed to fetch prices');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setShowNotification(false);
    }
  };

  // Fetch prices from API (non-blocking)
  const fetchPrices = async (channelSize: number = selectedChannelSize, fresh: boolean = false) => {
    // Cancel any in-flight request
    if (abortController) {
      abortController.abort();
    }
    
    const controller = new AbortController();
    setAbortController(controller);
    
    try {
      setError(null);
      
      const url = `/api/prices-ui?channelSize=${channelSize}${fresh ? '&fresh=1' : ''}`;
      
      // Add 20-second timeout to prevent hanging UI
      const timeoutId = setTimeout(() => controller.abort(), 20000);
      
      const response = await fetch(url, { 
        cache: 'no-store',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
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
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          console.error('Request timed out after 20 seconds');
          setError('Request timed out. One or more LSPs are taking too long to respond.');
        } else {
          console.error('Error fetching prices:', err);
          setError(err.message || 'Failed to fetch prices');
        }
      }
    } finally {
      setAbortController(null);
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
    
    // Cleanup function to abort any in-flight requests
    return () => {
      if (abortController) {
        abortController.abort();
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Refresh prices manually (force fresh fetch with live data)
  const handleRefresh = () => {
    setShowNotification(true);
    setLoading(true);
    fetchPrices(selectedChannelSize, true).finally(() => {
      setLoading(false);
      setShowNotification(false);
    });
  };

  // Force fetch prices for a specific LSP (bypass rate limiting and caching)
  const handleForceFetchLSP = async (lspId: string) => {
    try {
      setShowNotification(true);
      setForceFetching(prev => ({ ...prev, [lspId]: true }));
      setError(null);
      
      // Force fetch for specific LSP with fresh=1 to bypass caching
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000); // 20-second timeout
      
      const response = await fetch(`/api/prices-ui?channelSize=${selectedChannelSize}&fresh=1&force=1&lspId=${lspId}`, {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        console.log(`Force fetch successful for ${lspId}:`, data.prices.length, 'prices received');
        setPrices(data.prices);
        setLastUpdate(data.last_update);
        setDataSource(data.data_source);
        setDataSourceDescription(data.data_source_description);
      } else {
        console.error(`Force fetch failed for ${lspId}:`, data.message);
        setError(data.message || `Failed to fetch prices for ${lspId}`);
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        console.error(`Force fetch timeout for ${lspId} after 20 seconds`);
        setError(`${lspId} request timed out. This LSP is taking too long to respond.`);
      } else {
        console.error(`Force fetch error for ${lspId}:`, err);
        setError(err instanceof Error ? err.message : 'Unknown error occurred');
      }
    } finally {
      setForceFetching(prev => ({ ...prev, [lspId]: false }));
      setShowNotification(false);
    }
  };

  // Handle channel size change
  const handleChannelSizeChange = (newChannelSize: number) => {
    setSelectedChannelSize(newChannelSize);
    localStorage.setItem('alby-lsp-channel-size', String(newChannelSize));
    fetchPrices(newChannelSize);
  };

  const handleCurrencyChange = (newCurrency: string) => {
    setSelectedCurrency(newCurrency);
    localStorage.setItem('alby-lsp-currency', newCurrency);
  };

  const handleProModeToggle = () => {
    const newProMode = !proMode;
    setProMode(newProMode);
    localStorage.setItem('alby-lsp-pro-mode', String(newProMode));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <div>
              <h1 className="text-4xl font-bold text-gray-900">
                Alby LSP Price Board
              </h1>
              <p className="mt-2 text-xl text-gray-600">
                Compare how much different Lightning Service Providers charge to open an inbound Lightning channel
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
                <h3 className="text-base font-medium text-red-800">Error loading prices</h3>
                <div className="mt-2 text-base text-red-700">{error}</div>
              </div>
            </div>
          </div>
        )}

        {/* Price Table */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 bg-gray-100 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  <Tooltip text="Lightning Service Providers - companies that open Bitcoin Lightning channels for you">
                    LSP
                  </Tooltip> Price Comparison
                </h2>
                <p className="mt-1 text-sm text-gray-600">
                  Compare Lightning Service Provider fees for different channel sizes
                </p>
              </div>
              
              {/* Channel Size Selector */}
                                        <div className="flex items-center space-x-4">
                            <div className="flex items-center space-x-2">
                              <label htmlFor="channelSize" className="text-sm font-medium text-gray-700">
                                <Tooltip text="How much Bitcoin capacity you want in your Lightning channel">
                                  Channel Size:
                                </Tooltip>
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
                                {COMMON_CURRENCIES.map((currency) => (
                                  <option key={currency.code} value={currency.code}>
                                    {currency.symbol} {currency.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
            </div>
          </div>
          
          {/* Non-blocking loading indicator */}
          {showNotification && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                <span className="text-sm text-blue-700">
                  Force fetching fresh data...
                </span>
              </div>
            </div>
          )}
          
          <PriceTable 
            prices={prices} 
            loading={false} 
            lspMetadata={lspMetadata} 
            selectedChannelSize={selectedChannelSize}
            selectedCurrency={selectedCurrency}
            lastUpdate={lastUpdate || undefined}
            dataSource={dataSource}
            dataSourceDescription={dataSourceDescription}
            onRetry={handleRetryLSP}
            onForceFetch={handleForceFetchLSP}
            forceFetching={forceFetching}
            proMode={proMode}
          />
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex justify-between items-center">
          {/* Data Source Legend */}
          <div className="flex items-center space-x-4 text-sm text-gray-600">
            <div className="flex items-center space-x-2">
              <span>Data sources:</span>
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800" title="Real-time data from LSP APIs"><span className="w-2 h-2 rounded-full bg-green-500 mr-1"></span>Live</span>
              <span className="text-xs text-gray-500">Real-time pricing from LSPs</span>
              <span className="inline-flex items-center px-2 py-1 rounded-full text-sm font-medium bg-gray-300 text-gray-700" title="Previously fetched data"><span className="w-2 h-2 rounded-full bg-green-700 mr-1"></span>Cached</span>
              <span className="text-xs text-gray-500">Previously fetched data</span>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            {proMode && (
              <button
                onClick={handleRefresh}
                disabled={loading}
                className="px-2.5 py-1 text-sm bg-slate-500 text-white rounded-md hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed animate-in fade-in duration-300 ease-out"
                title="Fetch live data from LSPs (respects rate limits)"
                style={{
                  animation: 'fadeInScale 300ms ease-out forwards'
                }}
              >
                {loading ? 'Refreshing Prices...' : 'Refresh Prices'}
              </button>
            )}
            
            {proMode && (
              <button
                onClick={() => window.open('/api/debug', '_blank')}
                className="px-2.5 py-1 text-sm bg-gray-600 text-white rounded-md hover:bg-gray-700 animate-in fade-in duration-300 ease-out"
                style={{
                  animation: 'fadeInScale 300ms ease-out forwards'
                }}
              >
                Technical Details
              </button>
            )}
            
            {/* Pro Mode Toggle */}
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-gray-700">Pro Mode 💪</span>
              <button
                onClick={handleProModeToggle}
                className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 ${
                  proMode ? 'bg-gray-700' : 'bg-gray-200'
                }`}
                role="switch"
                aria-checked={proMode}
                aria-label="Toggle Pro Mode"
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                    proMode ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* API Info - Collapsible */}
        <div className="mt-8 bg-white rounded-lg shadow">
          <button 
            onClick={() => setShowApiSection(!showApiSection)}
            className="w-full px-6 py-4 text-left flex justify-between items-center hover:bg-gray-50 rounded-t-lg"
          >
            <h3 className="text-lg font-semibold text-gray-900">For Developers - Public API Access</h3>
            <svg 
              className={`w-5 h-5 transition-transform ${showApiSection ? 'rotate-180' : ''}`}
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {showApiSection && (
          <div className="px-6 pb-6 border-t border-gray-200">
          <p className="text-base text-gray-500 mb-4 italic">
            {dataSource === 'live' 
              ? `Note: Using live data from LSPs (${dataSourceDescription})`
              : dataSource === 'cached'
              ? `Note: Using cached data (${dataSourceDescription})`
              : dataSource === 'estimated'
              ? 'Note: Using estimated pricing (some LSPs unavailable)'
              : dataSource === 'mixed'
              ? 'Note: Mixed data sources (some live, some cached/estimated)'
              : 'Note: Data source unknown - check debug info for details'
            }
          </p>
          <p className="text-base text-gray-600 mb-4">
            Other applications can access this pricing data via our public REST API:
          </p>
          
          <div className="space-y-4">
            <div>
              <h4 className="text-base font-medium text-gray-900 mb-2">Endpoint</h4>
              <div className="bg-gray-50 rounded p-3 font-mono text-base">
                <div>GET /api/prices</div>
                <div className="text-gray-500 mt-1">Optional: ?channelSize=1000000 (1M-10M sats)</div>
                <div className="text-gray-500 mt-1">Optional: ?fresh=1 (force live fetch)</div>
              </div>
            </div>
            
            <div>
              <h4 className="text-base font-medium text-gray-900 mb-2">Response Format</h4>
              <div className="bg-gray-50 rounded p-3 font-mono text-sm overflow-x-auto">
                <pre>{`{
  "success": true,
  "last_update": "2025-09-05T16:24:06.744Z",
  "total_lsps": 4,
  "data_source": "live",
  "data_source_description": "All LSPs responding with live data",
  "prices": [
    {
      "lsp_id": "olympus",
      "lsp_name": "Olympus", 
      "channel_size": 1000000,
      "price": 12000,
      "price_msat": 12000,
      "channel_fee_percent": 0.012,
      "timestamp": "2025-09-05T16:24:06.744Z",
      "source": "live"
    }
  ]
}`}</pre>
              </div>
            </div>
            
            <div>
              <h4 className="text-base font-medium text-gray-900 mb-2">How to Use</h4>
              <div className="text-base text-gray-600 space-y-2">
                <div>• <strong>No authentication required</strong> - completely open API</div>
                <div>• <strong>CORS enabled</strong> - works from any website</div>
                <div>• <strong>Channel size filtering</strong> - add ?channelSize=2000000 for 2M sats</div>
                <div>• <strong>Fresh data option</strong> - add ?fresh=1 to force live fetch</div>
                <div>• <strong>Price units</strong> - price field contains millisatoshis (msat), divide by 1000 for sats</div>
                <div>• <strong>Real-time data</strong> - prices update every 10 minutes automatically</div>
              </div>
            </div>
            
            <div>
              <h4 className="text-base font-medium text-gray-900 mb-2">Limitations</h4>
              <div className="text-base text-gray-600 space-y-1">
                <div>• Rate limit: ~100 requests/minute (Vercel free tier)</div>
                <div>• Data retention: Public API exposes latest snapshot only (backend stores history)</div>
                <div>• Channel sizes: 1M-10M sats supported</div>
                <div>• LSPs: Currently 4 providers (Olympus, LNServer, Megalith, Flashsats)</div>
                <div>• Price units: All prices returned in millisatoshis (msat)</div>
              </div>
            </div>
          </div>
          
          <div className="mt-4 pt-4 border-t border-gray-200">
            <h4 className="text-base font-medium text-gray-900 mb-2">Current Status</h4>
            <div className="text-sm text-gray-600 space-y-1">
              <div>• ✅ API endpoint active and responding</div>
              {dataSource === 'live' ? (
                <>
                  <div>• ✅ Live LSP data fetching active</div>
                  <div>• ✅ LSPS1 protocol implementation working</div>
                  <div>• ✅ All LSPs responding with real-time data</div>
                </>
              ) : dataSource === 'cached' ? (
                <>
                  <div>• ✅ Cached data available (LSPs temporarily unavailable)</div>
                  <div>• ✅ LSPS1 protocol implementation working</div>
                  <div>• ⚠️ Some LSPs may be unavailable (using cached data)</div>
                </>
              ) : dataSource === 'estimated' ? (
                <>
                  <div>• ✅ Estimated pricing active (LSPs unavailable)</div>
                  <div>• ✅ LSPS1 protocol implementation working</div>
                  <div>• ⚠️ All LSPs unavailable (using estimated pricing)</div>
                </>
              ) : (
                <>
                  <div>• ✅ System operational</div>
                  <div>• ⏳ Vercel KV configuration pending (caching/performance)</div>
                  <div>• ⏳ Cron jobs will activate after Vercel deployment</div>
                </>
              )}
              <div>• Use Technical Details button to check detailed system status</div>
            </div>
          </div>
          </div>
          )}
        </div>

        {/* GitHub Repository Link */}
        <div className="mt-8 bg-white rounded-lg shadow p-6">
          <div className="text-center">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Open Source Project</h3>
            <p className="text-base text-gray-600 mb-4">
              This project is open source and community-driven. Help us improve it!
            </p>
            <div className="flex justify-center space-x-4">
              <a
                href="https://github.com/NodeDiver/alby-lsp-priceboard"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800 transition-colors"
              >
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 0C4.477 0 0 4.484 0 10.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0110 4.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0020 10.017C20 4.484 15.522 0 10 0z" clipRule="evenodd" />
                </svg>
                View on GitHub
              </a>
              <a
                href="https://github.com/NodeDiver/alby-lsp-priceboard/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-4 py-2 bg-slate-700 text-white rounded-md hover:bg-slate-800 transition-colors"
              >
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                Report Issue
              </a>
            </div>
            <p className="text-sm text-gray-500 mt-4">
              Found a bug? Want to request a feature? Need a new LSP added? 
              <br />
              <a href="https://github.com/NodeDiver/alby-lsp-priceboard/issues" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline">
                Open an issue on GitHub
              </a>
            </p>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-12 py-6 border-t border-gray-200 bg-white">
          <div className="text-center">
            <p className="text-base text-gray-500">
              Alby LSP Price Board v0.1 • Open Source Lightning Service Provider Comparison Tool
            </p>
            <p className="text-sm text-gray-400 mt-1">
              Built with Next.js • Data from LSPS1 Protocol • Updated September 2025
            </p>
          </div>
        </footer>
      </main>
    </div>
  );
}
