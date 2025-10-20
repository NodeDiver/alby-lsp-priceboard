import React from 'react';
import { SimpleHealthStatus } from '../lib/simple-health';
import { Tooltip } from './Tooltip';

interface HealthIndicatorProps {
  healthStatus?: SimpleHealthStatus | null;
  className?: string;
}

export function LSPHealthIndicator({ healthStatus, className = '' }: HealthIndicatorProps) {
  if (!healthStatus) {
    // Unknown status - show gray indicator
    return (
      <div className={`inline-flex items-center ${className}`}>
        <Tooltip text="API Status Unknown - We check if the LSP's LSPS1 API endpoint is available when you visit this site. Note: This checks the HTTP API, not the Lightning node itself.">
          <div className="w-3 h-3 rounded-full bg-gray-400 mr-2 cursor-help"></div>
        </Tooltip>
      </div>
    );
  }

  const { status } = healthStatus;

  let statusColor: string;
  let tooltipText: string;

  switch (status) {
    case 'online':
      statusColor = 'bg-green-500';
      tooltipText = `API Available - The LSP's LSPS1 HTTP API endpoint is responding. This means you can open new channels. Note: This checks the web API (HTTPS), not the Lightning node connection. Your existing channels may work even if this shows red.`;
      break;
    case 'offline':
      statusColor = 'bg-red-500';
      tooltipText = `API Unavailable - The LSP's LSPS1 HTTP API endpoint is not responding. You may not be able to open new channels right now. Note: This only checks the web API. The Lightning node itself may still be online for existing channels and peering.`;
      break;
    default:
      statusColor = 'bg-gray-400';
      tooltipText = 'API Status Unknown - We check if the LSP\'s LSPS1 API endpoint is available when you visit this site. Note: This checks the HTTP API, not the Lightning node itself.';
  }

  return (
    <div className={`inline-flex items-center ${className}`}>
      <Tooltip text={tooltipText}>
        <div className={`w-3 h-3 rounded-full ${statusColor} mr-2 cursor-help`}></div>
      </Tooltip>
    </div>
  );
}
