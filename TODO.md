# TODO - Project Task List v0.1

A human-readable list of tasks and improvements for the Alby LSP Price Board project.

## 🎯 Future Enhancements

### UI and UX Improvements
- **Fix duplicate pricing display**: Resolve any duplicate price entries showing in the table
- **Timestamp consistency**: Ensure "Last" timestamp matches the fee column timestamp display
- **Dark mode**: Add dark/light theme toggle for better user experience
- **Smart force button system**: Hide force buttons behind a single unlock button (left of Technical Details, right of Refresh Prices)
- **Intelligent refresh logic**: Hide refresh button when all LSPs show live/green data, and only refresh non-live LSPs
- **Relocate Technical Details**: Move Technical Details button to a better location, keep only the "power" button for force features
- **LNServer channel size messaging**: Show "Choose larger channel size" instead of error for 1M channels (LNServer doesn't support 1M)
- **Fix LNServer 1M bug**: Show "Channel size too small" instead of "Cache unavailable" for 1M channels

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
- **Randomized node IDs**: System for using random node IDs that peer with LSPs first
- **IP randomization**: Investigate methods for randomizing IP addresses and optimal frequency
- **Advanced peering**: Automated peering system before price requests

## ✅ Recently Completed - Version 0.1 (September 2025)

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
- **✅ Clear Purpose Statement**: Added explanatory subtitle about Lightning Service Providers and channel opening
- **✅ Essential Tooltips**: Hover explanations for LSP, Channel Size, and Fee terms
- **✅ Collapsed API Section**: Developer-focused content hidden by default with accordion
- **✅ Friendly Button Labels**: "Refresh Prices" and "Technical Details" instead of technical terms
- **✅ Improved Empty States**: Helpful messages with clear actions instead of technical errors
- **✅ Smart Price Sorting**: Default sort by lowest price for best user experience
- **✅ Currency Clarity**: USD amounts shown in parentheses next to sats
- **✅ Persistent Preferences**: User choices saved in localStorage and restored on page load
- **✅ Version Information**: Footer shows v0.1 with project details

**Next Steps**: The project is stable and user-friendly. Future work should focus on the enhancements listed above based on user feedback and business requirements.

---

*Last Updated: September 19, 2025*  
*Version 0.1 - Production Ready with UI Clarity Improvements*