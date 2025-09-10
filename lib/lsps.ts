export interface LSP {
  id: string;
  name: string;
  logo?: string; // Optional - will be fetched from LSP metadata
  url: string;
  pubkey: string;
  active: boolean;
  // LSP metadata fields (fetched from LSP endpoint)
  metadata?: {
    name?: string;
    description?: string;
    icon?: string;
    logo?: string;
    website?: string;
    min_channel_size?: number;
    max_channel_size?: number;
  };
}

export const LSPS: LSP[] = [
  {
    id: 'olympus',
    name: 'Olympus',
    url: 'https://lsps1.lnolymp.us/api/v1',
    pubkey: '031b301307574bbe9b9ac7b79cbe1700e31e544513eae0b5d7497483083f99e581',
    active: true
  },
  {
    id: 'lnserver',
    name: 'LNServer Wave',
    url: 'https://lsps1.lnserver.com/api/v1',
    pubkey: '02b4552a7a85274e4da01a7c71ca57407181752e8568b31d51f13c110a2941dce3',
    active: true
  },
  {
    id: 'megalith',
    name: 'Megalith',
    url: 'https://megalithic.me/api/lsps1/v1',
    pubkey: '03e30fda71887a916ef5548a4d02b06fe04aaa1a8de9e24134ce7f139cf79d7579',
    active: true
  },
  {
    id: 'flashsats',
    name: 'Flashsats',
    url: 'https://flashsats.xyz/api/v1',
    pubkey: '02e4971e61a3f55718ae31e2eed19aaf2e32caf3eb5ef5ff03e01aa3ada8907e78',
    active: true
  }
];

// Helper function to get active LSPs
export function getActiveLSPs(): LSP[] {
  return LSPS.filter(lsp => lsp.active);
}

// Helper function to get LSP by ID
export function getLSPById(id: string): LSP | undefined {
  return LSPS.find(lsp => lsp.id === id);
}

// Helper function to get LSP by URL
export function getLSPByURL(url: string): LSP | undefined {
  return LSPS.find(lsp => lsp.url === url);
}

// Fetch LSP metadata including icon from LSP endpoint
export async function fetchLSPMetadata(lsp: LSP): Promise<LSP> {
  try {
    // URL safety: prevent double slashes
    const infoUrl = new URL('info', lsp.url).toString();
    
    // Add timeout and retry logic
    const response = await fetchWithRetry(infoUrl, {
      timeoutMs: 5000,
      retries: 1
    });
    
    if (!response.ok) {
      console.warn(`Failed to fetch metadata for ${lsp.name}: ${response.status}`);
      return lsp;
    }
    
    const data = await response.json();
    
    // Basic validation of response structure
    if (typeof data !== 'object' || data === null) {
      console.warn(`Invalid metadata response from ${lsp.name}:`, data);
      return lsp;
    }
    
    // Update LSP with metadata from the endpoint
    return {
      ...lsp,
      metadata: {
        name: typeof data.name === 'string' ? data.name : lsp.name,
        description: typeof data.description === 'string' ? data.description : undefined,
        icon: typeof data.icon === 'string' ? data.icon : undefined,
        logo: typeof data.logo === 'string' ? data.logo : (typeof data.icon === 'string' ? data.icon : undefined),
        website: typeof data.website === 'string' ? data.website : undefined,
        min_channel_size: typeof data.min_channel_size === 'number' ? data.min_channel_size : undefined,
        max_channel_size: typeof data.max_channel_size === 'number' ? data.max_channel_size : undefined,
      }
    };
  } catch (error) {
    console.warn(`Error fetching metadata for ${lsp.name}:`, error);
    return lsp;
  }
}

// Helper function for fetch with timeout and retry
async function fetchWithRetry(url: string, { timeoutMs = 5000, retries = 1 } = {}) {
  for (let i = 0; i <= retries; i++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    
    try {
      const response = await fetch(url, { 
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Alby-LSP-PriceBoard/1.0'
        }
      });
      clearTimeout(timeout);
      return response;
    } catch (error) {
      clearTimeout(timeout);
      if (i === retries) throw error;
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
  throw new Error(`Failed to fetch ${url} after ${retries + 1} attempts`);
}

// Fetch metadata for all active LSPs
export async function fetchAllLSPMetadata(): Promise<LSP[]> {
  const activeLSPs = getActiveLSPs();
  const metadataPromises = activeLSPs.map(lsp => fetchLSPMetadata(lsp));
  return Promise.all(metadataPromises);
}
