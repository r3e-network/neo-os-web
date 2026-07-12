/**
 * Usage Analytics & User Behavior Tracking
 *
 * Thin facade that delegates to PostHog for all event capture, session
 * management, batching, and serialization. The public API surface is
 * preserved so existing call-sites continue to work unchanged.
 */

type PostHogModule = typeof import("./posthog");

let postHogModulePromise: Promise<PostHogModule> | null = null;

function loadPostHog(): Promise<PostHogModule> | null {
  if (
    typeof window === "undefined" ||
    !process.env.NEXT_PUBLIC_POSTHOG_KEY
  ) {
    return null;
  }
  postHogModulePromise ??= import("./posthog");
  return postHogModulePromise;
}

function withPostHog(run: (module: PostHogModule) => void): void {
  const modulePromise = loadPostHog();
  if (!modulePromise) return;
  void modulePromise
    .then((module) => {
      module.initPostHog();
      run(module);
    })
    .catch((error: unknown) => {
      console.warn(
        "[analytics] PostHog failed to load:",
        error instanceof Error ? error.message : String(error),
      );
    });
}

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
  withPostHog(() => {});
}

// ---------- core tracking ----------

export function trackPageView(path?: string): void {
  const p = path || (typeof window !== "undefined" ? window.location.pathname : "/");
  withPostHog((module) => module.trackPageView(p));
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
  withPostHog((module) =>
    module.trackEvent(name, {
      type: options.type,
      category: options.category,
      label: options.label,
      value: options.value,
      ...options.metadata,
    }),
  );
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
  withPostHog((module) => module.identifyUser(userId));
}

export function resetUser(): void {
  withPostHog((module) => module.resetUser());
}

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
