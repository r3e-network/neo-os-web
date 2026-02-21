/**
 * Simple logger utility for production-safe logging
 * In production, logs are suppressed unless explicitly enabled
 */

const isDev = process.env.NODE_ENV === "development";
const isDebugEnabled = process.env.DEBUG === "true";

export const logger = {
  debug: (message: string, ...args: unknown[]) => {
    if (isDev || isDebugEnabled) {
      console.log(`[DEBUG] ${message}`, ...args);
    }
  },

  info: (message: string, ...args: unknown[]) => {
    if (isDev || isDebugEnabled) {
      console.log(`[INFO] ${message}`, ...args);
    }
  },

  warn: (message: string, ...args: unknown[]) => {
    console.warn(`[WARN] ${message}`, ...args);
  },

  error: (message: string, error?: unknown) => {
    console.error(`[ERROR] ${message}`, error);
  },
};
