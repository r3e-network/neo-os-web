/**
 * Monitoring Dashboard Panel
 * Shows aggregated monitoring data for admins/developers
 */

import React, { useState, useEffect } from "react";
import { getPerformanceMetrics, generatePerformanceReport } from "@/lib/monitoring/performance";
import { getTrackedErrors, getErrorCount, type TrackedError } from "@/lib/monitoring/errors";
import { getSession, getBufferedEvents, getSessionId } from "@/lib/monitoring/analytics";

interface MonitoringPanelProps {
  /** Show only for admin users */
  requireAdmin?: boolean;
  /** Position */
  position?: "top-right" | "bottom-right" | "top-left" | "bottom-left";
}

/**
 * Monitoring Dashboard Panel
 * Full-featured monitoring dashboard for developers
 */
export function MonitoringPanel({
  requireAdmin = false,
  position = "bottom-right",
}: MonitoringPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "errors" | "performance" | "analytics">("overview");
  const [session, setSession] = useState<ReturnType<typeof getSession>>(null);
  const [errorCount, setErrorCount] = useState(0);
  const [errors, setErrors] = useState<TrackedError[]>([]);
  const [metrics, setMetrics] = useState<ReturnType<typeof getPerformanceMetrics>>([]);
  const [bufferedEvents, setBufferedEvents] = useState<ReturnType<typeof getBufferedEvents>>([]);

  // In production, check for admin role
  if (requireAdmin && process.env.NODE_ENV === "production") {
    // Add admin check logic here
    // if (!isAdmin) return null;
  }

  const positionClasses = {
    "top-right": "top-4 right-4",
    "bottom-right": "bottom-4 right-4",
    "top-left": "top-4 left-4",
    "bottom-left": "bottom-4 left-4",
  };

  useEffect(() => {
    if (!isOpen) return;

    let active = true;
    const updateData = () => {
      if (!active) return;
      setSession(getSession());
      setErrorCount(getErrorCount());
      setErrors(getTrackedErrors());
      setMetrics(getPerformanceMetrics());
      setBufferedEvents(getBufferedEvents());
    };

    updateData();
    const interval = setInterval(updateData, 2000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [isOpen]);

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed ${positionClasses[position]} z-50 p-3 bg-white/80 backdrop-blur-xl border border-gray-200/50 hover:border-neo/50 text-gray-900 rounded-2xl shadow-xl transition-all hover:scale-105 hover:bg-white`}
        aria-label={isOpen ? "Close monitoring dashboard" : "Open monitoring dashboard"}
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        {errorCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-xs flex items-center justify-center">
            {errorCount > 9 ? "9+" : errorCount}
          </span>
        )}
      </button>

      {/* Dashboard Panel */}
      {isOpen && (
        <div className={`fixed ${positionClasses[position]} mt-16 w-96 bg-white/90 backdrop-blur-2xl rounded-3xl shadow-2xl border border-gray-200/50 overflow-hidden z-50 transition-all`}>
          {/* Tabs */}
          <div className="flex border-b border-gray-200/50">
            {(["overview", "errors", "performance", "analytics"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-3 px-3 text-xs font-bold capitalize transition-all focus-visible:outline-none ${activeTab === tab
                    ? "text-neo border-b-2 border-neo bg-neo/5"
                    : "text-gray-500 hover:text-gray-900 hover:bg-black/5"
                  }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="p-4 max-h-[70vh] overflow-y-auto">
            {activeTab === "overview" && (
              <OverviewTab
                session={session}
                errorCount={errorCount}
                metricsCount={metrics.length}
                eventsCount={bufferedEvents.length}
              />
            )}

            {activeTab === "errors" && (
              <ErrorsTab errors={errors} />
            )}

            {activeTab === "performance" && (
              <PerformanceTab metrics={metrics} />
            )}

            {activeTab === "analytics" && (
              <AnalyticsTab
                session={session}
                events={bufferedEvents}
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Overview Tab
 */
function OverviewTab({
  session,
  errorCount,
  metricsCount,
  eventsCount,
}: {
  session: ReturnType<typeof getSession>;
  errorCount: number;
  metricsCount: number;
  eventsCount: number;
}) {
  return (
    <div className="space-y-4">
      {/* Session Info */}
      <div className="bg-white/50 border border-gray-200/50 rounded-2xl p-4">
        <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-3">
          Session
        </h4>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">ID:</span>
            <span className="font-mono text-xs truncate max-w-[150px]" title={session?.id}>
              {session?.id.slice(0, 16)}...
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Duration:</span>
            <span>{session ? formatDuration(Date.now() - session.startTime) : "N/A"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">First Visit:</span>
            <span>{session?.firstVisit ? "Yes" : "No"}</span>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="Errors"
          value={errorCount}
          color={errorCount > 0 ? "text-red-600" : "text-green-600"}
        />
        <StatCard
          label="Metrics"
          value={metricsCount}
          color="text-blue-600"
        />
        <StatCard
          label="Events"
          value={eventsCount}
          color="text-purple-600"
        />
        <StatCard
          label="Page Views"
          value={session?.pageCount ?? 0}
          color="text-indigo-600"
        />
      </div>
    </div>
  );
}

/**
 * Errors Tab
 */
function ErrorsTab({ errors }: { errors: TrackedError[] }) {
  if (errors.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <svg className="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p>No errors tracked</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {errors.map((error) => (
        <div
          key={error.id}
          className={`p-4 rounded-2xl border transition-all hover:scale-[1.02] ${error.severity === "critical" || error.severity === "high"
              ? "bg-red-50/50 border-red-200/50"
              : "bg-white/50 border-gray-200/50 hover:border-gray-300"
            }`}
        >
          <div className="flex items-start justify-between mb-1">
            <span className={`text-xs font-semibold uppercase ${error.severity === "critical" ? "text-red-600" :
                error.severity === "high" ? "text-orange-600" :
                  error.severity === "medium" ? "text-yellow-600" :
                    "text-gray-600"
              }`}>
              {error.severity}
            </span>
            <span className="text-xs text-gray-500">
              x{error.count}
            </span>
          </div>
          <p className="text-sm font-medium text-gray-900 mb-1">
            {error.name}
          </p>
          <p className="text-xs text-gray-600 truncate">
            {error.message}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
              {error.category}
            </span>
            <span className="text-xs text-gray-500">
              {formatTimeAgo(error.lastSeen)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Performance Tab
 */
function PerformanceTab({ metrics }: { metrics: ReturnType<typeof getPerformanceMetrics> }) {
  const grouped = metrics.reduce((acc, m) => {
    if (!acc[m.name]) acc[m.name] = [];
    acc[m.name].push(m);
    return acc;
  }, {} as Record<string, typeof metrics>);

  const latest = Object.entries(grouped).map(([name, values]) => ({
    name,
    value: values[values.length - 1]?.value ?? 0,
    unit: values[0]?.unit ?? "",
    count: values.length,
    avg: values.reduce((sum, v) => sum + v.value, 0) / values.length,
  }));

  if (latest.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>No performance metrics collected</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {latest.map((metric) => (
        <div key={metric.name} className="bg-white/50 border border-gray-200/50 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-bold text-gray-900">
              {metric.name}
            </span>
            <span className="text-xs text-gray-500">
              {metric.count} samples
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-gray-500">Latest:</span>
              <span className="ml-1 font-mono">{metric.value.toFixed(2)}{metric.unit}</span>
            </div>
            <div>
              <span className="text-gray-500">Avg:</span>
              <span className="ml-1 font-mono">{metric.avg.toFixed(2)}{metric.unit}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Analytics Tab
 */
function AnalyticsTab({
  session,
  events,
}: {
  session: ReturnType<typeof getSession>;
  events: ReturnType<typeof getBufferedEvents>;
}) {
  const eventTypes = events.reduce((acc, e) => {
    acc[e.type] = (acc[e.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-4">
      {/* Event Types */}
      <div className="bg-gray-50 rounded-lg p-3">
        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">
          Event Types ({events.length})
        </h4>
        <div className="flex flex-wrap gap-1">
          {Object.entries(eventTypes).map(([type, count]) => (
            <span
              key={type}
              className="text-xs bg-gray-200 px-2 py-1 rounded"
            >
              {type}: {count}
            </span>
          ))}
        </div>
      </div>

      {/* Recent Events */}
      <div className="bg-gray-50 rounded-lg p-3">
        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">
          Recent Events
        </h4>
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {events.slice(-5).reverse().map((event) => (
            <div key={event.id} className="text-xs flex items-center gap-2">
              <span className="text-gray-500">{formatTimeAgo(event.timestamp)}</span>
              <span className="font-medium">{event.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Stat Card
 */
function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="bg-white/50 border border-gray-200/50 rounded-2xl p-4 text-center hover:border-neo/30 transition-colors">
      <div className={`text-3xl font-black ${color}`}>
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-wider font-bold text-gray-500 mt-1">
        {label}
      </div>
    </div>
  );
}

/**
 * Format duration
 */
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

/**
 * Format time ago
 */
function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export default MonitoringPanel;
