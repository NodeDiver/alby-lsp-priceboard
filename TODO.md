# TODO - Project Task List v0.3

A human-readable list of tasks and improvements for the Alby LSP Price Board project.

## 🚨 **Critical: LSP Blocking Problem**

Our LSP price board faces blocking by both Node ID and IP address from Lightning Service Providers due to high-frequency data fetching. **We need to implement Node ID rotation using lightweight LDK nodes and IP rotation (weekly changes) to maintain service sustainability.**

### LSP Blocking Solutions (High Priority)
- **🔍 Analyze LSP blocking mechanisms** - Test which LSPs block by Node ID vs IP address
- **🔄 Implement lightweight LDK node generation** - For automatic Node ID rotation  
- **🌐 Research and implement weekly IP address rotation** - Cost-effective solution
- **⚡ Optimize request patterns** - Reduce blocking risk across all LSPs
- **📊 Add monitoring system** - Detect when LSPs start blocking requests
- **🛡️ Implement fallback mechanisms** - When primary Node IDs get blocked

## 🎯 Future Enhancements

### Code Quality and Performance Improvements
- **Consolidate localStorage handling**: Drop manual `localStorage.setItem` calls in channel-size, currency, Pro mode, and historical toggles and rely on `usePersistentState` to persist updates (prevents JSON vs plain string conflicts)
- **Unify price loading logic**: Fold `handleRetryLSP`, `fetchPrices`, and `handleForceFetchLSP` into a single `loadPrices({ channelSize, fresh, force, lspId, endpoint })` helper for centralized error/timeout handling
- **Extend data source descriptions**: Add support for `mixed`, `unavailable`, and `estimated` states in `getDataSourceDescription` helper to match UI strings
- **Standardize channel size parsing**: Reshape `parseChannelSize` to accept raw query values and apply consistent clamp logic across all API handlers
- **Optimize PriceTable rendering**: Extract `PriceCell` subcomponent and use `useMemo` for sorted LSP list to prevent expensive filter/find operations on every render

### UI and UX Improvements
- **Dark mode**: Add dark/light theme toggle for better user experience
- **Routing fees display**: Add routing fees for each LSP to provide complete cost comparison
- **Smart force button system**: Hide force buttons behind a single unlock button (left of Technical Details, right of Refresh Prices)
- **Intelligent refresh logic**: Hide refresh button when all LSPs show live/green data, and only refresh non-live LSPs
- **Relocate Technical Details**: Move Technical Details button to a better location, keep only the "power" button for force features
- **LNServer channel size messaging**: Show "Choose larger channel size" instead of error for 1M channels (LNServer doesn't support 1M)

### Historical Data and Analytics
- **Historical data toggle**: Add switch similar to Alby Hub app connection switch to toggle between live comparison and historical view
- **Responsive historical table**: Replace LSP comparison with historical data table when toggled
- **Historical data visualization**: Green for USD, Bitcoin orange for sats, with thick fun lines
- **Time range filters**: Last week, 15 days, month, 3 months, 6 months, year, all time
- **Paywall for extended history**: Free access for last 15 days, paid access for longer periods

### Monetization Strategy
- **Historical data paywall**: Monetize access to data older than 15 days
- **LSP-specific data monetization**: Revenue sharing with LSPs for detailed analytics
- **Premium features**: Advanced filtering, alerts, and historical insights

### Technical Infrastructure
- **Offline/Online status detection**: Implement network connectivity monitoring and user notification system
- **Randomized node IDs**: System for using random node IDs that peer with LSPs first
- **IP randomization**: Investigate methods for randomizing IP addresses and optimal frequency
- **Advanced peering**: Automated peering system before price requests
- **Immortan solution** (optional): For LSPs denying price requests - randomized node ID system
  - References: [standardsats/immortan](https://github.com/standardsats/immortan), [nbd-wtf/immortan](https://github.com/nbd-wtf/immortan)

## ✅ Recently Completed - Version 0.2 (September 2025)

### Major UX & Readability Improvements
- **✅ Pro Mode Toggle System**: Added Pro Mode 💪 toggle with conditional button visibility (Refresh Prices, Technical Details, Retry, Force buttons only show when Pro Mode is ON)
- **✅ Comprehensive Typography Overhaul**: Upgraded all text sizes and hierarchy for better readability and professional appearance
  - Main title: `text-4xl font-bold` (more prominent)
  - Subtitle: `text-xl` (better hierarchy)
  - Table headers: `text-lg font-semibold` (matches large prices)
  - LSP names: `text-lg font-semibold` (clear provider names)
  - Status badges: `text-sm font-medium` (much more readable)
  - Error messages: `text-base font-medium` (better visibility)
  - API documentation: `text-base` (improved readability)
  - Small details: `text-sm` (less cramped)
- **✅ Enhanced Price Display**: Made sats prices `text-2xl font-bold` and fiat prices `text-lg font-semibold` for better visual hierarchy
- **✅ Timestamp Display Improvements**: 
  - Shows full date with neutral clock emoji (🕒)
  - Hover over clock shows time in tooltip
  - Consistent formatting across all timestamp displays
- **✅ UI Polish & Consistency**:
  - Fixed button sizing to prevent line movement when Pro Mode toggles
  - Updated "Cached" legend styling to match table badges
  - Improved legend layout with descriptions next to badges
  - Enhanced "Report Issue" button color (`bg-slate-700`) for better theme consistency
  - Removed unwanted tooltip hover behavior from "Fee" column header
- **✅ Animation Enhancements**: Added professional fade-in animations for Pro Mode buttons
- **✅ Color Theme Consistency**: Ensured all elements follow the gray/black/white color scheme

### Technical Improvements
- **✅ Timestamp Consistency**: Fixed timestamp display consistency between "Last" column and fee column
- **✅ UI Component Cleanup**: Removed unnecessary tooltips and hover effects that disrupted user experience

## ✅ Previously Completed - Version 0.1 (September 2025)

### Major Improvements
- **✅ Database Cleanup**: Removed duplicate `lib/db-improved.ts` and consolidated everything into `lib/db.ts`
- **✅ LSPS1 Consistency**: All modules now use `/get_info` endpoint (standardized across the codebase)
- **✅ Redis Configuration**: Unified env detection with shared helper in `lib/redis-config.ts`
- **✅ Type Safety**: Added proper TypeScript imports to migration script and exported `toLspError` function
- **✅ UI Polish**: Smart button visibility - Force/Retry buttons only show when needed (not on live data)
- **✅ Debug Architecture**: Added proper getter method for in-memory cache access instead of direct private access
- **✅ Health Monitoring**: New `/api/health` endpoint for system status and uptime monitoring
- **✅ Unit Testing**: Jest framework with comprehensive tests for LSPS1 error mapping and database serialization
- **✅ Documentation**: Updated README, AGENTS.md, and PROJECT_SUMMARY.md to reflect all improvements
- **✅ UI Clarity v0.1**: Added clear purpose subtitle, helpful tooltips, improved empty states, better button labels, collapsed API section, and version footer

### Technical Fixes
- **✅ Rate Limiting**: Fixed LSP ID mismatch (`lnserver-wave` → `lnserver`)
- **✅ Cache Clearing**: Updated to handle new keyspace structure (`alby:lsp:channel:*`, etc.)
- **✅ Build Configuration**: Documented TypeScript build setting (kept disabled for Next.js 15 compatibility)

### UI Clarity Improvements
- **✅ Clear Purpose Statement**: Added explanatory subtitle about lightning Service Providers and channel opening
- **✅ Essential Tooltips**: Hover explanations for LSP, Channel Size, and Fee terms
- **✅ Duplicate Pricing Fix**: Removed duplicate USD pricing display, kept only clean USD below sats
- **✅ Collapsed API Section**: Developer-focused content hidden by default with accordion
- **✅ Friendly Button Labels**: "Refresh Prices" and "Technical Details" instead of technical terms
- **✅ Improved Empty States**: Helpful messages with clear actions instead of technical errors
- **✅ Smart Price Sorting**: Default sort by lowest price for best user experience
- **✅ Currency Clarity**: USD amounts shown cleanly below sats without duplicates
- **✅ Persistent Preferences**: User choices saved in localStorage and restored on page load
- **✅ Version Information**: Footer shows v0.1 with project details
- **✅ LNServer 1M Fix**: Shows "Channel size too small" instead of "Cache unavailable" for LNServer 1M channels

**Next Steps**: The project is stable and user-friendly. Future work should focus on the enhancements listed above based on user feedback and business requirements.

## 💰 Monetization Ideas (Learning)

### Alby LSP Price Board Revenue Streams
- **Premium Live Data**: Pay sats for latest prices (free tier shows cached data)
- **Historical Access**: Pay sats to access data older than 24 hours
- **Large Channels**: Pay sats to view prices for 3M-10M channels (free tier: 1M-2M only)
- **API Access**: 1 free request/day, pay sats for additional API calls

---

*Last Updated: October 4, 2025*  
*Version 0.2.1 - Production Ready with Major UX & Readability Improvements + LSP Blocking Problem Identified*