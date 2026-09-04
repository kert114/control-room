import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["pg"],
  eslint: {
    dirs: ["src"],
  },
};

export default nextConfig;
