import React, { useState, useEffect } from 'react';
import { getLSPById } from '../lib/lsps';
import { convertSatsToCurrency, CurrencyConversion } from '../lib/currency';

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
  source?: 'live' | 'cached' | 'estimated' | 'unknown';
  stale_seconds?: number | null;
  error_code?: string | null;
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
}

// Retry Button Component
function RetryButton({ lspId, onRetry }: { lspId: string; onRetry?: (lspId: string) => void }) {
  if (!onRetry) return null;
  
  return (
    <button
      onClick={() => onRetry(lspId)}
      className="ml-2 px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded hover:bg-blue-200 transition-colors"
      title="Retry this LSP"
      aria-label={`Retry fetching data for ${lspId}`}
    >
      🔄 Retry
    </button>
  );
}

// Status Badge Component
function StatusBadge({ source, staleSeconds, errorCode, error }: { 
  source?: string; 
  staleSeconds?: number | null; 
  errorCode?: string | null;
  error?: string | null;
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
        case 'CHANNEL_SIZE_TOO_SMALL': return 'bg-gray-200 text-gray-700';
        case 'CHANNEL_SIZE_TOO_LARGE': return 'bg-gray-200 text-gray-700';
        default: return 'bg-gray-300 text-gray-600';
      }
    };

    return (
      <span 
        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getErrorColor(errorCode)}`}
        title={error || `Error: ${errorCode}`}
        aria-label={`Error: ${errorCode.replace(/_/g, ' ').toLowerCase()}`}
      >
        {getErrorIcon(errorCode)} {errorCode.replace(/_/g, ' ').toLowerCase()}
      </span>
    );
  }

  switch (source) {
    case 'live':
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800" aria-label="Live data - fresh from LSP">
          ✓ Live
        </span>
      );
    case 'cached':
      const minutes = staleSeconds ? Math.floor(staleSeconds / 60) : 0;
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-200 text-gray-700" title={`Cached ${minutes}m ago`} aria-label={`Cached data, ${minutes} minutes old`}>
          ⚠ Cached
        </span>
      );
    case 'estimated':
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-300 text-gray-600" title="Estimated pricing - LSP unavailable" aria-label="Estimated pricing - LSP unavailable">
          ≈ Estimated
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800" aria-label="Unknown data source">
          ? Unknown
        </span>
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
    <img 
      src={iconUrl} 
      alt={`${lspName} logo`}
      className="w-8 h-8 rounded-full object-cover"
      onError={() => setImageError(true)}
    />
  );
}


export function PriceTable({ prices, loading = false, lspMetadata = [], selectedChannelSize = 1000000, selectedCurrency = 'usd', lastUpdate, dataSource, dataSourceDescription, onRetry }: PriceTableProps) {
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
      <div className="text-center py-8 text-gray-500">
        No price data available. Please try again later.
      </div>
    );
  }

  // Get unique LSPs
  const lsps = [...new Set(prices.map(p => p.lsp_id))];

  return (
    <div className="overflow-x-auto bg-white rounded-lg shadow">
      <table className="w-full border-collapse" role="table" aria-label="LSP Price Comparison">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="text-left p-4 font-medium text-gray-700" scope="col">Provider</th>
            <th className="text-center p-4 font-medium text-gray-700" scope="col">Fee</th>
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
                <td className="p-4 font-medium text-gray-900">
                  <div className="flex items-center space-x-3">
                    <LSPIcon 
                      lspName={lspName} 
                      lspData={lspData}
                    />
                    <div className="flex flex-col">
                      <div className="flex items-center">
                        <span>{lspName}</span>
                        {lspPrices[0]?.error_code && (
                          <RetryButton lspId={lspId} onRetry={onRetry} />
                        )}
                      </div>
                      <StatusBadge 
                        source={lspPrices[0]?.source}
                        staleSeconds={lspPrices[0]?.stale_seconds}
                        errorCode={lspPrices[0]?.error_code}
                        error={lspPrices[0]?.error}
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

                  // Only show error if there's no price data at all
                  if (price.error && price.price === 0) {
                    return (
                      <td className="text-center p-4 text-red-500">
                        Error
                      </td>
                    );
                  }

                  const conversionKey = `${price.lsp_id}_${price.channel_size}`;
                  const conversion = currencyConversions[conversionKey];

                  return (
                    <td className="text-center p-4">
                      <div className="space-y-1">
                        <div className="font-semibold text-gray-900">
                          {formatSats(msatToSat(price.price))} sats
                        </div>
                        <div className="text-xs text-gray-500">
                          {conversionLoading ? (
                            <span className="text-gray-400">Converting...</span>
                          ) : conversion ? (
                            <div>
                              <div>{conversion.formatted}</div>
                              {conversion.error && (
                                <div className="text-red-500 text-xs mt-1">
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
                })()}
              </tr>
            );
          })}
        </tbody>
      </table>
      
      <div className="p-4 bg-gray-50 text-sm text-gray-600 border-t border-gray-200">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-2">
            {lastUpdate && (
              <span>Last: {new Date(lastUpdate).toLocaleString()}</span>
            )}
            {dataSource && (
              <div className="flex items-center space-x-2">
                <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                  dataSource === 'live'
                    ? 'bg-gray-100 text-gray-800'
                    : dataSource === 'cached'
                    ? 'bg-gray-200 text-gray-700'
                    : dataSource === 'estimated'
                    ? 'bg-gray-300 text-gray-600'
                    : dataSource === 'mixed'
                    ? 'bg-gray-400 text-gray-500'
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {dataSource === 'live' ? '⚫ Live' :
                   dataSource === 'cached' ? '⚫ Cached' :
                   dataSource === 'estimated' ? '⚫ Estimated' :
                   dataSource === 'mixed' ? '⚫ Mixed' :
                   '⚪ Unknown'}
                </div>
                {dataSourceDescription && (
                  <span className="text-xs text-gray-500" title={dataSourceDescription}>
                    {dataSourceDescription}
                  </span>
                )}
              </div>
            )}
          </div>
          <span>{prices.length} price entries</span>
        </div>
      </div>
    </div>
  );
}
