import type { NextConfig } from "next";

// v1.0.1 - Cloudflare Pages optimized
const nextConfig: NextConfig = {
  trailingSlash: true,
  turbopack: {},
  images: {
    localPatterns: [
      {
        pathname: '/images/**',
      },
    ],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'placehold.co',
      },
      {
        protocol: 'https',
        hostname: 'image.pollinations.ai',
      },
    ],
    dangerouslyAllowSVG: true,
    unoptimized: true,
  },
  // Cloudflare Pages compatibility: use Edge Runtime where possible
  experimental: {
    serverMinification: true,
  },
  // CSS プリロード最適化：未使用スタイルシートの事前読み込み警告を削減
  onDemandEntries: {
    maxInactiveAge: 25000,
    pagesBufferLength: 5,
  },
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        ...config.watchOptions,
        ignored: [
          '**/node_modules/**',
          '**/.git/**',
          '**/app/data/**',
          '**/public/images/**',
        ],
      };
    }
    return config;
  },
};

export default nextConfig;
