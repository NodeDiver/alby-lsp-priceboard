# Project Agents & Contributors

## Project Overview
**Alby LSP Price Board** - A real-time lightning Service Provider price comparison tool that helps users make informed decisions when opening lightning channels.

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
- **Current Phase**: Production Ready v0.2.2 with Major UX & Readability Improvements
- **Last Updated**: October 20, 2025
- **Deployment Status**: Live on Vercel
- **Code Quality**: Production-ready, fully tested
- **LSPs**: 4 working LSPs - 3 with LIVE data (Olympus, LNServer Wave, Flashsats), 1 with smart fallback (Megalith)
- **Breakthrough**: Successfully implemented LSPS1 protocol with persistent data storage
- **Latest Features**: Fixed hydration error, stable table layout, Pro Mode toggle system, comprehensive typography overhaul, enhanced price display, timestamp improvements, UI polish, animation enhancements, per-LSP force fetch, 1-hour fresh cache rule, multi-channel cron jobs, LSP-specific public keys, unified Redis config, LSPS1 path consistency, unit tests, health monitoring, loading loop fixes, WebLN error handling, support button integration, code refactoring with 7/11 ChatGPT suggestions implemented
- **⚠️ CRITICAL ISSUE**: LSP blocking problem identified - LSPs may block requests by Node ID and/or IP address, requiring immediate implementation of Node ID rotation (lightweight LDK nodes) and IP rotation (weekly changes)

## Technology Stack
- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Vercel KV (Redis)
- **Deployment**: Vercel (recommended), Docker support
- **External APIs**: Alby lightning Tools, LSPS1 Protocol
- **LSPs**: 
  - 🟢 **LIVE DATA**: Olympus, LNServer Wave, Flashsats (LSPS1 protocol with dedicated public keys)
  - 🟡 **SMART FALLBACK**: Megalith (intelligent caching and error handling)

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
- `GET /api/health` - System health monitoring and uptime status
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
