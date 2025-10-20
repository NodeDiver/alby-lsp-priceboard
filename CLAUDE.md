# Alby LSP Price Board - Claude Context

## Project Overview

The **Alby LSP Price Board** is a Lightning Network service that provides transparent, real-time price comparison for Lightning Service Provider (LSP) channel opening fees. It solves the critical problem of users not knowing how much LSPs charge before committing to open a channel.

**Live Demo**: https://alby-lsp-priceboard.vercel.app/

## Core Problem Solved

Users previously couldn't see LSP pricing upfront before committing to a provider. This project provides:
- Real-time price comparison across 4 major LSPs
- Historical pricing data and trends
- Multi-currency support (20+ currencies)
- Transparent fee comparison for channels ranging from 1M to 10M satoshis

## Technology Stack

- **Framework**: Next.js 15 + React 19
- **Language**: TypeScript
- **Database**: Vercel KV (Upstash Redis)
- **Styling**: Tailwind CSS with dark mode
- **Deployment**: Vercel with cron jobs
- **LSP Communication**: LSPS1 Protocol + Alby API

## Supported LSPs

1. **Olympus** - LSPS1 protocol
2. **LNServer Wave** - LSPS1 with autodiscovery
3. **Megalith** - LSPS1 with dedicated key
4. **Flashsats** - LSPS1 with dedicated key

All LSPs are queried for channel sizes: 1M, 2M, 3M, 4M, 5M, 6M, 7M, 8M, 9M, 10M sats

## Architecture Overview

### Data Flow
```
Alby API (Primary) → LSPS1 Protocol (Fallback) → PriceService
                                                      ↓
                                                 Vercel KV Storage
                                                      ↓
                                    Current Prices + Historical Archive
                                                      ↓
                                               Public API + UI
```

### Key Components

**Backend (`lib/` directory)**
- `price-service.ts` - Core orchestration with dual-source fetching
- `lsp-api.ts` - LSPS1 protocol implementation
- `alby-api.ts` - Alby API integration
- `db.ts` - Vercel KV data persistence
- `currency.ts` - Real-time currency conversion

**Frontend (`components/` directory)**
- `PriceTable.tsx` - Main pricing display
- `HistoricalDataGraph.tsx` - Historical price visualization
- `PaymentModal.tsx` - WebLN payment integration for Pro Mode
- `ThemeToggle.tsx` - Dark mode support

**API Routes (`pages/api/`)**
- `prices.ts` - Public read-only API
- `prices-ui.ts` - UI-optimized API with smart caching
- `lsp-metadata.ts` - LSP metadata and logos
- `health.ts` - System health monitoring
- `cron/fetch-prices.ts` - Daily automated price fetching

## Data Storage Strategy

### Vercel KV (Redis) Structure

```
alby:lsp:channel:{channelSize}
├─ Current prices for specific channel size
├─ Example: alby:lsp:channel:1000000
└─ TTL: None (permanent storage)

alby:lsp:history:{date}
├─ Daily snapshots with timestamps
├─ Format: { date, lastUpdate, channel_1000000: {...}, ... }
└─ TTL: None (permanent storage)

alby:lsp:metadata
├─ Summary: lastUpdate, totalChannels, totalPrices
└─ TTL: None (permanent storage)
```

### Data Collection

**Automated Collection**
- Vercel Cron: Runs daily at midnight UTC
- Fetches prices for all 10 channel sizes
- Uses dual-source strategy (Alby API + LSPS1)
- Only successful fetches overwrite cache
- Historical data is preserved before updates

**Manual Collection**
- User-triggered refresh (Pro Mode feature)
- Per-LSP force fetch capability
- Background fetching to avoid blocking UI
- Smart caching with 1-hour "fresh" rule

### Data Protection
- **Atomic Updates**: Failed fetches never corrupt good cached data
- **History Preservation**: Old data archived before updates
- **Fallback Hierarchy**: Current Cache → Historical Cache → Error Response
- **No TTL**: Data persists permanently for historical analysis

## Features

### Free Features
- Live price comparison across 4 LSPs
- 1M-3M sats channel size selection
- Multi-currency support (20+ currencies)
- Smart caching (1-hour fresh rule)
- Dark mode
- Public API access

### Pro Mode Features (Lightning Payment Required)
- 4M-10M sats channel comparison
- Historical data visualization
- Per-LSP force refresh
- Manual price refresh
- Data download capability

## API Endpoints

### Get Current Prices
```
GET /api/prices?channelSize=1000000&fresh=1

Response:
{
  "success": true,
  "last_update": "2025-10-20T14:32:15.123Z",
  "total_lsps": 4,
  "data_source": "live|cached|mixed|estimated",
  "prices": [...]
}
```

### Health Check
```
GET /api/health

Response:
{
  "status": "ok",
  "timestamp": "...",
  "database": { connected, keysCount, hasData, lastUpdate }
}
```

### LSP Metadata
```
GET /api/lsp-metadata

Returns LSP details with logos and metadata
```

## Error Handling

The system implements comprehensive error handling with 13+ error codes:
- `TIMEOUT` - LSP not responding
- `PEER_NOT_CONNECTED` - Node not connected to LSP
- `RATE_LIMITED` - Too many requests
- `WHITELIST_REQUIRED` - LSP requires whitelisting
- `CHANNEL_SIZE_TOO_SMALL` - Channel size not supported
- And more...

Recovery Strategy:
1. Live Fetch Failed → Use cached data
2. No Current Cache → Try historical cache (up to 100 days)
3. No Historical Data → Return error with unavailable marker

## Development

### Environment Variables
```env
KV_REST_API_URL=https://...upstash.io
KV_REST_API_TOKEN=xxxx
```

### Running Locally
```bash
npm install
npm run dev
# Visit http://localhost:3000
```

### Running with Docker
```bash
docker build -t alby-lsp-priceboard .
docker run -p 3000:3000 -e KV_REST_API_URL=... alby-lsp-priceboard
```

## Project Structure

```
alby-lsp-priceboard/
├── pages/              # Next.js pages and API routes
├── lib/                # Core business logic
├── components/         # React components
├── types/              # TypeScript type definitions
├── styles/             # Global styles
├── __tests__/          # Jest unit tests
├── public/             # Static assets
└── vercel.json         # Vercel configuration (cron jobs)
```

## Key Technical Achievements

1. **Solved LSP Blocking Problem**: Dual-source architecture eliminates Node ID/IP blocking
2. **100% Uptime Data**: Failed fetches never corrupt cached data
3. **Smart Caching**: Automatic fallback from live → cached → historical
4. **Production Ready**: Full error handling, monitoring, and deployment support
5. **Lightning-Fast API**: CORS-enabled public API with rate limiting
6. **Professional UX**: Non-blocking UI with background fetches

## Common Tasks for Claude

### Adding a New LSP
1. Add LSP configuration to `lib/lsps.ts`
2. Add logo to `public/logos/`
3. Test LSPS1 endpoint compatibility
4. Update documentation

### Debugging Data Issues
1. Check `/api/health` for database status
2. View `/db-viewer` page for raw data inspection
3. Check cron job logs in Vercel dashboard
4. Inspect individual LSP status at `/api/health/lsp-status`

### Modifying Price Fetching Logic
- Primary file: `lib/price-service.ts`
- LSPS1 protocol: `lib/lsp-api.ts`
- Alby API: `lib/alby-api.ts`
- Database operations: `lib/db.ts`

### UI/UX Changes
- Main page: `pages/index.tsx`
- Price table: `components/PriceTable.tsx`
- Historical graph: `components/HistoricalDataGraph.tsx`
- Styling: Tailwind CSS classes + `styles/globals.css`

## Important Notes

- **No TTL on Data**: All data persists permanently for historical analysis
- **Smart Caching**: Data less than 1 hour old is considered "fresh"
- **Per-LSP Timeout**: ~12 seconds per LSP to avoid blocking
- **Pro Mode**: Requires Lightning payment, managed via WebLN
- **Rate Limiting**: Public API has ~100 req/min limit
- **CORS Enabled**: Public API accessible from any domain

## Links

- **GitHub**: https://github.com/NodeDiver/alby-lsp-priceboard
- **Issues**: https://github.com/NodeDiver/alby-lsp-priceboard/issues
- **Live Demo**: https://alby-lsp-priceboard.vercel.app/
- **Original Request**: https://github.com/getAlby/hub/issues/1001
