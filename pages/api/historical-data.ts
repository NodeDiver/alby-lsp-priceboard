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

    // Get historical data from database
    const historicalData = await getPriceHistory(1000); // Get more data than needed to filter by date
    
    // Filter data for the specific channel size and date range
    const filteredData = historicalData
      .filter(entry => entry.channelSize === channelSizeNum)
      .filter(entry => {
        const entryDate = new Date(entry.timestamp);
        return entryDate >= startDate && entryDate <= endDate;
      })
      .flatMap(entry => 
        entry.prices.map(price => ({
          timestamp: entry.timestamp,
          lsp_id: price.lsp_id,
          lsp_name: price.lsp_name,
          total_fee_msat: price.total_fee_msat || 0,
          channel_size: entry.channelSize
        }))
      )
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

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
