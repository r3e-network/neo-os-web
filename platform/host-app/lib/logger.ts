/**
 * Structured logger using Pino
 * Provides JSON logging in production, pretty printing in development
 * Maintains backward compatibility with existing logger API
 */

import pino from "pino";
import { env } from "./env";

const isDev = env.NODE_ENV === "development";

const pinoLogger = pino({
  level: isDev ? "debug" : "info",
  transport: isDev
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:standard",
          ignore: "pid,hostname",
        },
      }
    : undefined,
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
