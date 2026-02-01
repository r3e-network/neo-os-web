/**
 * Structured logger using Pino
 * Provides JSON logging in production, pretty printing in development
 * Maintains backward compatibility with existing logger API
 */

import pino from "pino";

// Use process.env directly to avoid server-side env import on client
const isDev = process.env.NODE_ENV === "development";

// pino-pretty transport only works on server side
const pinoLogger = pino({
  level: isDev ? "debug" : "info",
  browser: {
    asObject: true,
  },
});

// Wrapper to maintain backward compatibility with existing logger API
export const logger = {
  debug: (message: string, ...args: unknown[]) => {
    pinoLogger.debug({ args }, message);
  },
  info: (message: string, ...args: unknown[]) => {
    pinoLogger.info({ args }, message);
  },
  warn: (message: string, ...args: unknown[]) => {
    pinoLogger.warn({ args }, message);
  },
  error: (message: string, error?: unknown) => {
    pinoLogger.error({ error }, message);
  },
};
