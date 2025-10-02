import { NextApiRequest, NextApiResponse } from 'next';

// CORS headers for API responses
export const allowCORS = (res: NextApiResponse) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
};

// Parse channel size from query parameters
export const parseChannelSize = (req: NextApiRequest): number => {
  const channelSize = req.query.channelSize as string;
  const parsed = channelSize ? parseInt(channelSize, 10) : 1000000;
  return isNaN(parsed) ? 1000000 : parsed;
};

// Get data source description for API responses
export const getDataSourceDescription = (dataSource: string): string => {
  switch (dataSource) {
    case 'live':
      return 'Real-time pricing from LSPs';
    case 'cached':
      return 'Previously fetched data';
    case 'historical':
      return 'Historical data from database';
    default:
      return 'Unknown data source';
  }
};
