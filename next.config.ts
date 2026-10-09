import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A second dev server (e.g. for automated tests) can run beside `npm run dev` with NEXT_DIST_DIR=.next-test.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Make sure the activity HTML files ship with the server bundle.
  outputFileTracingIncludes: {
    "/api/activity/[slug]": ["./content/**/*"],
  },
  // Loaded at runtime from node_modules (PGlite ships WASM files that must not be bundled).
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
};

export default nextConfig;
