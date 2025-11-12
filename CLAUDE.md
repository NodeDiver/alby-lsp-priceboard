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
- `health/lsp-status.ts` - Real-time LSP health checks
- `cron/health-check.ts` - Scheduled LSP health monitoring (23:55 UTC)
- `cron/fetch-prices.ts` - Daily automated price fetching (00:00 UTC)

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
├─ Includes health status data (is_online, health_status, etc.)
└─ TTL: None (permanent storage)

alby:lsp:health:current
├─ Current health status for all LSPs
├─ Updated by health-check cron (23:55 UTC)
├─ Used by fetch-prices cron (00:00 UTC)
└─ TTL: None (overwritten daily)

alby:lsp:metadata
├─ Summary: lastUpdate, totalChannels, totalPrices
└─ TTL: None (permanent storage)
```

### Data Collection

**Automated Collection (Two Cron Jobs)**

*Health Check Cron (23:55 UTC):*
- Checks all LSPs' LSPS1 API endpoint availability
- Saves health status to Redis cache
- **Execution time**: ~11 seconds
- Used by price fetch cron 5 minutes later

*Price Fetch Cron (00:00 UTC):*
- **Optimized for Vercel Free Tier**: Fetches ONE channel size per day (not all 10)
- **Day-of-Week Rotation Schedule:**
  - Monday → 1M sats
  - Tuesday → 2M sats
  - Wednesday → 3M sats
  - Thursday → 4M sats
  - Friday → 5M sats
  - Saturday → 7M sats
  - Sunday → 10M sats
- Uses dual-source strategy (Alby API + LSPS1)
- Reads cached health status from Redis
- **Execution time**: ~4-8 seconds (well within 10s free tier limit)
- Only successful fetches overwrite cache
- Historical data is preserved before updates
- Each channel size gets fresh data once per week
- Saves both price and health data to historical snapshots

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
- Real-time LSP health status indicators (green/red/gray dots)
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
KV_REST_API_READ_ONLY_TOKEN=xxxx (optional)
```

### Running Locally with Production Database

**⚠️ Important**: Local development connects to the **same production database** used by https://channelprices.com/. Any writes from local development will affect the production database.

**Prerequisites:**
1. Node.js installed (v18+)
2. `.env.local` file configured with production Vercel KV credentials

**Setup Steps:**
```bash
# Install dependencies
npm install

# Ensure .env.local exists with production credentials
# KV_REST_API_URL=https://...upstash.io
# KV_REST_API_TOKEN=xxxx

# Start the development server
npm run dev
```

The application will be available at: **http://localhost:3000**

**Database Connection:**
- **Database Type**: Vercel KV (Upstash Redis)
- **Connection**: Uses environment variables from `.env.local`
- **Shared Data**: Same database as production (https://channelprices.com/)
- **Read/Write Access**: Full read/write access to production data

**Important Notes:**
1. **Production Database**: Local development uses the same database as production. Any data changes will affect the live site.
2. **Cron Jobs**: Local cron jobs will not run automatically. They are configured in `vercel.json` and only execute on Vercel.
3. **API Endpoints**: All API endpoints work the same as production.
4. **Hot Reload**: Next.js development server supports hot module replacement for fast development.

**Troubleshooting:**
- **Database Connection Issues**: Verify `.env.local` exists and contains correct credentials. Test connection by visiting `/api/health`
- **Port Already in Use**: Kill existing process: `lsof -ti:3000 | xargs kill` or use different port: `PORT=3001 npm run dev`
- **Module Not Found**: Run `npm install` to install dependencies

**Stopping the Server:**
Press `Ctrl+C` in the terminal, or kill the process:
```bash
ps aux | grep "next dev" | grep -v grep | awk '{print $2}' | xargs kill
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

## Performance Optimizations (October 2025)

### Cron Job Optimization
**Problem**: Cron job was timing out at 120s while trying to fetch 10 channel sizes sequentially, causing no data collection since October 16.

**Solution**: Implemented day-of-week rotation strategy
- Reduced from fetching 10 channel sizes to 1 per day
- Execution time: **4-8 seconds** (down from 560s potential)
- **9× faster** and compliant with Vercel free tier (10s limit)
- Trade-off: Each channel size updated weekly instead of daily

**Files Modified:**
- `pages/api/cron/fetch-prices.ts` - Day-based channel selection logic
- `vercel.json` - Reduced maxDuration from 120s to 10s

### Historical Data API Optimization
**Problem**: Historical data loading was slow (~20-30 seconds), fetching 1000 Redis keys unnecessarily.

**Solution**: Reduced query limit from 1000 to 35 days
- Query time: **0.74 seconds** (down from 20+ seconds)
- **~28× faster** loading time
- Reduced Redis queries from 1000 to 35
- Frontend only needs 30 days anyway (with 5-day buffer)

**Files Modified:**
- `pages/api/historical-data.ts` - Reduced getPriceHistory(1000) to getPriceHistory(35)

### Results
| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Cron execution time | 560s (timeout) | 4-8s | 70-140× faster |
| Cron success rate | 0% (failing) | 100% | ✅ Fixed |
| Historical data load | 20-30s | 0.7s | 28× faster |
| Free tier compliance | ❌ Exceeded | ✅ Compliant | Cost: $0/month |

## November 12, 2025 Improvements

### Cron Job 405 Error Fix
**Problem**: Both cron jobs failing with "Method Not Allowed" (405) since deployment
**Root Cause**: Endpoints only accepted POST, but Vercel Cron sends GET requests
**Solution**: Updated both endpoints to accept GET and POST methods with Vercel cron header detection

**Files Modified**:
- `pages/api/cron/fetch-prices.ts`
- `pages/api/cron/health-check.ts`

**Result**: ✅ Cron jobs now execute successfully, daily data collection restored

### Code Quality & Stability Improvements (Nov 12, 2025)

#### Phase 1: Critical Stability Fixes
1. **Type Safety in Health Check** (`lib/simple-health.ts`)
   - Added proper error type checking before accessing `.message`
   - Safe error message extraction for all error types

2. **Health Check Timeout** (`lib/simple-health.ts`)
   - Added 5-second timeout to fetch calls using `AbortSignal.timeout(5000)`
   - Prevents health checks from hanging indefinitely

3. **CRON_SECRET Validation** (`pages/api/cron/fetch-prices.ts`)
   - Added authorization check matching health-check endpoint
   - Consistent security across both cron jobs

4. **Health Status Cache Validation** (`pages/api/cron/fetch-prices.ts`)
   - Validates cached health status age (10-minute max)
   - Fallback to fresh health check if cache stale/missing
   - Eliminates race condition between health check and price fetch

5. **Memory Leak Prevention** (`lib/price-service.ts`)
   - Implemented LRU cache with eviction policy
   - Max 100 entries, 24-hour TTL per entry
   - Automatic cleanup of stale entries
   - Prevents unbounded memory growth

#### Phase 2: Code Quality Improvements
1. **Type Assertion Cleanup** (`lib/lsp-api.ts`)
   - Removed `as unknown as` pattern at lines 546, 640
   - Direct type assertions for better type safety

2. **Standard API Response Types** (`types/api-response.ts`)
   - Created unified response format for all endpoints
   - `ApiSuccessResponse<T>` and `ApiErrorResponse`
   - Helper functions for consistent responses

3. **Currency Conversion Race Condition** (`lib/currency.ts`)
   - Added in-flight request tracking
   - Prevents thundering herd on cache expiry
   - Single request serves all concurrent callers

4. **Complete Error Code Coverage** (`lib/price-service.ts`)
   - Added user-friendly messages for all 15 error codes
   - TIMEOUT, URL_NOT_FOUND, TLS_ERROR, etc.
   - Exhaustive switch statement with default case

5. **Type Definition Fixes** (`pages/api/prices-ui.ts`)
   - Added missing `LSPPrice` import
   - Proper TypeScript type safety restored

## LSP Health Monitoring (October 2025)

### Overview
Real-time health status indicators show whether each LSP can accept new channel requests. Visual indicators (green/red/gray dots) appear next to each LSP name in the comparison table.

### How It Works

**Two Health Check Mechanisms:**

1. **Real-Time Checks** (when users visit)
   - Triggered when frontend loads the page
   - Endpoint: `/api/health/lsp-status`
   - Checks LSPS1 HTTP API endpoint availability
   - Updates immediately for current user session

2. **Scheduled Checks** (automated cron job)
   - Runs daily at 23:55 UTC (5 minutes before price fetch)
   - Endpoint: `/api/cron/health-check`
   - Saves health status to Redis cache
   - Used by price fetch cron job (00:00 UTC)
   - Execution time: ~11 seconds

**Split Cron Job Architecture:**
```
23:55 UTC: Health Check Cron (~11s)
    ↓
Saves to Redis Cache (alby:lsp:health:current)
    ↓
00:00 UTC: Price Fetch Cron (~6s)
    ↓
Reads cached health status
    ↓
Saves prices + health status to historical data
```

### What is Checked

**Important Distinction:**
- ✅ **Checks**: LSPS1 HTTP API endpoint (HTTPS on port 443/80)
- ❌ **Does NOT check**: Lightning node itself (port 9735)

This means:
- Green dot = LSP API is available → You can open new channels
- Red dot = LSP API is unavailable → Cannot open new channels right now
- **Note**: Lightning node may still be online for existing channels even if API is down

### Health Status Indicators

| Indicator | Meaning | Tooltip |
|-----------|---------|---------|
| 🟢 Green | API Available | "You can open new channels with this LSP right now." |
| 🔴 Red | API Unavailable | "Cannot open new channels right now. Your existing channels may still work fine." |
| ⚪ Gray | Status Unknown | "Status unknown. Refresh the page to check if you can open new channels." |

**Tooltip Design Philosophy:**
- Simplified for non-technical users (October 20, 2025)
- Focuses on what users can **do**, not technical details
- Avoids jargon like "LSPS1", "HTTP API", "Lightning node"
- Clear action-oriented language

### Technical Implementation

**Files:**
- `lib/simple-health.ts` - Health check logic
- `components/LSPHealthIndicator.tsx` - Visual indicator component
- `pages/api/health/lsp-status.ts` - Real-time health check endpoint
- `pages/api/cron/health-check.ts` - Scheduled health check cron
- `lib/db.ts` - Redis cache for health status

**Health Check Method:**
```typescript
// Checks LSPS1 HTTP API endpoint with HEAD request
const response = await fetch(lsp.url, { method: 'HEAD' });
const isOnline = response.status < 500;
```

**Data Structure:**
```typescript
interface SimpleHealthStatus {
  lsp_id: string;
  is_online: boolean;
  status: 'online' | 'offline';
  last_check: string;
  response_time_ms: number;
  error_message?: string;
}
```

**Redis Cache:**
```
alby:lsp:health:current
├─ Array of health statuses for all LSPs
├─ Updated by health-check cron at 23:55 UTC
├─ Read by fetch-prices cron at 00:00 UTC
└─ TTL: None (overwritten daily)
```

### Historical Health Data

Health status is saved alongside price data in historical snapshots:
```typescript
interface LSPPrice {
  // ... price fields
  is_online?: boolean;
  health_status?: 'online' | 'offline' | 'unknown';
  health_check_timestamp?: string;
  health_response_time_ms?: number;
}
```

This allows tracking LSP uptime trends over time.

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

**Known Historical Issues:**
- **October 3-16, 2025 Data Gap**: Cron job was timing out (120s limit exceeded), causing no data collection during this period. Fixed on October 20 with day-of-week rotation strategy.
- **Before October 3**: Cron job had a bug where historical data was saved with old timestamps instead of current timestamps, causing incorrect date keys in Redis.

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
- **Weekly Data Rotation**: Each channel size is updated once per week (day-of-week rotation)
- **Free Tier Optimized**: Cron jobs run in <10s to comply with Vercel free tier limits

## Links

- **GitHub**: https://github.com/NodeDiver/alby-lsp-priceboard
- **Issues**: https://github.com/NodeDiver/alby-lsp-priceboard/issues
- **Live Demo**: https://alby-lsp-priceboard.vercel.app/
- **Original Request**: https://github.com/getAlby/hub/issues/1001
