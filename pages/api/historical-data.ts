import { NextApiRequest, NextApiResponse } from 'next';
import { getPriceHistory } from '../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { channelSize, days = 30 } = req.query;

  if (!channelSize || isNaN(Number(channelSize))) {
    return res.status(400).json({ 
      success: false, 
      error: 'Valid channel size is required' 
    });
  }

  try {
    const channelSizeNum = Number(channelSize);
    const daysNum = Number(days);
    
    // Calculate the date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - daysNum);

    console.log(`Fetching historical data for ${channelSizeNum} sats from ${startDate.toISOString()} to ${endDate.toISOString()}`);

    // Get historical data from database (new date-based structure)
    const historicalData = await getPriceHistory(1000);
    
    // Process the new structure: each entry is a daily snapshot with arrays of timestamped entries
    let filteredData: Array<{
      timestamp: string;
      lsp_id: string;
      lsp_name: string;
      total_fee_msat: number;
      channel_size: number;
      source: string;
      error: string | null;
    }> = [];
    
    for (const dailyEntry of historicalData) {
      // Check if this daily entry has data for our requested channel size
      const channelKey = `channel_${channelSizeNum}`;
      
      // Handle both old and new data formats
      if (dailyEntry[channelKey]) {
        const channelData = dailyEntry[channelKey];
        
        // New format: has entries array
        if (channelData.entries && Array.isArray(channelData.entries)) {
          channelData.entries.forEach((entry: { timestamp: string; prices: Array<{ lsp_id: string; lsp_name: string; total_fee_msat: number; source: string; error: string | null }> }) => {
            entry.prices.forEach((price: { lsp_id: string; lsp_name: string; total_fee_msat: number; source: string; error: string | null }) => {
              filteredData.push({
                timestamp: entry.timestamp,
                lsp_id: price.lsp_id,
                lsp_name: price.lsp_name,
                total_fee_msat: price.total_fee_msat || 0,
                channel_size: channelData.channelSize,
                source: price.source || 'unknown',
                error: price.error || null
              });
            });
          });
        }
        // Old format: has prices array directly
        else if (channelData.prices && Array.isArray(channelData.prices)) {
          channelData.prices.forEach((price: { lsp_id: string; lsp_name: string; total_fee_msat: number; source: string; error: string | null }) => {
            filteredData.push({
              timestamp: channelData.timestamp,
              lsp_id: price.lsp_id,
              lsp_name: price.lsp_name,
              total_fee_msat: price.total_fee_msat || 0,
              channel_size: channelData.channelSize,
              source: price.source || 'unknown',
              error: price.error || null
            });
          });
        }
      }
    }

    // If no data for the requested channel size, try to get data for 1M sats as fallback
    if (filteredData.length === 0 && channelSizeNum !== 1000000) {
      console.log(`No data for ${channelSizeNum} sats, trying 1M sats as fallback`);
      
      for (const dailyEntry of historicalData) {
        const channelKey = 'channel_1000000';
        if (dailyEntry[channelKey]) {
          const channelData = dailyEntry[channelKey];
          
          // New format: has entries array
          if (channelData.entries && Array.isArray(channelData.entries)) {
            channelData.entries.forEach((entry: { timestamp: string; prices: Array<{ lsp_id: string; lsp_name: string; total_fee_msat: number; source: string; error: string | null }> }) => {
              entry.prices.forEach((price: { lsp_id: string; lsp_name: string; total_fee_msat: number; source: string; error: string | null }) => {
                filteredData.push({
                  timestamp: entry.timestamp,
                  lsp_id: price.lsp_id,
                  lsp_name: price.lsp_name,
                  total_fee_msat: price.total_fee_msat || 0,
                  channel_size: channelData.channelSize,
                  source: price.source || 'unknown',
                  error: price.error || null
                });
              });
            });
          }
          // Old format: has prices array directly
          else if (channelData.prices && Array.isArray(channelData.prices)) {
            channelData.prices.forEach((price: { lsp_id: string; lsp_name: string; total_fee_msat: number; source: string; error: string | null }) => {
              filteredData.push({
                timestamp: channelData.timestamp,
                lsp_id: price.lsp_id,
                lsp_name: price.lsp_name,
                total_fee_msat: price.total_fee_msat || 0,
                channel_size: channelData.channelSize,
                source: price.source || 'unknown',
                error: price.error || null
              });
            });
          }
        }
      }
    }

    // Apply daily averaging for multiple entries per day
    const dailyAveragedData: Array<{
      timestamp: string;
      lsp_id: string;
      lsp_name: string;
      total_fee_msat: number;
      channel_size: number;
      source: string;
      error: string | null;
      daily_average: boolean;
      entry_count: number;
    }> = [];
    const groupedByDate: Record<string, Record<string, Array<{
      timestamp: string;
      lsp_id: string;
      lsp_name: string;
      total_fee_msat: number;
      channel_size: number;
      source: string;
      error: string | null;
    }>>> = {};
    
    // Group data by date and LSP
    filteredData.forEach(entry => {
      try {
        // Validate timestamp before processing
        if (!entry.timestamp) {
          console.warn('Entry missing timestamp:', entry);
          return;
        }
        
        // Fix malformed timestamps (missing leading zero in hour)
        let fixedTimestamp = entry.timestamp;
        if (fixedTimestamp && fixedTimestamp.includes('T') && !fixedTimestamp.includes('T0') && !fixedTimestamp.includes('T1')) {
          // Fix timestamps like "2025-09-21T8:22:00.000Z" to "2025-09-21T08:22:00.000Z"
          fixedTimestamp = fixedTimestamp.replace(/T(\d):/, 'T0$1:');
        }
        
        const dateObj = new Date(fixedTimestamp);
        if (isNaN(dateObj.getTime())) {
          console.warn('Invalid timestamp:', entry.timestamp, 'fixed to:', fixedTimestamp, 'for entry:', entry);
          return;
        }
        
        const date = dateObj.toISOString().split('T')[0]; // YYYY-MM-DD
        const lspKey = entry.lsp_id;
        
        if (!groupedByDate[date]) {
          groupedByDate[date] = {};
        }
        if (!groupedByDate[date][lspKey]) {
          groupedByDate[date][lspKey] = [];
        }
        groupedByDate[date][lspKey].push(entry);
      } catch (error) {
        console.warn('Error processing entry:', entry, error);
      }
    });
    
    // Calculate daily averages for each LSP
    Object.entries(groupedByDate).forEach(([date, lspGroups]) => {
      Object.entries(lspGroups).forEach(([, entries]) => {
        if (entries.length === 0) return;
        
        // Calculate average price for this LSP on this day
        const validPrices = entries.filter(e => e.total_fee_msat > 0);
        if (validPrices.length === 0) return;
        
        const avgPrice = Math.round(
          validPrices.reduce((sum, e) => sum + e.total_fee_msat, 0) / validPrices.length
        );
        
        // Use the most recent entry as base and update the price
        const baseEntry = entries[entries.length - 1]; // Most recent
        dailyAveragedData.push({
          ...baseEntry,
          timestamp: `${date}T12:00:00.000Z`, // Use noon for daily average
          total_fee_msat: avgPrice,
          daily_average: true,
          entry_count: entries.length
        });
      });
    });
    
    // Sort by timestamp (oldest first for chart display)
    dailyAveragedData.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    
    // Use averaged data instead of raw data
    filteredData = dailyAveragedData;

    console.log(`Found ${filteredData.length} historical entries for ${channelSizeNum} sats`);

    res.status(200).json({
      success: true,
      data: filteredData,
      channelSize: channelSizeNum,
      days: daysNum,
      count: filteredData.length,
      dateRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      }
    });

  } catch (error) {
    console.error('Error fetching historical data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch historical data',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
