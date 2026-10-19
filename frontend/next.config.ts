import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone", // minimal server.js for the Docker image (step 8)
  agentRules: false, // no generated instruction files
};

export default nextConfig;
