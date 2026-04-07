import type { NextConfig } from "next";

// v1.0.1 - 42 entries
const nextConfig: NextConfig = {
  trailingSlash: true,
  images: {
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
  // CSS プリロード最適化：未使用スタイルシートの事前読み込み警告を削減
  onDemandEntries: {
    maxInactiveAge: 25000,
    pagesBufferLength: 5,
  },
};


export default nextConfig;
