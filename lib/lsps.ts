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
    url: 'https://www.lnserver.com/lsp/wave',
    pubkey: '02b4552a7a85274e4da01a7c71ca57407181752e8568b31d51f13c110a2941dce3',
    active: true
  },
  {
    id: 'megalith',
    name: 'Megalith',
    url: 'https://lsps1.megalith.com/api/v1',
    pubkey: '03e30fda71887a916ef5548a4d02b06fe04aaa1a8de9e24134ce7f139cf79d7579',
    active: true
  },
  {
    id: 'flashsats',
    name: 'Flashsats',
    url: 'https://lsps1.flashsats.com/api/v1',
    pubkey: '038a9e56512ec98da2b5789761f7af8f280baf98a09282360cd6ff1381b5e889bf',
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
    const response = await fetch(`${lsp.url}/info`);
    if (!response.ok) {
      console.warn(`Failed to fetch metadata for ${lsp.name}: ${response.status}`);
      return lsp;
    }
    
    const data = await response.json();
    
    // Update LSP with metadata from the endpoint
    return {
      ...lsp,
      metadata: {
        name: data.name || lsp.name,
        description: data.description,
        icon: data.icon,
        logo: data.logo || data.icon,
        website: data.website,
        min_channel_size: data.min_channel_size,
        max_channel_size: data.max_channel_size,
      }
    };
  } catch (error) {
    console.warn(`Error fetching metadata for ${lsp.name}:`, error);
    return lsp;
  }
}

// Fetch metadata for all active LSPs
export async function fetchAllLSPMetadata(): Promise<LSP[]> {
  const activeLSPs = getActiveLSPs();
  const metadataPromises = activeLSPs.map(lsp => fetchLSPMetadata(lsp));
  return Promise.all(metadataPromises);
}
