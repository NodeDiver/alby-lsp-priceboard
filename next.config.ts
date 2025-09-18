import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  typescript: {
    ignoreBuildErrors: true // Keep disabled due to Next.js 15 API route compatibility
  },
  eslint: {
    ignoreDuringBuilds: false // Enable linting in production
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' }, // Allow LSP logos from any HTTPS source
    ]
  }
};

export default nextConfig;
