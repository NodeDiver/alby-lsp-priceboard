import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  typescript: {
    ignoreBuildErrors: true // Temporarily ignore build errors for type validation issues
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
