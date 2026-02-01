/**
 * Structured logging utility with trace ID support
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  traceId?: string;
  spanId?: string;
  context?: Record<string, unknown>;
}

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

class Logger {
  private name: string;

  constructor(name: string) {
    this.name = name;
  }

  private log(level: LogLevel, message: string, context?: Record<string, unknown>) {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      traceId: globalTraceId,
      spanId: globalSpanId,
      context: { ...context, logger: this.name },
    };

    const output = JSON.stringify(entry);
    if (level === "error") {
      console.error(output);
    } else if (level === "warn") {
      console.warn(output);
    } else {
      console.log(output);
    }
  }

  debug(message: string, context?: Record<string, unknown>) {
    if (process.env.NODE_ENV === "development") {
      this.log("debug", message, context);
    }
  }

  info(message: string, context?: Record<string, unknown>) {
    this.log("info", message, context);
  }

  warn(message: string, context?: Record<string, unknown>) {
    this.log("warn", message, context);
  }

  error(message: string, context?: Record<string, unknown>) {
    this.log("error", message, context);
  }

  /** Create child logger with additional context */
  child(childContext: Record<string, unknown>): ChildLogger {
    return new ChildLogger(this.name, childContext);
  }
}

class ChildLogger extends Logger {
  private baseContext: Record<string, unknown>;

  constructor(name: string, baseContext: Record<string, unknown>) {
    super(name);
    this.baseContext = baseContext;
  }

  debug(message: string, context?: Record<string, unknown>) {
    super.debug(message, { ...this.baseContext, ...context });
  }

  info(message: string, context?: Record<string, unknown>) {
    super.info(message, { ...this.baseContext, ...context });
  }

  warn(message: string, context?: Record<string, unknown>) {
    super.warn(message, { ...this.baseContext, ...context });
  }

  error(message: string, context?: Record<string, unknown>) {
    super.error(message, { ...this.baseContext, ...context });
  }
}

export function createLogger(name: string): Logger {
  return new Logger(name);
}

export const appLogger = createLogger("app");
