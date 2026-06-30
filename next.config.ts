import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ioredis uses native Node.js modules (net, tls, stream).
  // Marking it as a server external package prevents Webpack from bundling it
  // which avoids "can't resolve 'net'" errors in production / Vercel deployments.
  serverExternalPackages: ['ioredis'],
};

export default nextConfig;
