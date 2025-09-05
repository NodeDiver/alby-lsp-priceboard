# Alby LSP Price Board

A real-time Lightning Service Provider (LSP) price comparison tool that helps users make informed decisions when opening Lightning channels.

## Problem Solved

This project addresses [Alby Hub Issue #1001](https://github.com/getAlby/hub/issues/1001) - users want to see LSP pricing information upfront before selecting one, instead of only seeing costs after clicking "Next".

## Features

- **Real-time price comparison** across multiple LSPs
- **Multi-currency support** with live conversion using Alby's Lightning Tools
- **Channel size filtering** (1M-10M sats)
- **Public REST API** for integration with other applications
- **Automatic price updates** every 10 minutes via Vercel Cron Jobs
- **Clean, responsive UI** with professional design 

## Technology Stack

- **Next.js 15** - React framework with API routes
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first styling
- **Vercel KV** - Redis-compatible database for price storage
- **Vercel Cron Jobs** - Automated price fetching every 10 minutes
- **Alby Lightning Tools** - Real-time currency conversion
- **LSPS1 Protocol** - Standard LSP communication protocol

## Supported LSPs

- **Olympus** - Lightning infrastructure provider
- **LNServer Wave** - Professional Lightning services
- **Megalith** - Enterprise Lightning solutions
- **Flashsats** - Lightning channel services

*More LSPs can be easily added by extending the configuration.*

## How It Works

1. **Automated Data Collection**: Vercel Cron Jobs fetch prices from all LSPs every 10 minutes
2. **Real-time Storage**: Latest prices are stored in Vercel KV (Redis-compatible database)
3. **Live Conversion**: Prices are converted to multiple currencies using Alby's Lightning Tools
4. **Public API**: Other applications can access current prices via REST API
5. **User Interface**: Clean, responsive table showing price comparisons with filtering options

## API Usage

### Get Current Prices
```bash
GET /api/prices?channelSize=1000000
```

### Response Format
```json
{
  "success": true,
  "last_update": "2025-09-05T16:24:06.744Z",
  "total_lsps": 4,
  "prices": [
    {
      "lsp_id": "olympus",
      "lsp_name": "Olympus",
      "channel_size": 1000000,
      "price": 12000,
      "channel_fee_percent": 0.012,
      "timestamp": "2025-09-05T16:24:06.744Z"
    }
  ]
}
```

### Features
- **No authentication required** - completely open API
- **CORS enabled** - works from any website
- **Channel size filtering** - add `?channelSize=2000000` for 2M sats
- **Real-time data** - prices update every 10 minutes automatically

## Development Status

### ✅ Completed Features
- **Core Infrastructure**: Next.js app with TypeScript and Tailwind CSS
- **LSP Integration**: Support for 4 major LSPs using LSPS1 protocol
- **Price Management**: Automated fetching and caching system
- **Multi-Currency Support**: Real-time conversion using Alby Lightning Tools
- **User Interface**: Responsive price comparison table with filtering
- **Public API**: RESTful endpoints for external integration
- **Vercel Configuration**: Ready for deployment with cron jobs

### 🚀 Ready for Production
- All core features implemented and tested
- Professional UI/UX design
- Comprehensive error handling
- Clean, maintainable codebase
- Production-ready deployment configuration

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
1. **Set up Vercel KV** in your Vercel dashboard
2. **Configure environment variables** for database connection
3. **Deploy** using your preferred method

## Contributing

This project follows standard open-source practices. Feel free to submit issues and pull requests.

## License

MIT License - see LICENSE file for details.
