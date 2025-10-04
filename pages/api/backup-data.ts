import { NextApiRequest, NextApiResponse } from 'next';
import { Redis } from '@upstash/redis';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const redis = Redis.fromEnv();
    
    if (!redis) {
      return res.status(500).json({ 
        error: 'Redis not available',
        message: 'Redis instance could not be created.'
      });
    }

    const format = req.query.format as string || 'json';
    const includeMetadata = req.query.metadata === 'true';

    // Get all keys
    const allKeys = await redis.keys('alby:lsp:*');
    
    // Separate different types of data
    const channelKeys = allKeys.filter(key => key.startsWith('alby:lsp:channel:'));
    const historyKeys = allKeys.filter(key => key.startsWith('alby:lsp:history:'));
    const metadataKeys = allKeys.filter(key => key === 'alby:lsp:metadata');

    // Collect all data
    const backupData = {
      exportInfo: {
        timestamp: new Date().toISOString(),
        totalKeys: allKeys.length,
        channelKeys: channelKeys.length,
        historyKeys: historyKeys.length,
        metadataKeys: metadataKeys.length,
        format: format,
        version: '1.0'
      },
      channelData: {},
      historicalData: {},
      metadata: null
    };

    // Fetch channel data
    for (const key of channelKeys) {
      try {
        const data = await redis.get(key);
        const channelSize = key.split(':')[3];
        backupData.channelData[channelSize] = data;
      } catch (error) {
        console.warn(`Error fetching channel data for ${key}:`, error);
      }
    }

    // Fetch historical data
    for (const key of historyKeys) {
      try {
        const data = await redis.get(key);
        backupData.historicalData[key] = data;
      } catch (error) {
        console.warn(`Error fetching historical data for ${key}:`, error);
      }
    }

    // Fetch metadata if requested
    if (includeMetadata && metadataKeys.length > 0) {
      try {
        backupData.metadata = await redis.get('alby:lsp:metadata');
      } catch (error) {
        console.warn('Error fetching metadata:', error);
      }
    }

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const filename = `alby-lsp-backup-${timestamp}`;

    // Set appropriate headers based on format
    switch (format.toLowerCase()) {
      case 'json':
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`);
        return res.status(200).json(backupData);

      case 'csv':
        const csvData = convertToCSV(backupData);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
        return res.status(200).send(csvData);

      case 'sql':
        const sqlData = convertToSQL(backupData);
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.sql"`);
        return res.status(200).send(sqlData);

      case 'txt':
        const txtData = convertToTXT(backupData);
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.txt"`);
        return res.status(200).send(txtData);

      default:
        return res.status(400).json({ 
          error: 'Invalid format', 
          message: 'Supported formats: json, csv, sql, txt' 
        });
    }

  } catch (error) {
    console.error('Backup error:', error);
    return res.status(500).json({
      error: 'Failed to create backup',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

function convertToCSV(data: { channelData: Record<string, unknown>; historyData: Record<string, unknown> }): string {
  const rows = [];
  
  // Header
  rows.push('Type,Key,ChannelSize,Timestamp,LSP_ID,LSP_Name,Total_Fee_MSAT,Source');
  
  // Channel data
  Object.entries(data.channelData).forEach(([channelSize, prices]: [string, unknown]) => {
    if (Array.isArray(prices)) {
      prices.forEach((price: { lsp_id: string; lsp_name: string; total_fee_msat: number; source: string; timestamp: string }) => {
        rows.push([
          'channel',
          `alby:lsp:channel:${channelSize}`,
          channelSize,
          price.timestamp || '',
          price.lsp_id || '',
          price.lsp_name || '',
          price.total_fee_msat || '',
          price.source || ''
        ].join(','));
      });
    }
  });
  
  // Historical data
  Object.entries(data.historicalData).forEach(([key, historyEntry]: [string, unknown]) => {
    if (historyEntry && historyEntry.prices && Array.isArray(historyEntry.prices)) {
      historyEntry.prices.forEach((price: { lsp_id: string; lsp_name: string; total_fee_msat: number; source: string; timestamp: string }) => {
        rows.push([
          'history',
          key,
          historyEntry.channelSize || '',
          historyEntry.timestamp || '',
          price.lsp_id || '',
          price.lsp_name || '',
          price.total_fee_msat || '',
          price.source || ''
        ].join(','));
      });
    }
  });
  
  return rows.join('\n');
}

function convertToSQL(data: { channelData: Record<string, unknown>; historicalData: Record<string, unknown> }): string {
  const sql = [];
  
  sql.push('-- Alby LSP Price Board Database Backup');
  sql.push(`-- Generated: ${data.exportInfo.timestamp}`);
  sql.push('-- Total Keys: ' + data.exportInfo.totalKeys);
  sql.push('');
  
  // Create tables
  sql.push('CREATE TABLE IF NOT EXISTS channel_prices (');
  sql.push('  id INTEGER PRIMARY KEY AUTOINCREMENT,');
  sql.push('  channel_size INTEGER NOT NULL,');
  sql.push('  lsp_id TEXT NOT NULL,');
  sql.push('  lsp_name TEXT NOT NULL,');
  sql.push('  total_fee_msat INTEGER NOT NULL,');
  sql.push('  source TEXT NOT NULL,');
  sql.push('  timestamp TEXT NOT NULL');
  sql.push(');');
  sql.push('');
  
  sql.push('CREATE TABLE IF NOT EXISTS historical_prices (');
  sql.push('  id INTEGER PRIMARY KEY AUTOINCREMENT,');
  sql.push('  history_key TEXT NOT NULL,');
  sql.push('  channel_size INTEGER NOT NULL,');
  sql.push('  lsp_id TEXT NOT NULL,');
  sql.push('  lsp_name TEXT NOT NULL,');
  sql.push('  total_fee_msat INTEGER NOT NULL,');
  sql.push('  source TEXT NOT NULL,');
  sql.push('  timestamp TEXT NOT NULL');
  sql.push(');');
  sql.push('');
  
  // Insert channel data
  Object.entries(data.channelData).forEach(([channelSize, prices]: [string, unknown]) => {
    if (Array.isArray(prices)) {
      prices.forEach((price: { lsp_id: string; lsp_name: string; total_fee_msat: number; source: string; timestamp: string }) => {
        sql.push(`INSERT INTO channel_prices (channel_size, lsp_id, lsp_name, total_fee_msat, source, timestamp) VALUES (${channelSize}, '${price.lsp_id || ''}', '${price.lsp_name || ''}', ${price.total_fee_msat || 0}, '${price.source || ''}', '${price.timestamp || ''}');`);
      });
    }
  });
  
  // Insert historical data
  Object.entries(data.historicalData).forEach(([key, historyEntry]: [string, unknown]) => {
    if (historyEntry && historyEntry.prices && Array.isArray(historyEntry.prices)) {
      historyEntry.prices.forEach((price: { lsp_id: string; lsp_name: string; total_fee_msat: number; source: string; timestamp: string }) => {
        sql.push(`INSERT INTO historical_prices (history_key, channel_size, lsp_id, lsp_name, total_fee_msat, source, timestamp) VALUES ('${key}', ${historyEntry.channelSize || 0}, '${price.lsp_id || ''}', '${price.lsp_name || ''}', ${price.total_fee_msat || 0}, '${price.source || ''}', '${price.timestamp || ''}');`);
      });
    }
  });
  
  return sql.join('\n');
}

function convertToTXT(data: { channelData: Record<string, unknown>; historicalData: Record<string, unknown> }): string {
  const lines = [];
  
  lines.push('ALBY LSP PRICE BOARD - DATABASE BACKUP');
  lines.push('==========================================');
  lines.push(`Generated: ${data.exportInfo.timestamp}`);
  lines.push(`Total Keys: ${data.exportInfo.totalKeys}`);
  lines.push(`Channel Keys: ${data.exportInfo.channelKeys}`);
  lines.push(`History Keys: ${data.exportInfo.historyKeys}`);
  lines.push(`Metadata Keys: ${data.exportInfo.metadataKeys}`);
  lines.push('');
  
  // Channel data
  lines.push('CURRENT CHANNEL DATA');
  lines.push('====================');
  Object.entries(data.channelData).forEach(([channelSize, prices]: [string, unknown]) => {
    lines.push(`\nChannel Size: ${channelSize} sats`);
    lines.push('-'.repeat(30));
    if (Array.isArray(prices)) {
      prices.forEach((price: { lsp_id: string; lsp_name: string; total_fee_msat: number; source: string; timestamp: string }) => {
        lines.push(`LSP: ${price.lsp_name || 'Unknown'} (${price.lsp_id || 'N/A'})`);
        lines.push(`  Fee: ${price.total_fee_msat || 0} msat`);
        lines.push(`  Source: ${price.source || 'Unknown'}`);
        lines.push(`  Timestamp: ${price.timestamp || 'Unknown'}`);
        lines.push('');
      });
    }
  });
  
  // Historical data
  lines.push('\nHISTORICAL DATA');
  lines.push('===============');
  Object.entries(data.historicalData).forEach(([key, historyEntry]: [string, unknown]) => {
    lines.push(`\nHistory Key: ${key}`);
    lines.push('-'.repeat(40));
    if (historyEntry && historyEntry.prices && Array.isArray(historyEntry.prices)) {
      lines.push(`Channel Size: ${historyEntry.channelSize || 'Unknown'}`);
      lines.push(`Entry Timestamp: ${historyEntry.timestamp || 'Unknown'}`);
      lines.push(`Prices Count: ${historyEntry.prices.length}`);
      lines.push('');
      historyEntry.prices.forEach((price: { lsp_id: string; lsp_name: string; total_fee_msat: number; source: string; timestamp: string }, index: number) => {
        lines.push(`  ${index + 1}. LSP: ${price.lsp_name || 'Unknown'} (${price.lsp_id || 'N/A'})`);
        lines.push(`     Fee: ${price.total_fee_msat || 0} msat`);
        lines.push(`     Source: ${price.source || 'Unknown'}`);
        lines.push(`     Timestamp: ${price.timestamp || 'Unknown'}`);
        lines.push('');
      });
    }
  });
  
  // Metadata
  if (data.metadata) {
    lines.push('\nMETADATA');
    lines.push('========');
    lines.push(JSON.stringify(data.metadata, null, 2));
  }
  
  return lines.join('\n');
}
