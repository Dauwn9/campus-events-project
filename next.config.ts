import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    agentFeedback: false,
    serverActions: {
      bodySizeLimit: "5mb",
    },
  },
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;