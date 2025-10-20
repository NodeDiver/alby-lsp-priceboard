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
        <Tooltip text="Status unknown. Refresh the page to check if you can open new channels.">
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
      tooltipText = 'You can open new channels with this LSP right now.';
      break;
    case 'offline':
      statusColor = 'bg-red-500';
      tooltipText = 'Cannot open new channels right now. Your existing channels may still work fine.';
      break;
    default:
      statusColor = 'bg-gray-400';
      tooltipText = 'Status unknown. Refresh the page to check if you can open new channels.';
  }

  return (
    <div className={`inline-flex items-center ${className}`}>
      <Tooltip text={tooltipText}>
        <div className={`w-3 h-3 rounded-full ${statusColor} mr-2 cursor-help`}></div>
      </Tooltip>
    </div>
  );
}
