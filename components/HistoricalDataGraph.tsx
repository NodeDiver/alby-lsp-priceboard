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
const Dot = dynamic(() => import('recharts').then(mod => mod.Dot), { ssr: false });

interface HistoricalDataPoint {
  date: string;
  [key: string]: string | number | null; // Dynamic LSP prices (can be null for missing data)
}

interface HistoricalDataGraphProps {
  channelSize: number;
  proMode: boolean;
}

// Custom dot component that only renders when value is not null
const CustomDot = (props: { value: number | null; [key: string]: unknown }) => {
  if (props.value == null) {
    return null;
  }
  return <Dot {...props} r={3} />;
};

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
  const [isDark, setIsDark] = useState(false);

  // Check if channel size requires Pro Mode
  const requiresProMode = channelSize >= 4000000; // 4M sats and above

  // Detect dark mode
  useEffect(() => {
    const checkDarkMode = () => {
      const isDarkMode = document.documentElement.classList.contains('dark');
      setIsDark(isDarkMode);
    };
    
    checkDarkMode();
    
    // Watch for changes to the dark class
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });
    
    return () => observer.disconnect();
  }, []);

  const fetchHistoricalData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // First, get LSP metadata to have a list of LSPs even if no historical data
      const metadataResponse = await fetch('/api/lsp-metadata');
      let lspMetadata: Array<{ name?: string; id?: string }> = [];
      if (metadataResponse.ok) {
        const metadataData = await metadataResponse.json();
        lspMetadata = metadataData.data || [];
      }

      // Fetch 30 days of historical data
      const response = await fetch(`/api/historical-data?channelSize=${channelSize}&days=30`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success) {
        const processedData = processHistoricalData(data.data);
        setHistoricalData(processedData);
        
        // Extract LSP list from historical data, or fall back to metadata
        let lsps: string[] = [];
        if (processedData.length > 0) {
          lsps = Object.keys(processedData[0] || {}).filter(key => key !== 'date');
        } else if (lspMetadata.length > 0) {
          // Fall back to metadata LSPs if no historical data
          lsps = lspMetadata.map((lsp) => lsp.name || lsp.id).filter(Boolean);
        }
        
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
      // Validate timestamp before processing
      if (!entry.timestamp) {
        console.warn('Entry missing timestamp:', entry);
        return;
      }
      
      const dateObj = new Date(entry.timestamp);
      if (isNaN(dateObj.getTime())) {
        console.warn('Invalid timestamp:', entry.timestamp, 'for entry:', entry);
        return;
      }
      
      const date = dateObj.toISOString().split('T')[0]; // Use YYYY-MM-DD format
      const lspName = entry.lsp_name || entry.lsp_id;
      const price = entry.total_fee_msat ? Math.round(entry.total_fee_msat / 1000) : 0; // Convert msat to sats
      
      if (!groupedData[date]) {
        groupedData[date] = {};
      }
      groupedData[date][lspName] = price;
    });

    // Get all unique LSP names
    const allLSPNames = Array.from(new Set(rawData.map(entry => entry.lsp_name || entry.lsp_id)));
    
    // Generate all 30 days
    const allDates: string[] = [];
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      allDates.push(date.toISOString().split('T')[0]); // Use YYYY-MM-DD format
    }
    
    // If we have very little data, show a wider range to include the data we have
    const dataDates = Object.keys(groupedData);
    if (dataDates.length < 3) {
      // Find the oldest data date and show 30 days from there
      const oldestDataDate = new Date(Math.min(...rawData.map(d => new Date(d.timestamp).getTime())));
      allDates.length = 0; // Clear the array
      for (let i = 29; i >= 0; i--) {
        const date = new Date(oldestDataDate);
        date.setDate(date.getDate() + i);
        allDates.push(date.toISOString().split('T')[0]); // Use YYYY-MM-DD format
      }
    }

    // Create data points for all 30 days, filling missing data with null
    return allDates.map(date => {
      const dataPoint: HistoricalDataPoint = { date };
      allLSPNames.forEach(lspName => {
        dataPoint[lspName] = groupedData[date]?.[lspName] ?? null;
      });
      return dataPoint;
    });
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
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-8 text-center">
        <div className="text-gray-500 dark:text-slate-400 mb-4">
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
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-600 mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-slate-300">Loading historical data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-8 text-center">
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
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-8 text-center">
        <div className="text-gray-500 dark:text-slate-400 mb-4">
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
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow">
      <div className="p-6 border-b border-gray-200 dark:border-slate-600">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
          Historical Price Data - {channelSize / 1000000}M sats
        </h3>
        <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">
          Last 30 days of pricing data
        </p>
      </div>
      
      <div className="flex">
        {/* Chart Area */}
        <div className="flex-1 p-6">
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={historicalData}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#475569" : "#f0f0f0"} />
                <XAxis 
                  dataKey="date" 
                  stroke={isDark ? "#cbd5e1" : "#6b7280"}
                  fontSize={12}
                  tick={{ fill: isDark ? "#cbd5e1" : "#6b7280" }}
                  tickFormatter={(value) => {
                    const date = new Date(value + 'T00:00:00'); // Add time to make it a valid date
                    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                  }}
                />
                <YAxis 
                  stroke={isDark ? "#cbd5e1" : "#6b7280"}
                  fontSize={12}
                  tick={{ fill: isDark ? "#cbd5e1" : "#6b7280" }}
                  tickFormatter={formatPrice}
                  label={{ 
                    value: 'Price (sats)', 
                    angle: -90, 
                    position: 'insideLeft', 
                    style: { textAnchor: 'middle', fill: isDark ? "#cbd5e1" : "#6b7280" } 
                  }}
                />
                <Tooltip 
                  labelFormatter={(value) => {
                    const date = new Date(value + 'T00:00:00'); // Add time to make it a valid date
                    return date.toLocaleDateString();
                  }}
                  formatter={(value: number) => [`${formatPrice(value)} sats`, '']}
                  contentStyle={{
                    backgroundColor: isDark ? '#1e293b' : '#f9fafb',
                    border: isDark ? '1px solid #475569' : '1px solid #e5e7eb',
                    borderRadius: '6px',
                    fontSize: '12px',
                    color: isDark ? '#cbd5e1' : '#374151'
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
                      dot={<CustomDot />}
                      activeDot={{ r: 5 }}
                      connectNulls={true}
                    />
                  )
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* LSP Legend Sidebar */}
        <div className="w-48 border-l border-gray-200 dark:border-slate-600 p-4 bg-gray-50 dark:bg-slate-700">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-slate-200 mb-3">LSPs</h4>
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
