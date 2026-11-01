import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emits .next/standalone so container hosts (Render, Railway, Fly, Cloud Run,
  // Docker/VPS) can run the app without installing dev dependencies.
  output: "standalone",
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.pexels.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
};

export default nextConfig;
