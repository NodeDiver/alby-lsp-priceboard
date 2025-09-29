# Alby LSP Price Board v0.2.1

A real-time Lightning Service Provider (LSP) price comparison tool that helps users make informed decisions when opening Lightning channels.

✅ **PRODUCTION READY v0.2.1**: Successfully implemented LSPS1 protocol with live pricing data from multiple LSPs. Smart caching system ensures data persistence and optimal user experience with major UX and readability improvements.

🌐 **Live Demo**: [https://alby-lsp-priceboard.vercel.app/](https://alby-lsp-priceboard.vercel.app/)

## 📸 **Screenshot**

![LSP Price Board Comparison](public/images/lsp-price-board-comparison.jpg)

*Production LSP price comparison showing live pricing data across multiple channel sizes with dedicated public keys, historical data preservation, and robust error handling.*

## 🚀 **Latest Updates - Version 0.2.1 (September 2025)**

### Bug Fixes & Stability Improvements
- **✅ Fixed Hydration Error**: Resolved React hydration mismatch in Pro Mode toggle system
- **✅ Fixed Column Layout**: Implemented fixed table layout to prevent Fee column position shifting
- **✅ Improved State Management**: Added proper hydration handling for localStorage-dependent features

## 🚀 **Previous Updates - Version 0.2 (September 2025)**

### Major UX & Readability Improvements
- **✅ Pro Mode Toggle System**: Added Pro Mode 💪 toggle with conditional button visibility for advanced features
- **✅ Comprehensive Typography Overhaul**: Upgraded all text sizes and hierarchy for better readability and professional appearance
- **✅ Enhanced Price Display**: Made sats prices `text-2xl font-bold` and fiat prices `text-lg font-semibold` for better visual hierarchy
- **✅ Timestamp Display Improvements**: Shows full date with hoverable clock tooltips for better time information
- **✅ UI Polish & Consistency**: Fixed button sizing, improved legend styling, enhanced color consistency
- **✅ Animation Enhancements**: Added professional fade-in animations for Pro Mode buttons
- **✅ UI Component Cleanup**: Removed unwanted tooltips and hover effects

## 🚀 **Previous Updates - Version 0.1 (September 2025)**
- **✅ Historical Data Preservation**: Old data archived before new fetches, never lost
- **✅ Error Protection**: Failed fetches never overwrite good cached data  
- **✅ Dedicated LSP Public Keys**: Separate node IDs for Flashsats and Megalith
- **✅ Grayscale UI Theme**: Professional monochrome design with 💪 force buttons
- **✅ Per-LSP Force Fetch**: Individual force fetch buttons for each LSP
- **✅ Fresh Cache Rule**: Data < 1 hour old shows as "live", > 1 hour shows as "cached"
- **✅ Multi-Channel Cron**: Daily automated fetching for 1M/2M/5M/10M channel sizes
- **✅ Persistent Database**: Vercel KV Redis with no TTL expiration
- **✅ Code Quality**: Unified architecture, LSPS1 compliance, consistent error handling
- **✅ Unit Tests**: Jest testing framework with LSPS1 error mapping and DB serialization tests
- **✅ Health Monitoring**: `/api/health` endpoint for system status and uptime monitoring
- **✅ UI Clarity v0.1**: Clear explanations, helpful tooltips, improved empty states, and user-friendly labels
- **✅ Smart Caching System**: Shows cached data immediately, fetches live data in background
- **✅ Enhanced Error Handling**: Specific error messages with intelligent fallback to cached data

## Problem Solved

This project addresses [Alby Hub Issue #1001](https://github.com/getAlby/hub/issues/1001) - users want to see LSP pricing information upfront before selecting one, instead of only seeing costs after clicking "Next".

## Features

- **🟢 LIVE DATA** from 3 working LSPs (Olympus, LNServer Wave, Flashsats) using LSPS1 protocol
- **🟡 SMART CACHING** with 1-hour fresh rule - recent data shows as "live", older as "cached"
- **⚡ PER-LSP FORCE FETCH** - Individual buttons to refresh data for specific LSPs
- **Real-time price comparison** across 4 LSPs with intelligent fallback handling
- **Multi-currency support** with live conversion using Alby's Lightning Tools
- **Channel size filtering** (1M-10M sats) - all sizes supported with persistent data
- **Public REST API** for integration with other applications
- **Automatic price updates** daily via Vercel Cron Jobs for all channel sizes
- **Clean, responsive UI** with professional design and individual LSP timestamps
- **Robust error handling** with detailed status indicators and retry mechanisms 

## Technology Stack

- **Next.js 15** - React framework with API routes
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first styling
- **Vercel KV** - Redis-compatible database for price storage
- **Vercel Cron Jobs** - Automated price fetching daily
- **Alby Lightning Tools** - Real-time currency conversion
- **LSPS1 Protocol** - Standard LSP communication protocol

## Supported LSPs

- **Olympus** - Lightning infrastructure provider
- **LNServer Wave** - Professional Lightning services
- **Megalith** - Enterprise Lightning solutions
- **Flashsats** - Lightning channel services

*More LSPs can be easily added by extending the configuration.*

## How It Works

1. **Automated Data Collection**: Vercel Cron Jobs fetch prices from all LSPs daily
2. **Real-time Storage**: Latest prices are stored in Vercel KV (Redis-compatible database)
3. **Live Conversion**: Prices are converted to multiple currencies using Alby's Lightning Tools
4. **Public API**: Other applications can access current prices via REST API
5. **User Interface**: Clean, responsive table showing price comparisons with filtering options

## API Usage

### Get Current Prices
```bash
GET /api/prices?channelSize=1000000
```

### Health Check
```bash
GET /api/health
```

### Response Format
```json
{
  "success": true,
  "data_source": "live",
  "total_lsps": 4,
  "prices": [
    {
      "lsp_id": "olympus",
      "lsp_name": "Olympus",
      "channel_size": 1000000,
      "price": 15750000,
      "source": "live",
      "timestamp": "2025-09-17T12:38:44.799Z"
    }
  ]
}
```

### API Features
- **No authentication** - completely open
- **CORS enabled** - works from any website  
- **Channel filtering** - `?channelSize=2000000` for 2M sats
- **Live/cached data** - automatic fallback system
- **Rate limit**: ~100 requests/minute

## LSP Status

- **🟢 Olympus**: Live data with LSPS1 protocol
- **🟢 LNServer Wave**: Live data with autodiscovery  
- **🟢 Megalith**: Live data with dedicated public key
- **🟢 Flashsats**: Live data with dedicated public key
- **🟡 Smart fallback**: Cached data when live fetches fail

## Quick Start

### Local Development
```bash
# Clone the repository
git clone https://github.com/NodeDiver/alby-lsp-priceboard.git
cd alby-lsp-priceboard

# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test
```

### Docker Deployment
```bash
# Clone the repository
git clone https://github.com/NodeDiver/alby-lsp-priceboard.git
cd alby-lsp-priceboard

# Build and run with Docker
npm run docker:build
npm run docker:run

# Or use Docker Compose
npm run docker:compose
```

### Production Deployment

#### Vercel (Recommended)
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy to Vercel
vercel --prod
```

#### Docker
```bash
# Build and run with Docker
docker build -t alby-lsp-priceboard .
docker run -p 3000:3000 alby-lsp-priceboard
```

### Configuration
Set up Vercel KV and configure environment variables for database connection.

## Contributing

Submit issues and pull requests on [GitHub](https://github.com/NodeDiver/alby-lsp-priceboard).

## License

MIT License - see LICENSE file.
