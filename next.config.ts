import type { NextConfig } from "next";

/**
 * Next.js configuration for the bingo draft app.
 *
 * Deployed to Vercel. Server routes that write to the database use the Node.js
 * runtime so they can hold the server-only connection string and run real
 * Postgres transactions.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Dev only (ignored in production builds): let a phone or other device on the same
  // network load the dev server by LAN address or `.local` name. Without this Next.js
  // blocks its hot-reload socket from any host but localhost. Patterns match one dot
  // segment per `*`, so these cover the common private ranges.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.*.*.*", "*.local"],
  // Dev seeding reads the demo squares from disk; include the file in that route's
  // deployment bundle (dev tools may run on a Preview deployment).
  outputFileTracingIncludes: {
    "/api/dev/seed": ["./lib/dev/demo_squares.csv"],
  },
};

export default nextConfig;
