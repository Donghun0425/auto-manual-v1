import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  allowedDevOrigins: ["172.16.100.*", "192.168.71.*"],
};

export default nextConfig;
