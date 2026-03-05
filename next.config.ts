import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  async rewrites() {
    return [
      {
        source: "/api/proxy-spec/:project",
        destination:
          "https://staging-api2.leadliaison.com/api/specs.json?project=:project",
      },
    ];
  },
};

export default nextConfig;
