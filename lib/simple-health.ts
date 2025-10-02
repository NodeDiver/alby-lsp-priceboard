import { LSP } from './lsps';

export interface SimpleHealthStatus {
  lsp_id: string;
  is_online: boolean;
  status: 'online' | 'offline';
  last_check: string;
  response_time_ms: number;
  error_message?: string;
}

export class SimpleHealthMonitor {
  /**
   * Simple health check - just see if the LSP URL responds
   */
  async checkLSPHealth(lsp: LSP): Promise<SimpleHealthStatus> {
    const startTime = Date.now();
    
    try {
      console.log(`Checking ${lsp.name} at ${lsp.url}...`);
      
      const response = await fetch(lsp.url, {
        method: 'HEAD',
        headers: {
          'User-Agent': 'Alby-LSP-HealthCheck/1.0'
        }
      });
      
      const responseTime = Date.now() - startTime;
      const isOnline = response.status < 500;
      
      console.log(`${lsp.name}: ${response.status} (${responseTime}ms) - ${isOnline ? 'ONLINE' : 'OFFLINE'}`);
      
      return {
        lsp_id: lsp.id,
        is_online: isOnline,
        status: isOnline ? 'online' : 'offline',
        last_check: new Date().toISOString(),
        response_time_ms: responseTime
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      console.log(`${lsp.name}: ERROR (${responseTime}ms) - ${error.message}`);
      
      return {
        lsp_id: lsp.id,
        is_online: false,
        status: 'offline',
        last_check: new Date().toISOString(),
        response_time_ms: responseTime,
        error_message: error.message
      };
    }
  }

  /**
   * Check all LSPs
   */
  async checkAllLSPs(): Promise<SimpleHealthStatus[]> {
    const { getActiveLSPs } = await import('./lsps');
    const activeLSPs = getActiveLSPs();
    
    console.log(`Checking ${activeLSPs.length} LSPs...`);
    
    const healthPromises = activeLSPs.map(lsp => this.checkLSPHealth(lsp));
    const healthStatuses = await Promise.all(healthPromises);
    
    const online = healthStatuses.filter(h => h.is_online).length;
    const offline = healthStatuses.filter(h => !h.is_online).length;
    
    console.log(`Health check complete: ${online} online, ${offline} offline`);
    
    return healthStatuses;
  }
}

export const simpleHealthMonitor = new SimpleHealthMonitor();
