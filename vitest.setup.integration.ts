/**
 * Setup for LIVE integration runs. Vitest does not auto-load `.env.local`, so
 * load it here. Existing `process.env` values win (`override: false`) so
 * CI-provided values are respected. Wired in only for `test:integration`.
 */
import { config as loadDotenv } from "dotenv";

loadDotenv({ path: ".env.local", override: false, quiet: true });
