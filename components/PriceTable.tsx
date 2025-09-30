import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { getLSPById } from '../lib/lsps';
import { convertSatsToCurrency, CurrencyConversion } from '../lib/currency';
import { Tooltip } from './Tooltip';

// Helper functions for unit conversion
const msatToSat = (msat: number) => Math.round(msat / 1000);
const formatSats = (sats: number) =>
  sats >= 1_000_000 ? `${(sats / 1_000_000).toFixed(1)}M` :
  sats >= 1_000 ? `${(sats / 1_000).toFixed(1)}K` : `${sats}`;

export interface DisplayPrice {
  lsp_id: string;
  lsp_name: string;
  channel_size: number;
  price: number;
  channel_fee_percent: number;
  channel_fee_base_msat: number;
  lease_fee_base_msat: number;
  lease_fee_basis: number;
  timestamp: string;
  error: string | null;
  source?: 'live' | 'cached' | 'unavailable' | 'unknown';
  stale_seconds?: number | null;
  error_code?: string | null;
  // New fields for cached data with live fetch errors
  live_fetch_error?: string;
  live_fetch_error_code?: string;
  live_fetch_timestamp?: string;
  cached_timestamp?: string;
}

interface LSPMetadata {
  id: string;
  name: string;
  metadata?: {
    logo?: string;
    icon?: string;
  };
}

interface PriceTableProps {
  prices: DisplayPrice[];
  loading?: boolean;
  lspMetadata?: LSPMetadata[];
  selectedChannelSize?: number;
  selectedCurrency?: string;
  lastUpdate?: string;
  dataSource?: string;
  dataSourceDescription?: string;
  onRetry?: (lspId: string) => void;
  onForceFetch?: (lspId: string) => void;
  forceFetching?: Record<string, boolean>;
  proMode?: boolean;
}

// Retry Button Component
function RetryButton({ lspId, onRetry }: { lspId: string; onRetry?: (lspId: string) => void }) {
  if (!onRetry) return null;
  
  return (
    <button
      onClick={() => onRetry(lspId)}
      className="ml-2 px-2 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
      title="Retry this LSP"
      aria-label={`Retry fetching data for ${lspId}`}
    >
      🔄 Retry
    </button>
  );
}

// Force Fetch Button Component
function ForceFetchButton({ 
  lspId, 
  onForceFetch, 
  isForceFetching 
}: { 
  lspId: string; 
  onForceFetch?: (lspId: string) => void;
  isForceFetching?: boolean;
}) {
  if (!onForceFetch) return null;
  
  return (
    <button
      onClick={() => onForceFetch(lspId)}
      disabled={isForceFetching}
      className="ml-2 px-2 py-1 text-xs bg-gray-800 text-white rounded hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      title="Force fetch fresh data for this LSP (bypass rate limits)"
      aria-label={`Force fetch fresh data for ${lspId}`}
    >
            {isForceFetching ? '💪 Fetching...' : '💪 Force'}
    </button>
  );
}

// Status Badge Component
function StatusBadge({ source, staleSeconds, errorCode, error, timestamp, live_fetch_error, live_fetch_error_code, live_fetch_timestamp, cached_timestamp }: { 
  source?: string; 
  staleSeconds?: number | null; 
  errorCode?: string | null;
  error?: string | null;
  timestamp?: string;
  live_fetch_error?: string;
  live_fetch_error_code?: string;
  live_fetch_timestamp?: string;
  cached_timestamp?: string;
}) {
  if (errorCode) {
    const getErrorIcon = (code: string) => {
      switch (code) {
        case 'URL_NOT_FOUND': return '🌐';
        case 'DNS_ERROR': return '🔍';
        case 'CONNECTION_REFUSED': return '🚫';
        case 'NETWORK_ERROR': return '📡';
        case 'TIMEOUT': return '⏱️';
        case 'TLS_ERROR': return '🔒';
        case 'RATE_LIMITED': return '🚫';
        case 'BAD_STATUS': return '⚠️';
        case 'INVALID_JSON': return '📄';
        case 'SCHEMA_MISMATCH': return '🔧';
        case 'CHANNEL_SIZE_TOO_SMALL': return '📏';
        case 'CHANNEL_SIZE_TOO_LARGE': return '📏';
        case 'CACHE_UNAVAILABLE': return '💾';
        case 'LIVE_DATA_UNAVAILABLE': return '📡';
        case 'PEER_NOT_CONNECTED': return '🔗';
        case 'WHITELIST_REQUIRED': return '🔐';
        default: return '❌';
      }
    };

    const getErrorColor = (code: string) => {
      switch (code) {
        case 'URL_NOT_FOUND': return 'bg-gray-200 text-gray-700';
        case 'DNS_ERROR': return 'bg-gray-200 text-gray-700';
        case 'CONNECTION_REFUSED': return 'bg-gray-300 text-gray-600';
        case 'NETWORK_ERROR': return 'bg-gray-300 text-gray-600';
        case 'TIMEOUT': return 'bg-gray-200 text-gray-700';
        case 'TLS_ERROR': return 'bg-gray-300 text-gray-600';
        case 'RATE_LIMITED': return 'bg-gray-400 text-gray-500';
        case 'BAD_STATUS': return 'bg-gray-300 text-gray-600';
        case 'INVALID_JSON': return 'bg-gray-200 text-gray-700';
        case 'SCHEMA_MISMATCH': return 'bg-gray-200 text-gray-700';
        case 'CHANNEL_SIZE_TOO_SMALL': return 'bg-orange-100 text-orange-800';
        case 'CHANNEL_SIZE_TOO_LARGE': return 'bg-gray-200 text-gray-700';
        case 'CACHE_UNAVAILABLE': return 'bg-gray-200 text-gray-800';
        case 'LIVE_DATA_UNAVAILABLE': return 'bg-gray-300 text-gray-900';
        case 'PEER_NOT_CONNECTED': return 'bg-blue-100 text-blue-600';
        case 'WHITELIST_REQUIRED': return 'bg-purple-100 text-purple-600';
        default: return 'bg-gray-300 text-gray-600';
      }
    };

    return (
      <div className="flex flex-col space-y-1">
        <span 
          className={`inline-flex items-center px-2 py-1 rounded-full text-sm font-medium ${getErrorColor(errorCode)}`}
          title={error || `Error: ${errorCode}`}
          aria-label={`Error: ${errorCode.replace(/_/g, ' ').toLowerCase()}`}
        >
          {getErrorIcon(errorCode)} {errorCode.replace(/_/g, ' ').toLowerCase()}
        </span>
        {timestamp && (
          <span className="text-xs text-gray-500">
            Last: {new Date(timestamp).toLocaleDateString()} <span title={new Date(timestamp).toLocaleTimeString()} className="cursor-pointer">🕒</span>
          </span>
        )}
      </div>
    );
  }

  switch (source) {
    case 'live':
      return (
        <div className="flex flex-col space-y-1">
          <span className="inline-flex items-center px-2 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800" aria-label="Live data - fresh from LSP">
            <span className="w-2 h-2 rounded-full bg-green-500 mr-1"></span>Live
          </span>
          {timestamp && (
            <span className="text-xs text-gray-500">
              Last: {new Date(timestamp).toLocaleDateString()} <span title={new Date(timestamp).toLocaleTimeString()} className="cursor-pointer">🕒</span>
            </span>
          )}
        </div>
      );
    case 'cached':
      const minutes = staleSeconds ? Math.floor(staleSeconds / 60) : 0;
      
      // Check if this is cached data with a live fetch error
      if (live_fetch_error && live_fetch_error_code) {
        return (
          <div className="flex flex-col space-y-1">
            <div className="flex flex-col space-y-1">
              <span className="inline-flex items-center px-2 py-1 rounded-full text-sm font-medium bg-gray-300 text-gray-700" title={`Cached ${minutes}m ago`} aria-label={`Cached data, ${minutes} minutes old`}>
                <span className="w-2 h-2 rounded-full bg-green-700 mr-1"></span>Cached
              </span>
              <span className="inline-flex items-center px-2 py-1 rounded-full text-sm font-medium bg-gray-300 text-gray-600" title={`Live fetch failed: ${live_fetch_error}`} aria-label={`Live fetch failed: ${live_fetch_error}`}>
                <span className="w-2 h-2 rounded-full bg-gray-600 mr-1"></span>⚠️ bad status
              </span>
            </div>
            {cached_timestamp && (
              <span className="text-xs text-gray-500">
                Cached: {new Date(cached_timestamp).toLocaleDateString()} <span title={new Date(cached_timestamp).toLocaleTimeString()} className="cursor-pointer">🕒</span>
              </span>
            )}
            {live_fetch_timestamp && (
              <span className="text-xs text-gray-500">
                Failed: {new Date(live_fetch_timestamp).toLocaleDateString()} <span title={new Date(live_fetch_timestamp).toLocaleTimeString()} className="cursor-pointer">🕒</span>
              </span>
            )}
          </div>
        );
      }
      
      // Regular cached data without live fetch error
      return (
        <div className="flex flex-col space-y-1">
              <span className="inline-flex items-center px-2 py-1 rounded-full text-sm font-medium bg-gray-300 text-gray-700" title={`Cached ${minutes}m ago`} aria-label={`Cached data, ${minutes} minutes old`}>
            <span className="w-2 h-2 rounded-full bg-green-700 mr-1"></span>Cached
          </span>
          {timestamp && (
            <span className="text-xs text-gray-500">
              Last: {new Date(timestamp).toLocaleDateString()} <span title={new Date(timestamp).toLocaleTimeString()} className="cursor-pointer">🕒</span>
            </span>
          )}
        </div>
      );
    case 'unavailable':
      return (
        <div className="flex flex-col space-y-1">
          <span className="inline-flex items-center px-2 py-1 rounded-full text-sm font-medium bg-gray-400 text-white" title="LSP unavailable" aria-label="LSP unavailable">
            <span className="w-2 h-2 rounded-full bg-gray-600 mr-1"></span>Unavailable
          </span>
          {timestamp && (
            <span className="text-xs text-gray-500">
              Last: {new Date(timestamp).toLocaleDateString()} <span title={new Date(timestamp).toLocaleTimeString()} className="cursor-pointer">🕒</span>
            </span>
          )}
        </div>
      );
    default:
      return (
        <div className="flex flex-col space-y-1">
          <span className="inline-flex items-center px-2 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800" aria-label="Unknown data source">
            <span className="w-2 h-2 rounded-full bg-gray-500 mr-1"></span>Unknown
          </span>
          {timestamp && (
            <span className="text-xs text-gray-500">
              Last: {new Date(timestamp).toLocaleDateString()} <span title={new Date(timestamp).toLocaleTimeString()} className="cursor-pointer">🕒</span>
            </span>
          )}
        </div>
      );
  }
}

// LSP Icon Component with proper fallback
function LSPIcon({ lspName, lspData }: { lspName: string; lspData?: LSPMetadata }) {
  const [imageError, setImageError] = useState(false);
  
  // Get icon URL from LSP metadata (following Alby Hub pattern)
  const iconUrl = lspData?.metadata?.logo || lspData?.metadata?.icon;
  
  if (imageError || !iconUrl) {
    return (
      <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
        <span className="text-gray-800 font-bold text-sm">
          {lspName.charAt(0).toUpperCase()}
        </span>
      </div>
    );
  }
  
  return (
    <Image 
      src={iconUrl} 
      alt={`${lspName} logo`}
      width={32}
      height={32}
      className="w-8 h-8 rounded-full object-cover"
      onError={() => setImageError(true)}
    />
  );
}


export function PriceTable({ prices, loading = false, lspMetadata = [], selectedChannelSize = 1000000, selectedCurrency = 'usd', onRetry, onForceFetch, forceFetching = {}, proMode = false }: PriceTableProps) {
  const [currencyConversions, setCurrencyConversions] = useState<{ [key: string]: CurrencyConversion }>({});
  const [conversionLoading, setConversionLoading] = useState(false);

  // Convert only visible prices to selected currency
  useEffect(() => {
    let cancelled = false;

    const convertVisible = async () => {
      if (!prices.length) return;

      setConversionLoading(true);
      // Filter to only the rows we'll show (one per LSP for selected channel size)
      const visible = prices.filter(p => p.channel_size === selectedChannelSize && p.price > 0);

      // Run conversions in parallel
      const entries = await Promise.all(
        visible.map(async p => {
          try {
            // Fix: Convert msat to sats before currency conversion
            const feeSats = msatToSat(p.price);
            const conv = await convertSatsToCurrency(feeSats, selectedCurrency);
            return [`${p.lsp_id}_${p.channel_size}`, conv] as const;
          } catch (e) {
            console.error(`Failed to convert ${p.lsp_id}:`, e);
            return null;
          }
        })
      );

      if (cancelled) return;

      const map: { [k: string]: CurrencyConversion } = {};
      for (const e of entries) if (e) map[e[0]] = e[1];
      setCurrencyConversions(map);
      setConversionLoading(false);
    };

    convertVisible();
    return () => { cancelled = true; };
  }, [prices, selectedCurrency, selectedChannelSize]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="text-lg text-gray-600">Loading prices...</div>
      </div>
    );
  }

  if (!prices || prices.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <div className="mb-4">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">Getting prices from providers...</h3>
        <p className="text-sm text-gray-500 mb-6">
          We&apos;re fetching the latest channel opening fees from Lightning Service Providers.
        </p>
        <div className="flex justify-center space-x-4">
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-slate-500 text-white rounded-md hover:bg-slate-600 transition-colors"
          >
            Refresh Prices
          </button>
          <button 
            onClick={() => window.open('/api/debug', '_blank')}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
          >
            Technical Details
          </button>
        </div>
      </div>
    );
  }

  // Get unique LSPs and sort by lowest price first, then by LSP name for consistency
  const lsps = [...new Set(prices.map(p => p.lsp_id))].sort((a, b) => {
    const priceA = prices.find(p => p.lsp_id === a && !p.error)?.price || Infinity;
    const priceB = prices.find(p => p.lsp_id === b && !p.error)?.price || Infinity;
    
    // Primary sort: by price (lowest first)
    if (priceA !== priceB) {
      return priceA - priceB;
    }
    
    // Secondary sort: by LSP name for consistency when prices are equal
    const nameA = prices.find(p => p.lsp_id === a)?.lsp_name || a;
    const nameB = prices.find(p => p.lsp_id === b)?.lsp_name || b;
    return nameA.localeCompare(nameB);
  });

  return (
    <div className="overflow-x-auto bg-white rounded-lg shadow">
      <table className="w-full border-collapse table-fixed" role="table" aria-label="LSP Price Comparison">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="text-left p-4 text-lg font-semibold text-gray-700 w-2/3" scope="col">Provider</th>
            <th className="text-center p-4 text-lg font-semibold text-gray-700 w-1/3" scope="col">
              Fee
            </th>
          </tr>
        </thead>
        <tbody>
          {lsps.map(lspId => {
            const lspPrices = prices.filter(p => p.lsp_id === lspId);
            const lspName = lspPrices[0]?.lsp_name || lspId;
            // Use metadata if available, otherwise fall back to static data
            const lspData = lspMetadata.find(lsp => lsp.id === lspId) || getLSPById(lspId);
            
            return (
              <tr key={lspId} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="p-4 text-lg font-semibold text-gray-900">
                  <div className="flex items-center space-x-3">
                    <LSPIcon 
                      lspName={lspName} 
                      lspData={lspData}
                    />
                    <div className="flex flex-col">
                      <div className="flex items-center">
                        <span>{lspName}</span>
                        <div className="flex items-center space-x-1">
                          {proMode && lspPrices[0]?.error_code && (
                            <RetryButton lspId={lspId} onRetry={onRetry} />
                          )}
                          {proMode && (lspPrices[0]?.error_code || lspPrices[0]?.source === 'cached') && (
                            <ForceFetchButton 
                              lspId={lspId} 
                              onForceFetch={onForceFetch}
                              isForceFetching={forceFetching[lspId]}
                            />
                          )}
                        </div>
                      </div>
                      <StatusBadge 
                        source={lspPrices[0]?.source}
                        staleSeconds={lspPrices[0]?.stale_seconds}
                        errorCode={lspPrices[0]?.error_code}
                        error={lspPrices[0]?.error}
                        timestamp={lspPrices[0]?.timestamp}
                        live_fetch_error={lspPrices[0]?.live_fetch_error}
                        live_fetch_error_code={lspPrices[0]?.live_fetch_error_code}
                        live_fetch_timestamp={lspPrices[0]?.live_fetch_timestamp}
                        cached_timestamp={lspPrices[0]?.cached_timestamp}
                      />
                    </div>
                  </div>
                </td>
                
                {(() => {
                  const price = lspPrices.find(p => p.channel_size === selectedChannelSize);
                  
                  if (!price) {
                    return (
                      <td className="text-center p-4 text-gray-400">
                        N/A
                      </td>
                    );
                  }

                  // Show cached data if we have live fetch error but cached data is available
                  if (price.live_fetch_error && price.live_fetch_error_code && price.price > 0) {
                    // Show cached data with live fetch error info
                    const conversionKey = `${price.lsp_id}_${price.channel_size}`;
                    const conversion = currencyConversions[conversionKey];
                    
                    return (
                      <td className="text-center p-4">
                        <div className="space-y-2">
                          <div className="text-2xl font-bold text-gray-900">
                            {formatSats(msatToSat(price.price))} sats
                          </div>
                          <div className="text-lg font-semibold text-gray-700">
                            {conversionLoading ? (
                              <span className="text-gray-400">Converting...</span>
                            ) : conversion ? (
                              <div>
                                <div>{conversion.formatted}</div>
                                {conversion.error && (
                                  <div className="text-gray-600 text-xs mt-1">
                                    {conversion.error}
                                  </div>
                                )}
                                {conversion.lastUpdated && (
                                  <div className="text-gray-400 text-xs mt-1">
                                    {new Date(conversion.lastUpdated).toLocaleTimeString()}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-400">N/A</span>
                            )}
                          </div>
                        </div>
                      </td>
                    );
                  }
                  
                  // Only show error if there's no price data at all
                  if (price.error && price.price === 0) {
                    // Special handling for CHANNEL_SIZE_TOO_SMALL
                    if (price.error_code === 'CHANNEL_SIZE_TOO_SMALL') {
                      return (
                        <td className="text-center p-4 text-gray-600">
                          <div className="text-sm">
                            Channels from 2M+
                          </div>
                        </td>
                      );
                    }
                    
                    // Special handling for LNServer Wave 1M channels (they don't support this size)
                    if (price.lsp_id === 'lnserver' && selectedChannelSize === 1000000) {
                      return (
                        <td className="text-center p-4 text-gray-600">
                          <div className="text-sm">
                            Channels from 2M+
                          </div>
                        </td>
                      );
                    }
                    
                    return (
                      <td className="text-center p-4 text-gray-700">
                        Error
                      </td>
                    );
                  }

                  const conversionKey = `${price.lsp_id}_${price.channel_size}`;
                  const conversion = currencyConversions[conversionKey];

                  return (
                    <td className="text-center p-4">
                      <div className="space-y-2">
                        <div className="text-2xl font-bold text-gray-900">
                          {formatSats(msatToSat(price.price))} sats
                        </div>
                        <div className="text-lg font-semibold text-gray-700">
                          {conversionLoading ? (
                            <span className="text-gray-400">Converting...</span>
                          ) : conversion ? (
                            <div>
                              <div>{conversion.formatted}</div>
                              {conversion.error && (
                                <div className="text-gray-600 text-xs mt-1">
                                  {conversion.error}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400">N/A</span>
                          )}
                        </div>
                      </div>
                    </td>
                  );
                })()}
              </tr>
            );
          })}
        </tbody>
      </table>
      
      <div className="p-4 bg-gray-50 text-sm text-gray-600 border-t border-gray-200">
        <div className="flex justify-between items-center">
          <div className="text-sm text-gray-600">
            {prices.length} price entries
          </div>
        </div>
      </div>
    </div>
  );
}
