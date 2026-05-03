/**
 * Usage Analytics & User Behavior Tracking
 *
 * Thin facade that delegates to PostHog for all event capture, session
 * management, batching, and serialization. The public API surface is
 * preserved so existing call-sites continue to work unchanged.
 */

import {
  initPostHog,
  trackEvent as phTrackEvent,
  trackPageView as phTrackPageView,
  identifyUser,
  resetUser,
} from "./posthog";

// ---------- types (kept for external consumers) ----------

export type AnalyticsEventType =
  | "page_view"
  | "click"
  | "form_submit"
  | "search"
  | "navigation"
  | "miniapp_open"
  | "miniapp_action"
  | "wallet_action"
  | "error"
  | "custom";

export interface AnalyticsEvent {
  id: string;
  type: AnalyticsEventType;
  name: string;
  timestamp: number;
  sessionId: string;
  url: string;
  path: string;
}

export interface UserSession {
  id: string;
  startTime: number;
  lastActivity: number;
  pageCount: number;
  eventsCount: number;
  userId?: string;
  firstVisit: boolean;
}

// ---------- initialization ----------

export function initAnalytics(): void {
  initPostHog();
}

// ---------- core tracking ----------

export function trackPageView(path?: string): void {
  const p = path || (typeof window !== "undefined" ? window.location.pathname : "/");
  phTrackPageView(p);
}

export function trackEvent(
  name: string,
  options: {
    type?: AnalyticsEventType;
    category?: string;
    label?: string;
    value?: number;
    metadata?: Record<string, unknown>;
  } = {},
): string {
  phTrackEvent(name, {
    type: options.type,
    category: options.category,
    label: options.label,
    value: options.value,
    ...options.metadata,
  });
  return ""; // callers that capture the id can safely ignore it
}

// ---------- convenience helpers ----------

export function trackClick(
  element: HTMLElement,
  options: {
    category?: string;
    label?: string;
    value?: number;
    metadata?: Record<string, unknown>;
  } = {},
): void {
  trackEvent("click", {
    type: "click",
    category: options.category || "interaction",
    label: options.label,
    metadata: {
      tag: element.tagName.toLowerCase(),
      id: element.id || undefined,
      text: element.textContent?.slice(0, 50) || undefined,
      ...options.metadata,
    },
  });
}

export function trackMiniAppOpen(
  appId: string,
  appName: string,
  options: { source?: string; metadata?: Record<string, unknown> } = {},
): void {
  trackEvent("miniapp_open", {
    type: "miniapp_open",
    category: "miniapp",
    label: appName,
    metadata: { appId, appName, source: options.source || "unknown", ...options.metadata },
  });
}

// ---------- user identity ----------

export function setUserId(userId: string): void {
  identifyUser(userId);
}

export { resetUser };

// ---------- session helpers (no-ops; PostHog manages sessions) ----------

export function getSession(): UserSession | null {
  return null;
}

export function getSessionId(): string {
  return "";
}

export function getBufferedEvents(): AnalyticsEvent[] {
  return [];
}

export function getBufferedPageViews(): unknown[] {
  return [];
}

export function clearBuffers(): void {
  /* no-op */
}

export function flushEvents(): void {
  /* no-op – PostHog flushes automatically */
}

export function destroyAnalytics(): void {
  /* no-op – PostHog handles its own teardown */
}
