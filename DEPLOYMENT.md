# Deployment Guide

## Overview
This guide covers deploying the Alby LSP Price Board to production. The application supports multiple deployment options:

- **Vercel (Recommended)**: Serverless deployment with Vercel KV
- **Docker**: Containerized deployment for any platform  
- **Local Development**: Both npm and Docker options available

**Current Status**: Live on Vercel with 4 working LSPs - 3 providing LIVE data via LSPS1 protocol, 1 with smart fallback handling. Latest features include Pro Mode toggle system, historical data visualization, health monitoring, WebLN support integration, and comprehensive code refactoring.

## 🚀 Vercel Deployment (Recommended)

### Prerequisites
- Vercel account ([vercel.com](https://vercel.com))
- GitHub repository access
- Vercel CLI installed (`npm i -g vercel`)

### Quick Deploy
```bash
# Clone and setup
git clone https://github.com/NodeDiver/alby-lsp-priceboard.git
cd alby-lsp-priceboard
npm install

# Deploy to Vercel
vercel --prod
```

### Step-by-Step Deployment

#### 1. Connect Repository
1. Go to [vercel.com](https://vercel.com)
2. Sign in with GitHub
3. Click "New Project"
4. Import `NodeDiver/alby-lsp-priceboard`

#### 2. Configure Vercel KV
1. In project dashboard → "Storage"
2. Click "Create Database" → "KV"
3. Select region (closest to users)
4. Click "Create"

#### 3. Environment Variables
Add these in Vercel project settings:

```bash
KV_URL=your_kv_url_here
KV_REST_API_URL=your_kv_rest_url_here
KV_REST_API_TOKEN=your_kv_token_here
KV_REST_API_READ_ONLY_TOKEN=your_readonly_token_here
```

#### 4. Deploy
- Vercel auto-detects Next.js configuration
- Click "Deploy" and wait for completion
- Cron jobs activate automatically

#### 5. Custom Domain (Optional)
1. Project settings → "Domains"
2. Add your domain
3. Configure DNS as instructed

## 🐳 Docker Deployment

### Prerequisites
- Docker installed
- Environment variables configured

### Quick Start
```bash
# Using npm scripts (recommended)
npm run docker:build
npm run docker:run

# Or using Docker Compose
npm run docker:compose
```

### Manual Docker Commands
```bash
# Build image
docker build -t alby-lsp-priceboard .

# Run container
docker run -p 3000:3000 \
  -e KV_URL=your_kv_url \
  -e KV_REST_API_URL=your_rest_url \
  -e KV_REST_API_TOKEN=your_token \
  alby-lsp-priceboard
```

### Using Docker Compose
```yaml
version: '3.8'
services:
  alby-lsp-priceboard:
    build: .
    ports:
      - "3000:3000"
    environment:
      - KV_URL=${KV_URL}
      - KV_REST_API_URL=${KV_REST_API_URL}
      - KV_REST_API_TOKEN=${KV_REST_API_TOKEN}
```

## 📊 Post-Deployment Verification

### 1. Health Checks
```bash
# Test main page
curl https://your-domain.vercel.app/

# Test API endpoints
curl https://your-domain.vercel.app/api/prices
curl https://your-domain.vercel.app/api/debug
```

### 2. Expected Responses
- **Main page**: LSP price comparison table with individual timestamps and status indicators
- **API prices**: JSON with current LSP pricing data (cached data only)
- **API prices-ui**: JSON with smart caching and live data fetching
- **API debug**: System status and configuration info

### 3. Cron Job Verification
- Check Vercel function logs for `/api/cron/fetch-prices`
- Verify prices update every 10 minutes
- Monitor Vercel KV for data persistence

## 🔧 Troubleshooting

### Common Issues

#### Build Failures
- **Node.js version**: Ensure compatibility with Next.js 15
- **Dependencies**: Run `npm install` before building
- **Memory limits**: Check Vercel build limits

#### Runtime Errors
- **Environment variables**: Verify all KV credentials are set
- **API errors**: Check Vercel function logs
- **CORS issues**: API endpoints have CORS enabled

#### Data Issues
- **No prices showing**: Check Vercel KV connection
- **Mock data only**: Verify KV environment variables
- **Stale data**: Check cron job execution logs

### Debug Commands
```bash
# Local testing
npm run dev

# Check build
npm run build

# Test production build
npm run start
```

### Support Resources
- [Vercel Documentation](https://vercel.com/docs)
- [Next.js Deployment Guide](https://nextjs.org/docs/deployment)
- [Vercel KV Documentation](https://vercel.com/docs/storage/vercel-kv)
