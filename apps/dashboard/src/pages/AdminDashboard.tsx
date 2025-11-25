import { useCallback, useEffect, useMemo, useState } from "react";
import { AuditEntry, ClientConfig, fetchAudit, ModuleStatus, NeoStatus, JamStatus } from "../api";
import { SystemState } from "../hooks/useSystemInfo";

type NeoStatusError = { enabled: boolean; error: string };

type Props = {
  systemState: SystemState;
  config: ClientConfig;
  onNotify: (type: "success" | "error", message: string) => void;
};

type AdminTab = "overview" | "modules" | "audit" | "metrics" | "settings";

export function AdminDashboard({ systemState, config, onNotify }: Props) {
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");

  if (systemState.status !== "ready") {
    return (
      <div className="admin-dashboard">
        <div className="admin-header">
          <h1>Admin Dashboard</h1>
          <p className="muted">Connect to the service layer to access admin features.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      <header className="admin-header">
        <div>
          <h1>Admin Dashboard</h1>
          <p className="muted">System management and monitoring</p>
        </div>
        <div className="admin-tabs">
          <button className={`tab ${activeTab === "overview" ? "active" : ""}`} onClick={() => setActiveTab("overview")}>
            Overview
          </button>
          <button className={`tab ${activeTab === "modules" ? "active" : ""}`} onClick={() => setActiveTab("modules")}>
            Modules
          </button>
          <button className={`tab ${activeTab === "audit" ? "active" : ""}`} onClick={() => setActiveTab("audit")}>
            Audit Log
          </button>
          <button className={`tab ${activeTab === "metrics" ? "active" : ""}`} onClick={() => setActiveTab("metrics")}>
            Metrics
          </button>
        </div>
      </header>

      <div className="admin-content">
        {activeTab === "overview" && <OverviewTab systemState={systemState} config={config} />}
        {activeTab === "modules" && <ModulesTab systemState={systemState} onNotify={onNotify} />}
        {activeTab === "audit" && <AuditTab config={config} />}
        {activeTab === "metrics" && <MetricsTab systemState={systemState} config={config} />}
      </div>
    </div>
  );
}

function OverviewTab({ systemState, config }: { systemState: SystemState; config: ClientConfig }) {
  if (systemState.status !== "ready") {
    return <p className="muted">Loading...</p>;
  }

  const modules = systemState.modules || [];
  const descriptors = systemState.descriptors || [];
  const accounts = systemState.accounts || [];

  const healthyModules = modules.filter((m: ModuleStatus) => m.status === "started" && m.ready_status === "ready").length;
  const degradedModules = modules.filter((m: ModuleStatus) => m.status?.includes("fail") || m.status?.includes("error")).length;
  const totalModules = modules.length;

  const neo = systemState.neo as NeoStatus | NeoStatusError | undefined;
  const jam = systemState.jam as JamStatus | undefined;

  return (
    <div className="overview-tab">
      <div className="stats-grid">
        <div className="stat-card large">
          <div className="stat-icon healthy">
            <svg viewBox="0 0 24 24" width="32" height="32" fill="currentColor">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
            </svg>
          </div>
          <div className="stat-info">
            <span className="stat-value">{healthyModules}/{totalModules}</span>
            <span className="stat-label">Healthy Modules</span>
          </div>
        </div>

        {degradedModules > 0 && (
          <div className="stat-card large warning">
            <div className="stat-icon warning">
              <svg viewBox="0 0 24 24" width="32" height="32" fill="currentColor">
                <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
              </svg>
            </div>
            <div className="stat-info">
              <span className="stat-value">{degradedModules}</span>
              <span className="stat-label">Degraded Modules</span>
            </div>
          </div>
        )}

        <div className="stat-card">
          <span className="stat-value">{accounts.length}</span>
          <span className="stat-label">Accounts</span>
        </div>

        <div className="stat-card">
          <span className="stat-value">{descriptors.length}</span>
          <span className="stat-label">Services</span>
        </div>
      </div>

      <div className="info-grid">
        <div className="info-card">
          <h3>System Status</h3>
          <dl className="info-list">
            <dt>Version</dt>
            <dd>{systemState.status === "ready" ? systemState.version || "unknown" : "unknown"}</dd>
            <dt>API Endpoint</dt>
            <dd className="mono">{config.baseUrl}</dd>
            <dt>Tenant</dt>
            <dd>{config.tenant || "none"}</dd>
          </dl>
        </div>

        <div className="info-card">
          <h3>Neo N3 Indexer</h3>
          {neo && "enabled" in neo ? (
            <dl className="info-list">
              <dt>Status</dt>
              <dd>{neo.enabled ? "Enabled" : "Disabled"}</dd>
              {"latest_height" in neo && (
                <>
                  <dt>Latest Height</dt>
                  <dd>{neo.latest_height?.toLocaleString()}</dd>
                  <dt>Node Lag</dt>
                  <dd>{neo.node_lag ?? 0} blocks</dd>
                </>
              )}
              {"error" in neo && (
                <>
                  <dt>Error</dt>
                  <dd className="error">{neo.error}</dd>
                </>
              )}
            </dl>
          ) : (
            <p className="muted">Not available</p>
          )}
        </div>

        <div className="info-card">
          <h3>JAM Service</h3>
          {jam ? (
            <dl className="info-list">
              <dt>Status</dt>
              <dd>{jam.enabled ? "Enabled" : "Disabled"}</dd>
              <dt>Store</dt>
              <dd>{jam.store || "memory"}</dd>
              <dt>Rate Limit</dt>
              <dd>{jam.rate_limit_per_min ?? "unlimited"}/min</dd>
            </dl>
          ) : (
            <p className="muted">Not available</p>
          )}
        </div>
      </div>

      <div className="quick-links">
        <h3>Quick Links</h3>
        <div className="links-grid">
          <a href={`${config.baseUrl}/system/status`} target="_blank" rel="noreferrer" className="link-card">
            System Status API
          </a>
          <a href={`${config.baseUrl}/system/version`} target="_blank" rel="noreferrer" className="link-card">
            Version Info
          </a>
          <a href={`${config.baseUrl}/metrics`} target="_blank" rel="noreferrer" className="link-card">
            Prometheus Metrics
          </a>
          <a href={`${config.baseUrl}/healthz`} target="_blank" rel="noreferrer" className="link-card">
            Health Check
          </a>
        </div>
      </div>
    </div>
  );
}

function ModulesTab({ systemState, onNotify }: { systemState: SystemState; onNotify: (type: "success" | "error", message: string) => void }) {
  const modules = systemState.status === "ready" ? systemState.modules || [] : [];
  const [filter, setFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filteredModules = useMemo(() => {
    return modules.filter((m: ModuleStatus) => {
      const matchesName = m.name.toLowerCase().includes(filter.toLowerCase());
      const matchesStatus = statusFilter === "all" || m.status === statusFilter || m.ready_status === statusFilter;
      return matchesName && matchesStatus;
    });
  }, [modules, filter, statusFilter]);

  const copyModuleInfo = useCallback((module: ModuleStatus) => {
    const info = JSON.stringify(module, null, 2);
    navigator.clipboard.writeText(info).then(() => {
      onNotify("success", `Copied ${module.name} info to clipboard`);
    });
  }, [onNotify]);

  return (
    <div className="modules-tab">
      <div className="modules-filters">
        <input
          type="text"
          placeholder="Filter by name..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All Statuses</option>
          <option value="started">Started</option>
          <option value="stopped">Stopped</option>
          <option value="failed">Failed</option>
          <option value="ready">Ready</option>
          <option value="not-ready">Not Ready</option>
        </select>
      </div>

      <div className="modules-table">
        <div className="table-header">
          <span>Module</span>
          <span>Domain</span>
          <span>Status</span>
          <span>Ready</span>
          <span>Started</span>
          <span>Actions</span>
        </div>
        {filteredModules.map((module) => (
          <div key={module.name} className="table-row">
            <span className="module-name">
              {module.name}
              {module.layer && <span className="module-layer">{module.layer}</span>}
            </span>
            <span>{module.domain || "-"}</span>
            <span className={`status-badge ${module.status}`}>{module.status || "unknown"}</span>
            <span className={`status-badge ${module.ready_status === "ready" ? "ready" : "not-ready"}`}>
              {module.ready_status || "unknown"}
            </span>
            <span className="mono">
              {module.started_at ? new Date(module.started_at).toLocaleString() : "-"}
            </span>
            <span>
              <button className="btn-small" onClick={() => copyModuleInfo(module)}>
                Copy Info
              </button>
            </span>
          </div>
        ))}
      </div>

      {filteredModules.length === 0 && (
        <p className="muted center">No modules match your filters.</p>
      )}
    </div>
  );
}

function AuditTab({ config }: { config: ClientConfig }) {
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [limit, setLimit] = useState(50);
  const [offset, setOffset] = useState(0);
  const [userFilter, setUserFilter] = useState("");
  const [methodFilter, setMethodFilter] = useState("");
  const [pathFilter, setPathFilter] = useState("");

  const loadAudit = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const entries = await fetchAudit(config, {
        limit,
        offset,
        user: userFilter || undefined,
        method: methodFilter || undefined,
        contains: pathFilter || undefined,
      });
      setAudit(entries);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [config, limit, offset, userFilter, methodFilter, pathFilter]);

  useEffect(() => {
    loadAudit();
  }, [loadAudit]);

  return (
    <div className="audit-tab">
      <div className="audit-filters">
        <input
          type="text"
          placeholder="User..."
          value={userFilter}
          onChange={(e) => setUserFilter(e.target.value)}
        />
        <select value={methodFilter} onChange={(e) => setMethodFilter(e.target.value)}>
          <option value="">All Methods</option>
          <option value="GET">GET</option>
          <option value="POST">POST</option>
          <option value="PUT">PUT</option>
          <option value="DELETE">DELETE</option>
          <option value="PATCH">PATCH</option>
        </select>
        <input
          type="text"
          placeholder="Path contains..."
          value={pathFilter}
          onChange={(e) => setPathFilter(e.target.value)}
        />
        <input
          type="number"
          placeholder="Limit"
          value={limit}
          onChange={(e) => setLimit(Number(e.target.value) || 50)}
          min={1}
          max={200}
        />
        <button onClick={loadAudit} disabled={loading}>
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="audit-table">
        <div className="table-header">
          <span>Time</span>
          <span>User</span>
          <span>Role</span>
          <span>Method</span>
          <span>Path</span>
          <span>Status</span>
          <span>IP</span>
        </div>
        {audit.map((entry, idx) => (
          <div key={`${entry.time}-${idx}`} className={`table-row ${entry.status >= 400 ? "error-row" : ""}`}>
            <span className="mono">{new Date(entry.time).toLocaleString()}</span>
            <span>{entry.user || "-"}</span>
            <span>{entry.role || "-"}</span>
            <span className="method-badge">{entry.method}</span>
            <span className="mono path-cell" title={entry.path}>{entry.path}</span>
            <span className={`status-code ${entry.status >= 400 ? "error" : "success"}`}>{entry.status}</span>
            <span className="mono">{entry.remote_addr || "-"}</span>
          </div>
        ))}
      </div>

      {audit.length === 0 && !loading && !error && (
        <p className="muted center">No audit entries found. Requires admin role.</p>
      )}

      <div className="pagination">
        <button onClick={() => setOffset(Math.max(0, offset - limit))} disabled={offset === 0}>
          Previous
        </button>
        <span>Showing {offset + 1} - {offset + audit.length}</span>
        <button onClick={() => setOffset(offset + limit)} disabled={audit.length < limit}>
          Next
        </button>
      </div>
    </div>
  );
}

function MetricsTab({ systemState, config }: { systemState: SystemState; config: ClientConfig }) {
  const modules = systemState.status === "ready" ? systemState.modules || [] : [];
  const timings = systemState.status === "ready" ? systemState.modulesTimings || {} : {};
  const uptime = systemState.status === "ready" ? systemState.modulesUptime || {} : {};
  const modulesSlow = systemState.status === "ready" ? systemState.modulesSlow : undefined;
  const modulesSlowThreshold = systemState.status === "ready" ? systemState.modulesSlowThreshold : undefined;

  const sortedByStartTime = useMemo(() => {
    return [...modules].sort((a: ModuleStatus, b: ModuleStatus) => {
      const aTime = timings[a.name]?.start_ms ?? 0;
      const bTime = timings[b.name]?.start_ms ?? 0;
      return bTime - aTime;
    });
  }, [modules, timings]);

  return (
    <div className="metrics-tab">
      <div className="metrics-header">
        <h3>Module Performance</h3>
        <a href={`${config.baseUrl}/metrics`} target="_blank" rel="noreferrer" className="btn-secondary">
          Open Prometheus Metrics
        </a>
      </div>

      <div className="metrics-table">
        <div className="table-header">
          <span>Module</span>
          <span>Start Time (ms)</span>
          <span>Stop Time (ms)</span>
          <span>Uptime (s)</span>
          <span>Interfaces</span>
        </div>
        {sortedByStartTime.map((module) => (
          <div key={module.name} className="table-row">
            <span className="module-name">{module.name}</span>
            <span className="mono">{timings[module.name]?.start_ms?.toFixed(2) ?? "-"}</span>
            <span className="mono">{timings[module.name]?.stop_ms?.toFixed(2) ?? "-"}</span>
            <span className="mono">{uptime[module.name]?.toFixed(0) ?? "-"}</span>
            <span className="interfaces">
              {module.interfaces?.slice(0, 3).map((iface: string) => (
                <span key={iface} className="interface-badge">{iface}</span>
              ))}
              {(module.interfaces?.length ?? 0) > 3 && (
                <span className="interface-badge more">+{(module.interfaces?.length ?? 0) - 3}</span>
              )}
            </span>
          </div>
        ))}
      </div>

      {modulesSlow && modulesSlow.length > 0 && (
        <div className="slow-modules">
          <h4>Slow Modules ({">"}{modulesSlowThreshold}ms)</h4>
          <div className="slow-list">
            {modulesSlow.map((name: string) => (
              <span key={name} className="slow-badge">{name}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
