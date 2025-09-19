# TODO - Project Task List

A human-readable list of tasks and improvements for the Alby LSP Price Board project.

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

## 🎯 Future Enhancements (Low Priority)

### New Features
- **Add More LSPs**: Expand beyond current 4 LSPs to include more Lightning Service Providers
- **Historical Data Visualization**: Simple graphs showing price trends over time
- **Admin Dashboard**: Basic interface for viewing system health and managing LSPs

### UI Clarity and Onboarding (Simple)
- Above-the-fold subtitle (one sentence under title): “Compare how much different Lightning Service Providers (LSPs) charge to open you an inbound channel of the selected size.”
- Small tooltips (one sentence each): LSP, Channel size, Fee, Live vs Cached.
- Fee caption under Fee header: “Shown fee = provider’s quoted channel-open cost. May exclude future routing fees.”
- Currency clarity line near selector: “Converted using Alby Lightning Tools at HH:MM UTC.” Update on refresh and currency change.
- Timestamps: standardize “Last:” labels to ISO date + time + “UTC”; add a “Last global update” line above the table.
- Retry UX: disable Retry while fetching and show a small spinner in the button. Keep Force button’s spinner.
- Provider link: make provider name link to website when available (open in new tab). Keep logo/initial fallback.
- Persist user choices: save last selected channel size and currency to localStorage and restore on load.
- Empty state: show friendly message with two buttons (“Refresh all providers”, “Technical details”) and a short reason if known.
- Accessibility: add aria-labels for interactive controls and ensure status chip contrast meets WCAG AA.
- Numbers: show USD in parentheses beside sats when conversion is available (e.g., “12.5K sats ($3.21)”).

### Technical Improvements
- **API Documentation**: OpenAPI/Swagger documentation for public endpoints
- **Performance Monitoring**: Detailed metrics and logging for production monitoring
- **Automated Testing**: Integration tests with mock LSP endpoints
- **Error Alerting**: Notifications when LSPs go offline or return errors consistently

### Optional Polish
- **Cron Frequency**: Consider increasing from daily to 15-30 minutes if needed
- **Debug Route Security**: Optionally restrict debug endpoints in production
- **Mobile UI**: Optimize responsive design for mobile devices
 - **Sorting and Defaults**: Default sort by lowest fee; clickable sort on Fee/Provider/Last Update; remember sort in localStorage
 - **Data Source Popover**: Clicking Live/Cached chip shows “Fetched N mins ago”
 - **Per-row Details Drawer**: Fee breakdown (if available), size range, provider link, and raw API snippet (collapsed)
 - **Sticky Helpers**: Keep Channel Size and Currency controls sticky on desktop; on mobile, collapse filters into a top sheet
 - **API Section Accordion**: Collapse “Public API Access” by default with copy-buttons for examples

## 📋 Current Status

**Project Status**: ✅ **Production Ready v0.1**
- All major code quality improvements completed
- Comprehensive testing in place  
- Health monitoring active
- Documentation up to date
- No critical issues or technical debt

**Next Steps**: The project is stable and production-ready. Future work should focus on new features rather than technical improvements.

---

*Last Updated: September 19, 2025*
*All major TODO items from previous versions have been completed.*
