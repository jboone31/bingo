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
};

export default nextConfig;
