import type { NextConfig } from "next";

// v1.0.1 - 42 entries
const nextConfig: NextConfig = {
  output: "export",
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
};


export default nextConfig;
