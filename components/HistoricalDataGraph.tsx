import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';

// Dynamically import Recharts components to avoid SSR issues
const LineChart = dynamic(() => import('recharts').then(mod => mod.LineChart), { ssr: false });
const Line = dynamic(() => import('recharts').then(mod => mod.Line), { ssr: false });
const XAxis = dynamic(() => import('recharts').then(mod => mod.XAxis), { ssr: false });
const YAxis = dynamic(() => import('recharts').then(mod => mod.YAxis), { ssr: false });
const CartesianGrid = dynamic(() => import('recharts').then(mod => mod.CartesianGrid), { ssr: false });
const Tooltip = dynamic(() => import('recharts').then(mod => mod.Tooltip), { ssr: false });
const ResponsiveContainer = dynamic(() => import('recharts').then(mod => mod.ResponsiveContainer), { ssr: false });

interface HistoricalDataPoint {
  date: string;
  [key: string]: string | number; // Dynamic LSP prices
}

interface HistoricalDataGraphProps {
  channelSize: number;
  proMode: boolean;
}

const LSP_COLORS = [
  '#6B7280', // Gray-500 - muted
  '#8B5CF6', // Violet-500 - muted
  '#059669', // Emerald-500 - muted
  '#DC2626', // Red-600 - muted
  '#D97706', // Amber-600 - muted
  '#7C3AED', // Violet-600 - muted
  '#0891B2', // Cyan-600 - muted
  '#BE185D', // Pink-700 - muted
];

export function HistoricalDataGraph({ channelSize, proMode }: HistoricalDataGraphProps) {
  const [historicalData, setHistoricalData] = useState<HistoricalDataPoint[]>([]);
  const [lspList, setLspList] = useState<string[]>([]);
  const [visibleLSPs, setVisibleLSPs] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check if channel size requires Pro Mode
  const requiresProMode = channelSize >= 4000000; // 4M sats and above

  const fetchHistoricalData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch 15 days of historical data
      const response = await fetch(`/api/historical-data?channelSize=${channelSize}&days=15`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success) {
        const processedData = processHistoricalData(data.data);
        setHistoricalData(processedData);
        
        // Extract LSP list and initialize visibility
        const lsps = Object.keys(processedData[0] || {}).filter(key => key !== 'date');
        setLspList(lsps.sort());
        
        // Initialize all LSPs as visible
        const initialVisibility: Record<string, boolean> = {};
        lsps.forEach(lsp => {
          initialVisibility[lsp] = true;
        });
        setVisibleLSPs(initialVisibility);
      } else {
        setError(data.message || 'Failed to fetch historical data');
      }
    } catch (err) {
      console.error('Error fetching historical data:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  }, [channelSize]);

  useEffect(() => {
    if (requiresProMode && !proMode) {
      setLoading(false);
      return;
    }

    fetchHistoricalData();
  }, [channelSize, proMode, requiresProMode, fetchHistoricalData]);

  const processHistoricalData = (rawData: Array<{
    timestamp: string;
    lsp_id: string;
    lsp_name: string;
    total_fee_msat: number;
    channel_size: number;
  }>): HistoricalDataPoint[] => {
    // Group data by date and LSP
    const groupedData: Record<string, Record<string, number>> = {};
    
    rawData.forEach((entry) => {
      const date = new Date(entry.timestamp).toLocaleDateString();
      const lspName = entry.lsp_name || entry.lsp_id;
      const price = entry.total_fee_msat ? Math.round(entry.total_fee_msat / 1000) : 0; // Convert msat to sats
      
      if (!groupedData[date]) {
        groupedData[date] = {};
      }
      groupedData[date][lspName] = price;
    });

    // Convert to array format for Recharts
    return Object.entries(groupedData)
      .map(([date, prices]) => ({
        date,
        ...prices
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  };

  const toggleLSPVisibility = (lspName: string) => {
    setVisibleLSPs(prev => ({
      ...prev,
      [lspName]: !prev[lspName]
    }));
  };

  const formatPrice = (value: number) => {
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K`;
    }
    return value.toString();
  };

  if (requiresProMode && !proMode) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <div className="text-gray-500 mb-4">
          <div className="text-4xl mb-2">🔒</div>
          <div className="text-lg font-semibold">Pro Mode Required</div>
        </div>
        <p className="text-gray-600">
          Historical data for {channelSize / 1000000}M sats channels requires Pro Mode
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading historical data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <div className="text-red-500 mb-4">
          <div className="text-4xl mb-2">⚠️</div>
          <div className="text-lg font-semibold">Error Loading Data</div>
        </div>
        <p className="text-gray-600">{error}</p>
      </div>
    );
  }

  if (historicalData.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <div className="text-gray-500 mb-4">
          <div className="text-4xl mb-2">📊</div>
          <div className="text-lg font-semibold">No Historical Data</div>
        </div>
        <p className="text-gray-600">
          No historical data available for {channelSize / 1000000}M sats channels
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">
          Historical Price Data - {channelSize / 1000000}M sats
        </h3>
        <p className="text-sm text-gray-600 mt-1">
          Last 15 days of pricing data
        </p>
      </div>
      
      <div className="flex">
        {/* Chart Area */}
        <div className="flex-1 p-6">
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={historicalData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis 
                  dataKey="date" 
                  stroke="#6b7280"
                  fontSize={12}
                  tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                />
                <YAxis 
                  stroke="#6b7280"
                  fontSize={12}
                  tickFormatter={formatPrice}
                  label={{ value: 'Price (sats)', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip 
                  labelFormatter={(value) => new Date(value).toLocaleDateString()}
                  formatter={(value: number) => [`${formatPrice(value)} sats`, '']}
                  contentStyle={{
                    backgroundColor: '#f9fafb',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    fontSize: '12px'
                  }}
                />
                {lspList.map((lspName, index) => (
                  visibleLSPs[lspName] && (
                    <Line
                      key={lspName}
                      type="monotone"
                      dataKey={lspName}
                      stroke={LSP_COLORS[index % LSP_COLORS.length]}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  )
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* LSP Legend Sidebar */}
        <div className="w-48 border-l border-gray-200 p-4 bg-gray-50">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">LSPs</h4>
          <div className="space-y-2">
            {lspList.map((lspName, index) => (
              <label key={lspName} className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={visibleLSPs[lspName] || false}
                  onChange={() => toggleLSPVisibility(lspName)}
                  className="rounded border-gray-300 text-gray-600 focus:ring-gray-500"
                />
                <div className="flex items-center space-x-2">
                  <div 
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: LSP_COLORS[index % LSP_COLORS.length] }}
                  />
                  <span className="text-sm text-gray-700">{lspName}</span>
                </div>
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
