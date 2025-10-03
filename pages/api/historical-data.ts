import { NextApiRequest, NextApiResponse } from 'next';
import { getPriceHistory } from '../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { channelSize, days = 15 } = req.query;

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
    
    // Process the new structure: each entry is a daily snapshot with all channel sizes
    let filteredData: any[] = [];
    
    for (const dailyEntry of historicalData) {
      // Check if this daily entry has data for our requested channel size
      const channelKey = `channel_${channelSizeNum}`;
      if (dailyEntry[channelKey] && dailyEntry[channelKey].prices) {
        const channelData = dailyEntry[channelKey];
        
        // Add each LSP price from this day
        channelData.prices.forEach((price: any) => {
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

    // If no data for the requested channel size, try to get data for 1M sats as fallback
    if (filteredData.length === 0 && channelSizeNum !== 1000000) {
      console.log(`No data for ${channelSizeNum} sats, trying 1M sats as fallback`);
      
      for (const dailyEntry of historicalData) {
        const channelKey = 'channel_1000000';
        if (dailyEntry[channelKey] && dailyEntry[channelKey].prices) {
          const channelData = dailyEntry[channelKey];
          
          channelData.prices.forEach((price: any) => {
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

    // Sort by timestamp (oldest first for chart display)
    filteredData.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

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
