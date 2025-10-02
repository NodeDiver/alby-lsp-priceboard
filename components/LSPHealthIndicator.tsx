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
        <Tooltip text="Health status unknown - we check if LSPs are online or offline every 30 minutes">
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
      tooltipText = `Online - This LSP is currently responding to requests. We check every 30 minutes.`;
      break;
    case 'offline':
      statusColor = 'bg-red-500';
      tooltipText = `Offline - This LSP is not responding to requests. We check every 30 minutes.`;
      break;
    default:
      statusColor = 'bg-gray-400';
      tooltipText = 'Health status unknown - we check if LSPs are online or offline every 30 minutes';
  }

  return (
    <div className={`inline-flex items-center ${className}`}>
      <Tooltip text={tooltipText}>
        <div className={`w-3 h-3 rounded-full ${statusColor} mr-2 cursor-help`}></div>
      </Tooltip>
    </div>
  );
}
