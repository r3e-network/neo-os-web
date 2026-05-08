/**
 * Performance Report Component
 * Displays real-time performance metrics for developers
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  getPerformanceMetrics,
  generatePerformanceReport,
  type PerformanceReport,
  type PerformanceMetric,
} from "@/lib/monitoring/performance";
import {
  getErrorCount,
  getTrackedErrors,
  type TrackedError,
} from "@/lib/monitoring/errors";

interface PerformanceReportProps {
  /** Show only in development mode */
  devOnly?: boolean;
  /** Refresh interval in ms */
  refreshInterval?: number;
  /** Position of the panel */
  position?: "top-right" | "bottom-right" | "top-left" | "bottom-left";
}

export function PerformanceReportPanel({
  devOnly = true,
  refreshInterval = 5000,
  position = "bottom-right",
}: PerformanceReportProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [metrics, setMetrics] = useState<PerformanceMetric[]>([]);
  const [errorCount, setErrorCount] = useState(0);
  const [report, setReport] = useState<PerformanceReport | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Skip in production unless explicitly allowed — defer to after mount to avoid hydration mismatch
  const isDev = process.env.NODE_ENV === "development";
  if (devOnly && !isDev && mounted) {
    return null;
  }

  const positionClasses = {
    "top-right": "top-4 right-4",
    "bottom-right": "bottom-4 right-4",
    "top-left": "top-4 left-4",
    "bottom-left": "bottom-4 left-4",
  };

  useEffect(() => {
    let active = true;
    const updateMetrics = () => {
      if (!active) return;
      setMetrics(getPerformanceMetrics());
      setErrorCount(getErrorCount());
      setReport(generatePerformanceReport());
    };

    updateMetrics();
    const interval = setInterval(updateMetrics, refreshInterval);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [refreshInterval]);

  // Group metrics by name
  const groupedMetrics = metrics.reduce(
    (acc, m) => {
      if (!acc[m.name]) {
        acc[m.name] = [];
      }
      acc[m.name].push(m);
      return acc;
    },
    {} as Record<string, PerformanceMetric[]>,
  );

  // Get latest value for each metric
  const latestMetrics = Object.entries(groupedMetrics).map(
    ([name, values]) => ({
      name,
      value: values[values.length - 1]?.value ?? 0,
      unit: values[0]?.unit ?? "",
      count: values.length,
    }),
  );

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Toggle performance monitor"
        className={`fixed ${positionClasses[position]} z-[90] hidden p-2 bg-white text-gray-900 border border-gray-200 rounded-full shadow-lg hover:bg-gray-50 transition-colors sm:block ${
          errorCount > 0 ? "animate-pulse" : ""
        }`}
        title="Performance Monitor"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          />
        </svg>
        {errorCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-xs flex items-center justify-center">
            {errorCount > 9 ? "9+" : errorCount}
          </span>
        )}
      </button>

      {/* Panel */}
      {isOpen && (
        <div
          className={`fixed ${positionClasses[position]} z-[90] mt-12 w-80 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden`}
        >
          {/* Header */}
          <div className="bg-gray-100 px-4 py-2 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 text-sm">
              Performance Monitor
            </h3>
            <button
              onClick={() => setIsOpen(false)}
              aria-label="Close performance monitor"
              className="text-gray-500 hover:text-gray-700"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="p-4 max-h-96 overflow-y-auto">
            {/* Web Vitals */}
            {report?.webVitals && (
              <div className="mb-4">
                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">
                  Web Vitals
                </h4>
                <div className="space-y-2">
                  {Object.entries(report.webVitals).map(
                    ([key, value]) =>
                      value !== undefined && (
                        <div
                          key={key}
                          className="flex justify-between items-center text-sm"
                        >
                          <span className="text-gray-600">{key}</span>
                          <span
                            className={`font-mono ${
                              getVitalStatus(key, value).color
                            }`}
                          >
                            {value.toFixed(2)}
                            {getVitalUnit(key)}
                          </span>
                        </div>
                      ),
                  )}
                </div>
              </div>
            )}

            {/* Performance Metrics */}
            {latestMetrics.length > 0 && (
              <div className="mb-4">
                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">
                  Metrics ({metrics.length})
                </h4>
                <div className="space-y-1">
                  {latestMetrics.slice(0, 10).map((m) => (
                    <div
                      key={m.name}
                      className="flex justify-between items-center text-xs"
                    >
                      <span className="text-gray-600">{m.name}</span>
                      <span className="font-mono text-gray-900">
                        {m.value.toFixed(2)}
                        {m.unit}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Errors */}
            <div className="mb-4">
              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">
                Errors ({errorCount})
              </h4>
              <ErrorList />
            </div>

            {/* Session Info */}
            {report && (
              <div className="text-xs text-gray-500">
                <div className="flex justify-between">
                  <span>URL:</span>
                  <span
                    className="font-mono truncate max-w-[150px]"
                    title={report.url}
                  >
                    {report.url.split("/").pop()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Resources:</span>
                  <span>{report.resources.length}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Error list sub-component
 */
function ErrorList() {
  const errors = getTrackedErrors().slice(0, 5);

  if (errors.length === 0) {
    return <p className="text-xs text-gray-500">No errors tracked</p>;
  }

  return (
    <div className="space-y-1">
      {errors.map((error) => (
        <div
          key={error.id}
          className="text-xs p-2 bg-gray-50 rounded truncate"
          title={error.message}
        >
          <span
            className={`font-semibold ${
              error.severity === "critical" || error.severity === "high"
                ? "text-red-600"
                : "text-gray-600"
            }`}
          >
            [{error.severity}]
          </span>
          <span className="text-gray-600 ml-1">
            {error.name}: {error.message.slice(0, 30)}...
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * Get vital status and color
 */
function getVitalStatus(
  key: string,
  value: number,
): { status: string; color: string } {
  const thresholds: Record<
    string,
    { good: number; poor: number; unit: string }
  > = {
    LCP: { good: 2500, poor: 4000, unit: "ms" },
    FID: { good: 100, poor: 300, unit: "ms" },
    CLS: { good: 0.1, poor: 0.25, unit: "" },
    FCP: { good: 1800, poor: 3000, unit: "ms" },
    TTFB: { good: 800, poor: 1800, unit: "ms" },
    SI: { good: 3400, poor: 5800, unit: "ms" },
  };

  const threshold = thresholds[key];
  if (!threshold) {
    return { status: "unknown", color: "text-gray-600" };
  }

  if (value <= threshold.good) {
    return { status: "good", color: "text-green-600" };
  }

  if (value <= threshold.poor) {
    return { status: "needs-improvement", color: "text-yellow-600" };
  }

  return { status: "poor", color: "text-red-600" };
}

/**
 * Get unit for vital
 */
function getVitalUnit(key: string): string {
  const units: Record<string, string> = {
    LCP: "ms",
    FID: "ms",
    CLS: "",
    FCP: "ms",
    TTFB: "ms",
    SI: "ms",
  };
  return units[key] || "";
}

/**
 * Hook to measure component render performance
 */
export function useRenderPerformance(componentName: string) {
  const [renderCount, setRenderCount] = useState(0);
  const [lastRenderTime, setLastRenderTime] = useState(0);

  useEffect(() => {
    const start = performance.now();

    return () => {
      const duration = performance.now() - start;
      setRenderCount((c) => c + 1);
      setLastRenderTime(duration);
    };
  }, []);

  return { renderCount, lastRenderTime };
}

export default PerformanceReportPanel;
