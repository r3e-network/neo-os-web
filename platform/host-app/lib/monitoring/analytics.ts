/**
 * Usage Analytics & User Behavior Tracking
 * Tracks user interactions, page views, and custom events
 */

import { logger } from "../logger";

// Event types
export type AnalyticsEventType =
  | "page_view"
  | "click"
  | "form_submit"
  | "search"
  | "navigation"
  | "miniapp_launch"
  | "miniapp_action"
  | "wallet_action"
  | "error"
  | "custom";

export interface AnalyticsEvent {
  id: string;
  type: AnalyticsEventType;
  name: string;
  timestamp: number;
  // User info
  userId?: string;
  sessionId: string;
  // Page context
  url: string;
  path: string;
  referrer?: string;
  // Event data
  category?: string;
  label?: string;
  value?: number;
  metadata?: Record<string, unknown>;
  // Device info
  deviceType?: "desktop" | "mobile" | "tablet";
  platform?: string;
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

export interface PageView {
  path: string;
  title?: string;
  timestamp: number;
  duration?: number;
  exitPage?: boolean;
}

// Session management
let currentSession: UserSession | null = null;
let eventBuffer: AnalyticsEvent[] = [];
let pageViewBuffer: PageView[] = [];
let lastPageView: PageView | null = null;
let isInitialized = false;

/**
 * Initialize analytics tracking
 */
export function initAnalytics(): void {
  if (typeof window === "undefined" || isInitialized) return;
  
  isInitialized = true;
  
  // Initialize or restore session
  initSession();
  
  // Track page views
  trackPageView();
  
  // Track history changes for SPA
  if (typeof window !== "undefined" && "history" in window) {
    const originalPushState = history.pushState;
    history.pushState = function (...args) {
      originalPushState.apply(this, args);
      trackPageView();
    };
    
    window.addEventListener("popstate", () => trackPageView());
  }
  
  // Track page unload
  window.addEventListener("pagehide", flushEvents);
  
  logger.info("Analytics initialized", { sessionId: currentSession?.id });
}

/**
 * Initialize user session
 */
function initSession(): void {
  const sessionKey = "neo_analytics_session";
  const sessionData = sessionStorage.getItem(sessionKey);
  
  if (sessionData) {
    try {
      const parsed = JSON.parse(sessionData) as UserSession;
      // Session expires after 30 minutes of inactivity
      if (Date.now() - parsed.lastActivity < 30 * 60 * 1000) {
        currentSession = parsed;
        currentSession.lastActivity = Date.now();
        updateSession();
        return;
      }
    } catch {
      // Invalid session data
    }
  }
  
  // Create new session
  currentSession = {
    id: generateSessionId(),
    startTime: Date.now(),
    lastActivity: Date.now(),
    pageCount: 0,
    eventsCount: 0,
    firstVisit: !sessionStorage.getItem("neo_visited"),
  };
  
  if (currentSession.firstVisit) {
    sessionStorage.setItem("neo_visited", "true");
  }
  
  updateSession();
  
  // Track session start
  trackEvent("session_start", {
    type: "custom",
    metadata: {
      firstVisit: currentSession.firstVisit,
    },
  });
}

/**
 * Update session in storage
 */
function updateSession(): void {
  if (!currentSession) return;
  
  sessionStorage.setItem("neo_analytics_session", JSON.stringify(currentSession));
}

/**
 * Generate unique session ID
 */
function generateSessionId(): string {
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

/**
 * Track a page view
 */
export function trackPageView(path?: string): void {
  if (typeof window === "undefined" || !currentSession) return;
  
  const currentPath = path || window.location.pathname;
  const now = Date.now();
  
  // Calculate duration of previous page
  if (lastPageView) {
    lastPageView.duration = now - lastPageView.timestamp;
    pageViewBuffer.push({ ...lastPageView });
  }
  
  const pageView: PageView = {
    path: currentPath,
    title: document.title,
    timestamp: now,
  };
  
  lastPageView = pageView;
  currentSession.pageCount++;
  currentSession.lastActivity = now;
  updateSession();
  
  // Track event
  trackEvent("page_view", {
    type: "page_view",
    metadata: {
      path: currentPath,
      title: document.title,
      referrer: document.referrer,
    },
  });
}

/**
 * Track a custom event
 */
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
  if (typeof window === "undefined" || !currentSession) return "";
  
  const eventId = generateEventId();
  const now = Date.now();
  
  const event: AnalyticsEvent = {
    id: eventId,
    type: options.type || "custom",
    name,
    timestamp: now,
    sessionId: currentSession.id,
    url: window.location.href,
    path: window.location.pathname,
    referrer: document.referrer,
    category: options.category,
    label: options.label,
    value: options.value,
    metadata: options.metadata,
    deviceType: getDeviceType(),
    platform: typeof navigator !== "undefined" ? navigator.platform : undefined,
  };
  
  // Add to buffer
  eventBuffer.push(event);
  currentSession.eventsCount++;
  currentSession.lastActivity = now;
  updateSession();
  
  // Log in development
  if (process.env.NODE_ENV === "development") {
    logger.debug(`[Analytics] ${name}`, options);
  }
  
  // Send immediately for important events
  if (options.type === "error" || name.includes("error")) {
    sendEventToService(event);
  } else if (eventBuffer.length >= 10) {
    flushEvents();
  }
  
  return eventId;
}

/**
 * Track a click event
 */
export function trackClick(
  element: HTMLElement,
  options: {
    category?: string;
    label?: string;
    value?: number;
    metadata?: Record<string, unknown>;
  } = {},
): void {
  if (typeof window === "undefined") return;
  
  // Get element info
  const metadata: Record<string, unknown> = {
    tag: element.tagName.toLowerCase(),
    id: element.id || undefined,
    classes: element.className || undefined,
    text: element.textContent?.slice(0, 50) || undefined,
    ...options.metadata,
  };
  
  // Get data attributes
  const dataAttrs = element.dataset;
  if (Object.keys(dataAttrs).length > 0) {
    metadata.dataAttributes = { ...dataAttrs };
  }
  
  trackEvent("click", {
    type: "click",
    category: options.category || "interaction",
    label: options.label,
    value: options.value,
    metadata,
  });
}

/**
 * Track a form submission
 */
export function trackFormSubmit(
  form: HTMLFormElement,
  options: {
    formId?: string;
    formName?: string;
    success?: boolean;
    metadata?: Record<string, unknown>;
  } = {},
): void {
  if (typeof window === "undefined") return;
  
  const formId = form.id || options.formId || "unknown";
  
  trackEvent("form_submit", {
    type: "form_submit",
    category: "form",
    label: options.formName || form.name || formId,
    metadata: {
      formId,
      action: form.action,
      method: form.method,
      success: options.success ?? true,
      fieldCount: form.elements.length,
      ...options.metadata,
    },
  });
}

/**
 * Track search
 */
export function trackSearch(
  query: string,
  resultsCount: number,
  options: {
    category?: string;
    metadata?: Record<string, unknown>;
  } = {},
): void {
  trackEvent("search", {
    type: "search",
    category: options.category || "search",
    value: resultsCount,
    metadata: {
      query,
      resultsCount,
      hasResults: resultsCount > 0,
      ...options.metadata,
    },
  });
}

/**
 * Track miniapp launch
 */
export function trackMiniAppLaunch(
  appId: string,
  appName: string,
  options: {
    source?: string;
    metadata?: Record<string, unknown>;
  } = {},
): void {
  trackEvent("miniapp_launch", {
    type: "miniapp_launch",
    category: "miniapp",
    label: appName,
    metadata: {
      appId,
      appName,
      source: options.source || "unknown",
      ...options.metadata,
    },
  });
}

/**
 * Track miniapp action
 */
export function trackMiniAppAction(
  appId: string,
  action: string,
  options: {
    category?: string;
    value?: number;
    metadata?: Record<string, unknown>;
  } = {},
): void {
  trackEvent("miniapp_action", {
    type: "miniapp_action",
    category: options.category || "miniapp",
    label: action,
    value: options.value,
    metadata: {
      appId,
      action,
      ...options.metadata,
    },
  });
}

/**
 * Track wallet action
 */
export function trackWalletAction(
  action: string,
  options: {
    wallet?: string;
    success?: boolean;
    metadata?: Record<string, unknown>;
  } = {},
): void {
  trackEvent("wallet_action", {
    type: "wallet_action",
    category: "wallet",
    label: action,
    metadata: {
      wallet: options.wallet || "unknown",
      success: options.success ?? true,
      ...options.metadata,
    },
  });
}

/**
 * Get current session
 */
export function getSession(): UserSession | null {
  return currentSession;
}

/**
 * Get buffered events
 */
export function getBufferedEvents(): AnalyticsEvent[] {
  return [...eventBuffer];
}

/**
 * Get buffered page views
 */
export function getBufferedPageViews(): PageView[] {
  return [...pageViewBuffer];
}

/**
 * Clear buffers
 */
export function clearBuffers(): void {
  eventBuffer = [];
  pageViewBuffer = [];
}

/**
 * Flush events to service
 */
export function flushEvents(): void {
  if (eventBuffer.length === 0 && pageViewBuffer.length === 0) return;
  
  // Send to analytics service in production
  if (process.env.NODE_ENV === "production") {
    const endpoint = process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT;
    if (endpoint) {
      const payload = {
        sessionId: currentSession?.id,
        events: [...eventBuffer],
        pageViews: [...pageViewBuffer],
      };
      
      navigator.sendBeacon?.(endpoint, JSON.stringify(payload))
        || fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }).catch(() => {});
    }
  }
  
  eventBuffer = [];
  pageViewBuffer = [];
}

/**
 * Send single event to service
 */
function sendEventToService(event: AnalyticsEvent): void {
  const endpoint = process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT;
  if (!endpoint) return;
  
  fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "event",
      data: event,
    }),
  }).catch(() => {});
}

/**
 * Generate unique event ID
 */
function generateEventId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Get device type
 */
function getDeviceType(): "desktop" | "mobile" | "tablet" {
  if (typeof navigator === "undefined") return "desktop";
  
  const ua = navigator.userAgent.toLowerCase();
  
  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
    return "tablet";
  }
  
  if (/mobile|iphone|ipod|android.*mobile|windows phone|blackberry/i.test(ua)) {
    return "mobile";
  }
  
  return "desktop";
}

/**
 * Set user ID for tracking
 */
export function setUserId(userId: string): void {
  if (currentSession) {
    currentSession.userId = userId;
    updateSession();
  }
}

/**
 * Get analytics session ID for debugging
 */
export function getSessionId(): string {
  return currentSession?.id || "";
}
