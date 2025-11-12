# Local Development Setup Guide

## Running Locally with Production Database

This project runs locally on `localhost:3000` and connects to the **same production database** used by https://channelprices.com/

### Prerequisites

1. Node.js installed (v18+)
2. `.env.local` file configured with production Vercel KV credentials

### Environment Variables

The `.env.local` file must contain the production database credentials:

```env
KV_REST_API_URL=https://...upstash.io
KV_REST_API_TOKEN=xxxx
KV_REST_API_READ_ONLY_TOKEN=xxxx (optional)
```

**⚠️ Important**: These are the **production database credentials**. Any writes from local development will affect the production database. Be careful when testing write operations.

### Starting the Development Server

```bash
# Install dependencies (if not already done)
npm install

# Start the development server
npm run dev
```

The application will be available at: **http://localhost:3000**

### Database Connection

- **Database Type**: Vercel KV (Upstash Redis)
- **Connection**: Uses environment variables from `.env.local`
- **Shared Data**: Same database as production (https://channelprices.com/)
- **Read/Write Access**: Full read/write access to production data

### Important Notes

1. **Production Database**: Local development uses the same database as production. Any data changes will affect the live site.

2. **Cron Jobs**: Local cron jobs will not run automatically. They are configured in `vercel.json` and only execute on Vercel.

3. **API Endpoints**: All API endpoints work the same as production:
   - `/api/prices` - Get current prices
   - `/api/prices-ui` - UI-optimized prices
   - `/api/health` - System health
   - `/api/lsp-metadata` - LSP metadata
   - `/api/historical-data` - Historical price data

4. **Hot Reload**: Next.js development server supports hot module replacement for fast development.

### Troubleshooting

**Database Connection Issues:**
- Verify `.env.local` exists and contains correct credentials
- Check that `KV_REST_API_URL` and `KV_REST_API_TOKEN` are set
- Test connection by visiting `/api/health`

**Port Already in Use:**
- Kill existing process: `lsof -ti:3000 | xargs kill`
- Or use different port: `PORT=3001 npm run dev`

**Module Not Found:**
- Run `npm install` to install dependencies
- Delete `node_modules` and `package-lock.json`, then reinstall

### Stopping the Server

Press `Ctrl+C` in the terminal, or kill the process:
```bash
# Find and kill the process
ps aux | grep "next dev" | grep -v grep | awk '{print $2}' | xargs kill
```

### Last Updated

This file is automatically updated each time the project is run locally with production database configuration.

**Last run**: 2025-10-20 - Server successfully started on localhost:3000 with production database connection.

