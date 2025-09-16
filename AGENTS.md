# Project Agents & Contributors

## Project Overview
**Alby LSP Price Board** - A real-time Lightning Service Provider price comparison tool that helps users make informed decisions when opening Lightning channels.

## Primary Contributors

### Lead Developer
- **Role**: Full-stack development, architecture, deployment
- **Responsibilities**: 
  - Next.js application development
  - LSP integration and API implementation
  - Database design and management
  - Frontend UI/UX development
  - Vercel deployment and configuration

## Project Status
- **Current Phase**: Production Ready with Live Data
- **Last Updated**: September 2025
- **Deployment Status**: Live on Vercel
- **Code Quality**: Production-ready, fully tested
- **LSPs**: 4 working LSPs - 2 with LIVE data, 2 with smart fallback handling
- **Breakthrough**: Successfully implemented LSPS1 protocol for live pricing
- **Latest Features**: Individual LSP timestamps, smart caching, non-blocking UI

## Technology Stack
- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Vercel KV (Redis)
- **Deployment**: Vercel (recommended), Docker support
- **External APIs**: Alby Lightning Tools, LSPS1 Protocol
- **LSPs**: 
  - 🟢 **LIVE DATA**: LNServer Wave, Megalith (LSPS1 protocol)
  - 🟡 **SMART FALLBACK**: Olympus, Flashsats (intelligent caching and error handling)

## Development Guidelines

### Code Standards
- TypeScript for type safety
- ESLint configuration for code quality
- Clean, professional code with minimal dependencies
- Comprehensive error handling

### API Endpoints
- `GET /api/prices` - Public pricing data (read-only, cached data only)
- `GET /api/prices-ui` - UI-specific pricing data (smart caching with live fetching)
- `GET /api/lsp-metadata` - LSP metadata and icons
- `GET /api/debug` - System status and health checks
- `POST /api/cron/fetch-prices` - Automated price fetching for 1M/2M/5M/10M channels (Vercel Cron)

### Project Structure
```
alby-lsp-priceboard/
├── components/          # React components
├── lib/                # Utility libraries and services
├── pages/              # Next.js pages and API routes
├── public/             # Static assets
├── styles/             # Global CSS
├── AGENTS.md           # This file
├── README.md           # Project documentation
├── LICENSE             # MIT License
└── vercel.json         # Vercel configuration
```

## Getting Started
1. Clone the repository
2. Install dependencies: `npm install`
3. Start development server: `npm run dev`
4. Deploy to Vercel: `vercel --prod`
5. Or run with Docker: `npm run docker:compose`

## Related Issues
- [Alby Hub Issue #1001](https://github.com/getAlby/hub/issues/1001) - Original feature request

## License
MIT License - see [LICENSE](LICENSE) file for details.
