import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Make sure the activity HTML files ship with the server bundle.
  outputFileTracingIncludes: {
    "/api/activity/[slug]": ["./content/**/*"],
  },
  // Loaded at runtime from node_modules (PGlite ships WASM files that must not be bundled).
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
};

export default nextConfig;
