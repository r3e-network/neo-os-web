import { Descriptor, ModuleStatus, NeoStatus } from "../api";
import { JamStatus } from "../api";
import { MetricSample, TimeSeries } from "../metrics";
import { SystemBusCards } from "./system/SystemBusCards";
import { SystemDescriptorsCard } from "./system/SystemDescriptorsCard";
import { SystemJamCard } from "./system/SystemJamCard";
import { SystemMetricsCard } from "./system/SystemMetricsCard";
import { SystemModulesCard } from "./system/SystemModulesCard";
import { SystemNeoCard } from "./system/SystemNeoCard";

type Metrics = {
  rps?: MetricSample[];
  duration?: TimeSeries[];
  oracleQueue?: MetricSample[];
  datafeedStaleness?: MetricSample[];
};

type Props = {
  descriptors: Descriptor[];
  version?: string;
  buildVersion?: string;
  baseUrl: string;
  promBase?: string;
  jam?: JamStatus;
  neo?: NeoStatus | { enabled: boolean; error: string };
  modules?: ModuleStatus[];
  modulesTimings?: Record<string, { start_ms?: number; stop_ms?: number }>;
  modulesUptime?: Record<string, number>;
  modulesMeta?: Record<string, number>;
  modulesSlow?: string[];
  modulesSlowThreshold?: number;
  slowOverrideMs?: string;
  modulesSummary?: { data?: string[]; event?: string[]; compute?: string[] };
  modulesAPISummary?: Record<string, string[]>;
  modulesAPIMeta?: Record<string, { total?: number; slow?: number }>;
  modulesLayers?: Record<string, string[]>;
  modulesNotes?: Record<string, string[]>;
  modulesPermissions?: Record<string, string[]>;
  modulesDeps?: Record<string, string[]>;
  modulesWaitingDeps?: string[];
  modulesWaitingReasons?: Record<string, string>;
  busFanout?: Record<string, { ok?: number; error?: number }>;
  busFanoutRecent?: Record<string, { ok?: number; error?: number }>;
  busFanoutRecentWindowSeconds?: number;
  busMaxBytes?: number;
  busMaxBytesWarning?: string;
  metrics?: Metrics;
  activeSurface?: string;
  activeLayer?: string;
  onSurfaceChange?: (surface: string) => void;
  onLayerChange?: (layer: string) => void;
  formatDuration: (value?: number) => string;
  formatTimestamp: (value?: string) => string;
};

export function SystemOverview({
  descriptors,
  version,
  buildVersion,
  baseUrl,
  promBase,
  jam,
  neo,
  modules,
  modulesTimings,
  modulesUptime,
  modulesMeta,
  modulesSlow,
  modulesSlowThreshold,
  slowOverrideMs,
  modulesSummary,
  modulesAPISummary,
  modulesAPIMeta,
  modulesLayers,
  modulesNotes,
  modulesPermissions,
  modulesDeps,
  modulesWaitingDeps,
  modulesWaitingReasons,
  busFanout,
  busFanoutRecent,
  busFanoutRecentWindowSeconds,
  busMaxBytes,
  busMaxBytesWarning,
  metrics,
  activeSurface,
  activeLayer,
  onSurfaceChange,
  onLayerChange,
  formatDuration,
  formatTimestamp,
}: Props) {
  const handleExport = (format: "json" | "csv") => {
    if (!modules || modules.length === 0) return;
    const filtered = modules.filter((m) => {
      if (!activeSurface) return true;
      const surface = activeSurface.toLowerCase();
      return (m.apis || []).some(
        (api) => (api.surface || api.name || "").toLowerCase() === surface,
      );
    });
    if (format === "json") {
      const blob = new Blob([JSON.stringify(filtered, null, 2)], {
        type: "application/json",
      });
      triggerDownload(blob, "modules.json");
      return;
    }
    const headers = [
      "name",
      "domain",
      "category",
      "layer",
      "status",
      "ready",
      "interfaces",
      "apis",
      "permissions",
      "depends_on",
      "capabilities",
      "requires_apis",
      "quotas",
      "notes",
      "started_at",
      "stopped_at",
    ];
    const rows = filtered.map((m) => {
      const apis = (m.apis || [])
        .map((api) => {
          const label = (api.surface || api.name || "").trim();
          const stable = (api.stability || "").toLowerCase();
          return label
            ? stable && stable !== "stable"
              ? `${label}(${stable})`
              : label
            : "";
        })
        .filter(Boolean)
        .join("|");
      const perms = (modulesPermissions?.[m.name] || m.permissions || []).join(
        "|",
      );
      const depends = (modulesDeps?.[m.name] || []).join("|");
      const ifaces = (m.interfaces || []).join("|");
      const caps = (m.capabilities || []).join("|");
      const requires = (m.requires_apis || []).join("|");
      const quotas = m.quotas
        ? Object.entries(m.quotas)
            .map(([k, v]) => `${k}=${v}`)
            .join("|")
        : "";
      const notes = (m.notes || []).join("|");
      const row = [
        m.name,
        m.domain || "",
        m.category || "",
        m.layer || "",
        m.status || "",
        m.ready_status || "",
        ifaces,
        apis,
        perms,
        depends,
        caps,
        requires,
        quotas,
        notes,
        m.started_at || "",
        m.stopped_at || "",
      ];
      return row
        .map((val) => {
          if (val.includes(",") || val.includes('"') || val.includes("\n")) {
            return `"${val.replace(/"/g, '""')}"`;
          }
          return val;
        })
        .join(",");
    });
    const blob = new Blob([[headers.join(","), ...rows].join("\n")], {
      type: "text/csv",
    });
    triggerDownload(blob, "modules.csv");
  };

  return (
    <div className="grid">
      <div className="card inner">
        <h3>System</h3>
        <p>
          Version: <strong>{version ?? "unknown"}</strong>
        </p>
        {buildVersion && (
          <p className="muted mono">
            Build: <span>{buildVersion}</span>
          </p>
        )}
        <p>
          Base URL: <code>{baseUrl}</code>
        </p>
        {promBase && (
          <p>
            Prometheus: <code>{promBase}</code>
          </p>
        )}
      </div>

      {modulesWaitingDeps && modulesWaitingDeps.length > 0 && (
        <div className="card inner">
          <h4>Waiting for dependencies</h4>
          <p className="muted">
            These modules declared deps that are not ready yet.
          </p>
          <div className="row" style={{ gap: "6px", flexWrap: "wrap" }}>
            {modulesWaitingDeps.map((name) => (
              <span
                key={name}
                className="tag warning"
                title={modulesWaitingReasons?.[name] || undefined}
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      )}

      {(() => {
        const defaultCap = 1 << 20; // 1 MiB
        if (!busMaxBytes || busMaxBytes <= 0) {
          return (
            <div className="notice warning">
              Bus payload cap not reported; default 1 MiB applies. Set BUS_MAX_BYTES to tune and match proxy limits.
            </div>
          );
        }
        if (busMaxBytesWarning) {
          return <div className="notice warning">{busMaxBytesWarning}</div>;
        }
        if (busMaxBytes > defaultCap) {
          return (
            <div className="notice info">
              Bus payload cap set to {busMaxBytes.toLocaleString()} bytes. Ensure edge limits match this value.
            </div>
          );
        }
        return null;
      })()}

      <SystemBusCards
        busFanout={busFanout}
        busFanoutRecent={busFanoutRecent}
        busFanoutRecentWindowSeconds={busFanoutRecentWindowSeconds}
        busMaxBytes={busMaxBytes}
      />
      <SystemNeoCard neo={neo} />
      <SystemJamCard jam={jam} />

      {modules && modules.length > 0 && (
        <SystemModulesCard
          modules={modules}
          modulesTimings={modulesTimings}
          modulesUptime={modulesUptime}
          modulesMeta={modulesMeta}
          modulesSlow={modulesSlow}
          modulesSlowThreshold={modulesSlowThreshold}
          slowOverrideMs={slowOverrideMs}
          modulesSummary={modulesSummary}
          modulesAPISummary={modulesAPISummary}
          modulesAPIMeta={modulesAPIMeta}
          modulesLayers={modulesLayers}
          modulesNotes={modulesNotes}
          modulesPermissions={modulesPermissions}
          modulesDeps={modulesDeps}
          modulesWaitingDeps={modulesWaitingDeps}
          modulesWaitingReasons={modulesWaitingReasons}
          activeSurface={activeSurface}
          activeLayer={activeLayer}
          onSurfaceChange={onSurfaceChange}
          onLayerChange={onLayerChange}
          onExport={handleExport}
          formatDuration={formatDuration}
          formatTimestamp={formatTimestamp}
        />
      )}

      <SystemDescriptorsCard descriptors={descriptors} />

      <SystemMetricsCard
        rps={metrics?.rps}
        duration={metrics?.duration}
        oracleQueue={metrics?.oracleQueue}
        datafeedStaleness={metrics?.datafeedStaleness}
        formatDuration={formatDuration}
      />
    </div>
  );
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
