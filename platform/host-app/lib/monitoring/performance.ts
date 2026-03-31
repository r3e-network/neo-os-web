/**
 * Performance Monitoring Utilities
 * Tracks frontend performance metrics including Core Web Vitals
 */

import { logger } from "../logger";

// Performance metric types
export interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: number;
}

export interface WebVitals {
  // Core Web Vitals
  LCP?: number;  // Largest Contentful Paint
  FID?: number;  // First Input Delay
  CLS?: number;  // Cumulative Layout Shift
  // Additional metrics
  FCP?: number;  // First Contentful Paint
  TTFB?: number; // Time to First Byte
  SI?: number;   // Speed Index
}

export interface ResourceTiming {
  name: string;
  duration: number;
  transferSize: number;
  initiatorType: string;
  timestamp: number;
}

export interface PerformanceReport {
  url: string;
  webVitals: WebVitals;
  resources: ResourceTiming[];
  navigationTiming?: Record<string, number>;
  timestamp: number;
  userAgent: string;
}

type PerformanceCallback = (metric: PerformanceMetric) => void;
type ReportCallback = (report: PerformanceReport) => void;

interface WebVitalsAPI {
  getCLS: (cb: (value: number) => void) => void;
  getFID: (cb: (value: number) => void) => void;
  getLCP: (cb: (value: number) => void) => void;
}

interface WindowWithWebVitals extends Window {
  webVitals?: WebVitalsAPI;
}

// In-memory metrics storage (for client-side)
let metricsBuffer: PerformanceMetric[] = [];
let isInitialized = false;

// Listener reference for cleanup
let pageHideListener: (() => void) | null = null;

/**
 * Initialize performance monitoring
 * Sets up Performance Observer for Core Web Vitals
 */
export function initPerformanceMonitoring(): void {
  if (typeof window === "undefined" || isInitialized) return;
  
  isInitialized = true;
  const win = window as WindowWithWebVitals;
  
  // Report initial Web Vitals
  if (win.webVitals) {
    win.webVitals.getCLS(onCLS);
    win.webVitals.getFID(onFID);
    win.webVitals.getLCP(onLCP);
  }
  
  // Fallback: Use Performance Observer directly
  if ("PerformanceObserver" in window) {
    setupPerformanceObservers();
  }
  
  // Report on page unload
  pageHideListener = sendMetricsBuffer;
  window.addEventListener("pagehide", pageHideListener);

  logger.info("Performance monitoring initialized");
}

/**
 * Setup Performance Observers for various metrics
 */
const performanceObservers: PerformanceObserver[] = [];

function setupPerformanceObservers(): void {
  // Largest Contentful Paint
  try {
    const lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1] as PerformanceEntry & { renderTime?: number };
      if (lastEntry) {
        onLCP(lastEntry.renderTime || lastEntry.startTime);
      }
    });
    lcpObserver.observe({ type: "largest-contentful-paint", buffered: true });
    performanceObservers.push(lcpObserver);
  } catch {
    // LCP not supported
  }

  // First Input Delay
  try {
    const fidObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const firstEntry = entries[0] as PerformanceEntry & { processingStart?: number; startTime?: number };
      if (firstEntry) {
        const fid = (firstEntry.processingStart || 0) - (firstEntry.startTime || 0);
        onFID(fid);
      }
    });
    fidObserver.observe({ type: "first-input", buffered: true });
    performanceObservers.push(fidObserver);
  } catch {
    // FID not supported
  }

  // Cumulative Layout Shift
  try {
    let clsValue = 0;
    const clsObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const clsEntry = entry as PerformanceEntry & { hadRecentInput?: boolean; value?: number };
        if (!clsEntry.hadRecentInput && clsEntry.value) {
          clsValue += clsEntry.value;
        }
      }
      onCLS(clsValue);
    });
    clsObserver.observe({ type: "layout-shift", buffered: true });
    performanceObservers.push(clsObserver);
  } catch {
    // CLS not supported
  }

  // Resource timing
  try {
    const resourceObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const resource = entry as PerformanceResourceTiming;
        if (resource.initiatorType) {
          trackResourceTiming({
            name: resource.name,
            duration: resource.duration,
            transferSize: resource.transferSize || 0,
            initiatorType: resource.initiatorType,
            timestamp: Date.now(),
          });
        }
      }
    });
    resourceObserver.observe({ type: "resource", buffered: true });
    performanceObservers.push(resourceObserver);
  } catch {
    // Resource timing not supported
  }
}

// Web Vitals callbacks
function onLCP(value: number): void {
  trackMetric({
    name: "LCP",
    value,
    unit: "ms",
    timestamp: Date.now(),
  });
}

function onFID(value: number): void {
  trackMetric({
    name: "FID",
    value,
    unit: "ms",
    timestamp: Date.now(),
  });
}

function onCLS(value: number): void {
  trackMetric({
    name: "CLS",
    value,
    unit: "",
    timestamp: Date.now(),
  });
}

/**
 * Track a performance metric
 */
export function trackMetric(metric: PerformanceMetric): void {
  metricsBuffer.push(metric);
  
  // Log in development
  if (process.env.NODE_ENV === "development") {
    logger.debug(`[Performance] ${metric.name}: ${metric.value}${metric.unit}`);
  }
  
  // Send to monitoring service in production
  if (process.env.NODE_ENV === "production") {
    sendMetricToService(metric);
  }
}

/**
 * Track resource timing
 */
function trackResourceTiming(resource: ResourceTiming): void {
  if (process.env.NODE_ENV === "development") {
    logger.debug(`[Resource] ${resource.name}: ${resource.duration}ms`);
  }
}

/**
 * Get current performance metrics
 */
export function getPerformanceMetrics(): PerformanceMetric[] {
  return [...metricsBuffer];
}

/**
 * Clear metrics buffer
 */
export function clearMetricsBuffer(): void {
  metricsBuffer = [];
}

/**
 * Get Web Vitals from current page performance
 */
export function getWebVitalsSync(): WebVitals {
  const vitals: WebVitals = {};
  
  if (typeof window === "undefined") return vitals;
  
  const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
  const paint = performance.getEntriesByType("paint");
  
  // First Contentful Paint
  const fcpEntry = paint.find((e) => e.name === "first-contentful-paint");
  if (fcpEntry) {
    vitals.FCP = fcpEntry.startTime;
  }
  
  // Time to First Byte
  if (navigation) {
    vitals.TTFB = navigation.responseStart;
  }
  
  return vitals;
}

/**
 * Generate a comprehensive performance report
 */
export function generatePerformanceReport(): PerformanceReport | null {
  if (typeof window === "undefined") return null;
  
  const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
  const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
  
  const webVitals: WebVitals = {
    ...getWebVitalsSync(),
  };
  
  // Get CLS from buffer
  const clsMetric = metricsBuffer.find((m) => m.name === "CLS");
  if (clsMetric) {
    webVitals.CLS = clsMetric.value;
  }
  
  return {
    url: window.location.href,
    webVitals,
    resources: resources.slice(0, 20).map((r) => ({
      name: r.name,
      duration: r.duration,
      transferSize: r.transferSize || 0,
      initiatorType: r.initiatorType,
      timestamp: r.startTime,
    })),
    navigationTiming: navigation ? {
      // Map to simpler format
      fetchStart: navigation.fetchStart,
      domainLookupStart: navigation.domainLookupStart,
      domainLookupEnd: navigation.domainLookupEnd,
      connectStart: navigation.connectStart,
      connectEnd: navigation.connectEnd,
      secureConnectionStart: navigation.secureConnectionStart,
      responseStart: navigation.responseStart,
      responseEnd: navigation.responseEnd,
      transferSize: navigation.transferSize,
      domContentLoadedEventStart: navigation.domContentLoadedEventStart,
      domContentLoadedEventEnd: navigation.domContentLoadedEventEnd,
      loadEventStart: navigation.loadEventStart,
      loadEventEnd: navigation.loadEventEnd,
    } : undefined,
    timestamp: Date.now(),
    userAgent: navigator.userAgent,
  };
}

/**
 * Send metric to external monitoring service
 */
function sendMetricToService(metric: PerformanceMetric): void {
  const endpoint = process.env.NEXT_PUBLIC_PERFORMANCE_ENDPOINT;
  if (!endpoint) return;
  
  void fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "metric",
      data: metric,
      sessionId: getSessionId(),
    }),
  }).catch((e: unknown) => { console.warn("[monitoring] failed to send performance metric:", e instanceof Error ? e.message : String(e)); });
}

/**
 * Send buffered metrics on page unload
 */
function sendMetricsBuffer(): void {
  if (metricsBuffer.length === 0) return;
  
  const endpoint = process.env.NEXT_PUBLIC_PERFORMANCE_ENDPOINT;
  if (!endpoint) return;
  
  // Use sendBeacon for reliability during page unload
  const data = JSON.stringify({
    type: "metrics_batch",
    data: metricsBuffer,
    sessionId: getSessionId(),
  });
  
  navigator.sendBeacon?.(endpoint, data)
    || void fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: data,
    }).catch((e: unknown) => { console.warn("[performance] sendBeacon fallback failed:", e instanceof Error ? e.message : String(e)); });
  metricsBuffer = [];
}

/**
 * Get or generate session ID
 */
function getSessionId(): string {
  if (typeof window === "undefined") return "";
  
  const key = "neo_monitoring_session";
  let sessionId = sessionStorage.getItem(key);
  
  if (!sessionId) {
    sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem(key, sessionId);
  }
  
  return sessionId;
}

/**
 * Measure function execution time
 */
export function measureAsync<T>(
  name: string,
  fn: () => Promise<T>,
): Promise<T> {
  const start = performance.now();
  
  return fn().finally(() => {
    const duration = performance.now() - start;
    trackMetric({
      name: `func_${name}`,
      value: duration,
      unit: "ms",
      timestamp: Date.now(),
    });
  });
}

/**
 * Measure function execution time (sync)
 */
export function measureSync<T>(name: string, fn: () => T): T {
  const start = performance.now();
  const result = fn();
  const duration = performance.now() - start;
  
  trackMetric({
    name: `func_${name}`,
    value: duration,
    unit: "ms",
    timestamp: Date.now(),
  });
  
  return result;
}

/**
 * Create a performance mark
 */
export function mark(name: string): void {
  if (typeof window !== "undefined" && "performance" in window) {
    performance.mark(name);
  }
}

/**
 * Measure between two marks
 */
export function measure(name: string, startMark: string, endMark?: string): number {
  if (typeof window !== "undefined" && "performance" in window) {
    performance.measure(name, startMark, endMark);
    const entries = performance.getEntriesByName(name);
    if (entries.length > 0) {
      return entries[entries.length - 1].duration;
    }
  }
  return 0;
}

// Export callbacks for external listeners
export const onPerformanceMetric: Set<PerformanceCallback> = new Set();
export const onPerformanceReport: Set<ReportCallback> = new Set();

export { metricsBuffer };

/**
 * Destroy performance monitoring and remove event listeners
 */
export function destroyPerformanceMonitoring(): void {
  if (pageHideListener) {
    window.removeEventListener("pagehide", pageHideListener);
    pageHideListener = null;
  }
  for (const observer of performanceObservers) {
    observer.disconnect();
  }
  performanceObservers.length = 0;
  isInitialized = false;
}
