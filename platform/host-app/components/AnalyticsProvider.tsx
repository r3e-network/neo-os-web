/**
 * Analytics Provider & User Behavior Tracking
 * Wraps the application to enable automatic analytics tracking
 */

import React, { useEffect, ReactNode, useCallback, useRef } from "react";
import {
  initAnalytics,
  trackPageView,
  trackEvent,
  trackClick,
  trackMiniAppLaunch,
  getSessionId,
  type AnalyticsEventType,
} from "@/lib/monitoring/analytics";
import { initPerformanceMonitoring } from "@/lib/monitoring/performance";
import { initErrorTracking } from "@/lib/monitoring/errors";

interface AnalyticsProviderProps {
  children: ReactNode;
  /** Auto-track page views */
  autoTrackPageViews?: boolean;
  /** Auto-track clicks */
  autoTrackClicks?: boolean;
  /** Auto-track errors */
  autoTrackErrors?: boolean;
}

/**
 * Analytics Provider Component
 * Initializes and manages analytics tracking across the app
 */
export function AnalyticsProvider({
  children,
  autoTrackPageViews = true,
  autoTrackClicks = true,
  autoTrackErrors = true,
}: AnalyticsProviderProps) {
  const isInitialized = useRef(false);

  useEffect(() => {
    if (isInitialized.current) return;
    isInitialized.current = true;

    // Initialize all monitoring systems
    initPerformanceMonitoring();
    initErrorTracking();
    initAnalytics();

    // Track initial page view
    if (autoTrackPageViews) {
      trackPageView();
    }

    // Set up click tracking
    let cleanupClickTracking: (() => void) | undefined;
    if (autoTrackClicks) {
      cleanupClickTracking = setupClickTracking();
    }

    return () => {
      if (cleanupClickTracking) {
        cleanupClickTracking();
      }
    };
  }, [autoTrackPageViews, autoTrackClicks, autoTrackErrors]);

  return <>{children}</>;
}

/**
 * Set up automatic click tracking via event delegation
 * Returns a cleanup function to remove the event listener
 */
function setupClickTracking(): () => void {
  if (typeof window === "undefined") return () => {};

  const handler = (event: Event) => {
    const target = event.target as HTMLElement;

    // Find closest clickable element
    const element = target.closest("[data-track-click], [data-analytics], [data-event]");

    if (element) {
      const dataset = (element as HTMLElement).dataset;

      // Use data attributes for tracking
      const eventName = dataset.trackClick || dataset.analytics || dataset.event;

      if (eventName) {
        trackClick(element as HTMLElement, {
          category: dataset.analyticsCategory || "interaction",
          label: dataset.analyticsLabel || eventName,
          metadata: {
            // Parse additional metadata from data attributes
            ...Object.fromEntries(
              Object.entries(dataset)
                .filter(([key]) => key.startsWith("analytics"))
                .map(([key, value]) => [
                  key.replace("analytics", "").toLowerCase(),
                  value,
                ])
            ),
          },
        });
      }
    }
  };

  document.addEventListener("click", handler, { capture: true });

  // Return cleanup function
  return () => {
    document.removeEventListener("click", handler, { capture: true });
  };
}

/**
 * Hook for manual event tracking
 */
export function useAnalytics() {
  const sessionId = getSessionId();
  
  const track = useCallback(<T extends Record<string, unknown>>(
    name: string,
    options?: {
      type?: AnalyticsEventType;
      category?: string;
      label?: string;
      value?: number;
      metadata?: T;
    }
  ) => {
    return trackEvent(name, options);
  }, []);
  
  const trackPage = useCallback((path?: string) => {
    return trackPageView(path);
  }, []);
  
  const trackMiniApp = useCallback((
    appId: string,
    appName: string,
    source?: string
  ) => {
    return trackMiniAppLaunch(appId, appName, { source });
  }, []);
  
  const trackAction = useCallback((
    category: string,
    action: string,
    metadata?: Record<string, unknown>
  ) => {
    return trackEvent(action, {
      type: "custom",
      category,
      metadata,
    });
  }, []);
  
  return {
    sessionId,
    track,
    trackPage,
    trackMiniApp,
    trackAction,
  };
}

/**
 * Hook for tracking form submissions
 */
export function useFormAnalytics(formId?: string) {
  const trackFormSubmit = useCallback((
    formElement: HTMLFormElement,
    options?: {
      success?: boolean;
      metadata?: Record<string, unknown>;
    }
  ) => {
    return trackEvent("form_submit", {
      type: "form_submit",
      category: "form",
      label: formId || formElement.id || formElement.name || "unknown",
      metadata: {
        formId: formId || formElement.id,
        action: formElement.action,
        ...options?.metadata,
        success: options?.success ?? true,
      },
    });
  }, [formId]);
  
  return { trackFormSubmit };
}

/**
 * Hook for tracking search
 */
export function useSearchAnalytics() {
  const trackSearch = useCallback((
    query: string,
    resultsCount: number,
    category?: string
  ) => {
    return trackEvent("search", {
      type: "search",
      category: category || "search",
      metadata: {
        query,
        resultsCount,
        hasResults: resultsCount > 0,
      },
    });
  }, []);
  
  return { trackSearch };
}

/**
 * Component to track element visibility
 */
export function AnalyticsVisible({
  children,
  name,
  category = "visibility",
  once = true,
}: {
  children: ReactNode;
  name: string;
  category?: string;
  once?: boolean;
}) {
  const hasTracked = useRef(false);
  
  useEffect(() => {
    if (once && hasTracked.current) return;
    
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            hasTracked.current = true;
            trackEvent("element_visible", {
              type: "custom",
              category,
              label: name,
              metadata: {
                element: name,
                viewportRatio: entry.intersectionRatio,
              },
            });
            
            if (once) {
              observer.disconnect();
            }
          }
        });
      },
      { threshold: 0.5 }
    );
    
    const current = React.Children.only(children) as React.ReactElement;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- React internal ref access on typed children
    if ((current as any)?.ref) {
      // Handle ref
      observer.observe(current as unknown as Element);
    }
    
    return () => observer.disconnect();
  }, [name, category, once, children]);
  
  return <>{children}</>;
}

/**
 * HOC for automatic event tracking
 */
export function withAnalytics<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  trackingOptions: {
    eventName?: string;
    category?: string;
    trackOnMount?: boolean;
    trackOnUnmount?: boolean;
  } = {}
) {
  const { eventName, category = "component", trackOnMount = false, trackOnUnmount = false } = trackingOptions;
  const displayName = WrappedComponent.displayName || WrappedComponent.name || "Component";
  
  const WithAnalytics: React.FC<P> = (props) => {
    useEffect(() => {
      if (trackOnMount && eventName) {
        trackEvent(eventName, {
          type: "custom",
          category,
          label: displayName,
          metadata: { component: displayName },
        });
      }
      
      return () => {
        if (trackOnUnmount && eventName) {
          trackEvent(`${eventName}_unmount`, {
            type: "custom",
            category,
            label: displayName,
            metadata: { component: displayName },
          });
        }
      };
    }, [eventName, category, displayName, trackOnMount, trackOnUnmount]);
    
    return <WrappedComponent {...props} />;
  };
  
  WithAnalytics.displayName = `withAnalytics(${displayName})`;
  return WithAnalytics;
}

export default AnalyticsProvider;
