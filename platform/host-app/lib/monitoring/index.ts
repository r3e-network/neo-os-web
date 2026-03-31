/**
 * Monitoring & Analytics Library
 * Central export for all monitoring utilities
 */

// Performance monitoring
export * from "./performance";

// Error tracking
export * from "./errors";

// Sentry integration
export { captureError, setUserContext, initSentry } from "./sentry";

// Usage analytics
export * from "./analytics";

// Initialization helper
export function initAllMonitoring(): void {
  const { initPerformanceMonitoring } = require("./performance");
  const { initErrorTracking } = require("./errors");
  const { initAnalytics } = require("./analytics");
  
  initPerformanceMonitoring();
  initErrorTracking();
  initAnalytics();
}
