import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow POST requests (Vercel Cron Jobs use POST)
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'Only POST requests are allowed for this endpoint'
    });
  }

  try {
    // Day-of-week based channel size fetching to stay within Vercel free tier 10s limit
    // Monday = 1M, Tuesday = 2M, Wednesday = 3M, Thursday = 4M, Friday = 5M, Saturday = 7M, Sunday = 10M
    // This ensures each cron execution fetches only ONE channel size, keeping execution time under 10 seconds
    // NOTE: In the future, we could parallelize fetching multiple channel sizes if we upgrade to a paid plan
    const dayOfWeek = new Date().getUTCDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

    const channelSizeByDay: Record<number, number> = {
      0: 10000000, // Sunday = 10M sats
      1: 1000000,  // Monday = 1M sats
      2: 2000000,  // Tuesday = 2M sats
      3: 3000000,  // Wednesday = 3M sats
      4: 4000000,  // Thursday = 4M sats
      5: 5000000,  // Friday = 5M sats
      6: 7000000,  // Saturday = 7M sats
    };

    const channelSize = channelSizeByDay[dayOfWeek];
    console.log(`Today is ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek]}, fetching ${channelSize / 1000000}M sats channel size`);

    const allPrices = [];

    // STEP 1: Get cached health status from Redis (checked by separate cron job)
    console.log('Reading cached LSP health status...');
    const { getHealthStatuses } = await import('../../../lib/db');
    const healthStatuses = await getHealthStatuses();

    if (healthStatuses) {
      console.log(`Using cached health status: ${healthStatuses.filter(h => h.is_online).length}/${healthStatuses.length} LSPs online`);
    } else {
      console.warn('No cached health status found - health data will not be included');
    }

    // STEP 2: Use the PriceService with fallback logic
    const { PriceService } = await import('../../../lib/price-service');
    const priceService = PriceService.getInstance();
    const prices = await priceService.forceFetchPricesNew(channelSize, true);

    // STEP 3: Merge health status with price data (if available)
    const pricesWithHealth = prices.map(price => {
      if (!healthStatuses) {
        return price; // No health data available
      }

      const healthStatus = healthStatuses.find(h => h.lsp_id === price.lsp_id);
      return {
        ...price,
        is_online: healthStatus?.is_online,
        health_status: healthStatus?.status,
        health_check_timestamp: healthStatus?.last_check,
        health_response_time_ms: healthStatus?.response_time_ms
      };
    });

    allPrices.push(...pricesWithHealth);
    
    // Return success response
    res.status(200).json({
      success: true,
      message: `Prices${healthStatuses ? ' and health status' : ''} fetched and saved successfully for ${channelSize / 1000000}M sats channel size`,
      count: allPrices.length,
      channelSize: channelSize,
      dayOfWeek: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek],
      timestamp: new Date().toISOString(),
      lspsOnline: healthStatuses ? healthStatuses.filter(h => h.is_online).length : undefined,
      lspsTotal: healthStatuses ? healthStatuses.length : undefined,
      healthDataAvailable: !!healthStatuses,
      prices: allPrices.map(price => ({
        lsp_id: price.lsp_id,
        lsp_name: price.lsp_name,
        channel_size_sat: price.channel_size_sat,
        total_fee_msat: price.total_fee_msat,
        timestamp: price.timestamp,
        is_online: price.is_online,
        health_status: price.health_status
      }))
    });
    
  } catch (error) {
    console.error('Cron job error:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to fetch prices',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
}
