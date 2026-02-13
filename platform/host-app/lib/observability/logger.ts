/**
 * Structured logging utility with trace ID support
 * Wraps pino for production-grade structured logging
 */

import pino from "pino";

type LogLevel = "debug" | "info" | "warn" | "error";

// Global trace context (request-scoped in SSR, session-scoped in browser)
let globalTraceId: string | undefined;
let globalSpanId: string | undefined;

export function generateTraceId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
}

export function generateSpanId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function setTraceContext(traceId: string, spanId?: string): void {
  globalTraceId = traceId;
  globalSpanId = spanId;
}

export function getTraceContext(): { traceId?: string; spanId?: string } {
  return { traceId: globalTraceId, spanId: globalSpanId };
}

export function clearTraceContext(): void {
  globalTraceId = undefined;
  globalSpanId = undefined;
}

const pinoLevel = process.env.NODE_ENV === "development" ? "debug" : "info";

function makePinoInstance(name: string): pino.Logger {
  return pino({
    name,
    level: pinoLevel,
    ...(process.env.NODE_ENV === "development" && {
      transport: { target: "pino-pretty", options: { colorize: true } },
    }),
  });
}

class Logger {
  private pino: pino.Logger;

  constructor(name: string, pinoInstance?: pino.Logger) {
    this.pino = pinoInstance ?? makePinoInstance(name);
  }

  debug(message: string, context?: Record<string, unknown>) {
    this.pino.debug({ ...this.traceBindings(), ...context }, message);
  }

  info(message: string, context?: Record<string, unknown>) {
    this.pino.info({ ...this.traceBindings(), ...context }, message);
  }

  warn(message: string, context?: Record<string, unknown>) {
    this.pino.warn({ ...this.traceBindings(), ...context }, message);
  }

  error(message: string, context?: Record<string, unknown>) {
    this.pino.error({ ...this.traceBindings(), ...context }, message);
  }

  child(childContext: Record<string, unknown>): Logger {
    return new Logger("", this.pino.child(childContext));
  }

  private traceBindings(): Record<string, unknown> {
    const ctx: Record<string, unknown> = {};
    if (globalTraceId) ctx.traceId = globalTraceId;
    if (globalSpanId) ctx.spanId = globalSpanId;
    return ctx;
  }
}

export function createLogger(name: string): Logger {
  return new Logger(name);
}

export const appLogger = createLogger("app");
