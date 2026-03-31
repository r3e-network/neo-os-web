/**
 * Sentry Integration
 * Initializes Sentry and provides error capture helpers
 */

import * as Sentry from "@sentry/nextjs";

let initialized = false;

/**
 * Initialize Sentry SDK (safe to call multiple times)
 */
export function initSentry(): void {
  if (initialized) return;
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_APP_ENV || "development",
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
    enabled: true,
    beforeSend(event) {
      // Strip PII from URLs if present
      if (event.request?.url) {
        event.request.url = event.request.url.replace(/token=[^&]+/g, "token=[REDACTED]");
      }
      return event;
    },
  });

  initialized = true;
}

/**
 * Capture an error to Sentry with optional extra context
 */
export function captureError(
  error: Error | string,
  context?: { appId?: string; extra?: Record<string, unknown> },
): void {
  const err = typeof error === "string" ? new Error(error) : error;

  Sentry.withScope((scope) => {
    if (context?.appId) scope.setTag("appId", context.appId);
    if (context?.extra) scope.setExtras(context.extra);
    Sentry.captureException(err);
  });
}

/**
 * Set user context on all future Sentry events
 */
export function setUserContext(userId: string, walletAddress?: string): void {
  Sentry.setUser({
    id: userId,
    ...(walletAddress ? { walletAddress } : {}),
  });
}
