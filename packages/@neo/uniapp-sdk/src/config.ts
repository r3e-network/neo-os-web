/**
 * SDK Configuration - Centralized configuration constants (DRY principle)
 */

/** API base URL for backend services */
export const API_BASE = import.meta.env.VITE_API_BASE || "https://api.neo-service-layer.io";

/** SDK timeout configuration */
export const SDK_TIMEOUTS = {
  /** Timeout for SDK initialization */
  SDK_INIT: 5000,
  /** Timeout for postMessage SDK calls */
  INVOKE: 10000,
  /** Timeout for bridge calls */
  BRIDGE: 5000,
  /** Delay before notifying host that miniapp is ready */
  READY_NOTIFY: 100,
} as const;

/** Production origins for SDK communication */
export const PRODUCTION_ORIGINS = [
  "https://neomini.app",
  "https://miniapp.neo.org",
  "https://testnet.miniapp.neo.org",
] as const;

/** Development origins for SDK communication */
export const DEV_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:3002",
  "http://localhost:3003",
  "http://localhost:3004",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3001",
  "http://127.0.0.1:3002",
] as const;
