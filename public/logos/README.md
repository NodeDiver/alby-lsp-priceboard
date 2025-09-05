# LSP Logos

This directory is no longer used for LSP logos.

## New Approach (Following Alby Hub Pattern):

LSP icons are now **dynamically fetched** from each LSP's metadata endpoint, just like Alby Hub does. This approach:

- ✅ **Automatically gets official logos** from each LSP
- ✅ **Always up-to-date** with LSP branding changes  
- ✅ **No maintenance required** - LSPs manage their own icons
- ✅ **Fallback to initials** if no icon is provided

## How it works:

1. Each LSP provides metadata via their `/info` endpoint
2. The frontend fetches this metadata including `icon` or `logo` URLs
3. Icons are displayed directly from the LSP's provided URL
4. If no icon is available, falls back to LSP name initials

This follows the same pattern as [Alby Hub's channel creation page](https://github.com/getAlby/hub).
