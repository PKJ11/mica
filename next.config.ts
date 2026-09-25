import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Make sure the activity HTML files ship with the server bundle.
  outputFileTracingIncludes: {
    "/api/activity/[slug]": ["./content/**/*"],
  },
};

export default nextConfig;
