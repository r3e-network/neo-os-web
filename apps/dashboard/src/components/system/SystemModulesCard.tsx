import { useMemo } from "react";
import { ModuleStatus } from "../../api";

type Props = {
  modules: ModuleStatus[];
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
  activeSurface?: string;
  activeLayer?: string;
  onSurfaceChange?: (surface: string) => void;
  onLayerChange?: (layer: string) => void;
  onExport: (format: "json" | "csv") => void;
  formatDuration: (value?: number) => string;
  formatTimestamp: (value?: string) => string;
};

function computeUptime(start?: string, stop?: string): string {
  if (!start) return "";
  const startDate = new Date(start);
  const endDate = stop ? new Date(stop) : new Date();
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()))
    return "";
  const diff = endDate.getTime() - startDate.getTime();
  if (diff <= 0) return "";
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

export function SystemModulesCard({
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
  activeSurface,
  activeLayer,
  onSurfaceChange,
  onLayerChange,
  onExport,
  formatDuration,
  formatTimestamp,
}: Props) {
  const parsedOverride = slowOverrideMs ? parseFloat(slowOverrideMs) : 0;
  const activeSlowThreshold =
    parsedOverride > 0 ? parsedOverride : modulesSlowThreshold || 0;
  const filteredModules =
    modules?.filter((m) => {
      if (activeLayer) {
        const layer = (m.layer || "service").toLowerCase();
        if (layer !== activeLayer.toLowerCase()) {
          return false;
        }
      }
      if (!activeSurface) return true;
      const surface = activeSurface.toLowerCase();
      return (m.apis || []).some(
        (api) => (api.surface || api.name || "").toLowerCase() === surface,
      );
    }) || [];
  const slowFromTimings =
    activeSlowThreshold > 0 && filteredModules && modulesTimings
      ? filteredModules
          .filter((m) => {
            const t = modulesTimings[m.name];
            if (!t) return false;
            return (
              (t.start_ms || 0) >= activeSlowThreshold ||
              (t.stop_ms || 0) >= activeSlowThreshold
            );
          })
          .map((m) => m.name)
      : [];
  const slowList =
    parsedOverride > 0 ? slowFromTimings : modulesSlow || slowFromTimings;
  const surfaceStats = useMemo(() => {
    const stats: { surface: string; total: number; slow: number }[] = [];
    if (modulesAPIMeta && Object.keys(modulesAPIMeta).length > 0) {
      Object.entries(modulesAPIMeta)
        .sort(([a], [b]) => a.localeCompare(b))
        .forEach(([surface, meta]) =>
          stats.push({ surface, total: meta.total ?? 0, slow: meta.slow ?? 0 }),
        );
      return stats;
    }
    if (modulesAPISummary) {
      Object.entries(modulesAPISummary)
        .sort(([a], [b]) => a.localeCompare(b))
        .forEach(([surface, mods]) => {
          const slowCount = (mods || []).filter((m) =>
            slowList.includes(m),
          ).length;
          stats.push({ surface, total: mods?.length || 0, slow: slowCount });
        });
    }
    return stats;
  }, [modulesAPIMeta, modulesAPISummary, slowList]);

  return (
    <div className="card inner">
      <h3>
        Modules ({filteredModules.length}
        {modules && activeSurface ? ` / ${modules.length}` : ""})
      </h3>
      <div
        className="row"
        style={{ gap: "8px", flexWrap: "wrap", alignItems: "center" }}
      >
        {modulesMeta && (
          <p className="muted mono" style={{ margin: 0 }}>
            started: {modulesMeta.started ?? 0} • failed:{" "}
            {modulesMeta.failed ?? 0} • stop-error:{" "}
            {modulesMeta.stop_error ?? 0} • not-ready:{" "}
            {modulesMeta.not_ready ?? 0}
          </p>
        )}
        <div className="row" style={{ gap: "6px", marginLeft: "auto" }}>
          <button
            type="button"
            className="ghost"
            disabled={!filteredModules.length}
            onClick={() => onExport("json")}
          >
            Export JSON
          </button>
          <button
            type="button"
            className="ghost"
            disabled={!filteredModules.length}
            onClick={() => onExport("csv")}
          >
            Export CSV
          </button>
        </div>
      </div>
      {slowList && slowList.length > 0 && (
        <div className="notice warning">
          Slow modules (threshold{" "}
          {activeSlowThreshold > 0 ? `${activeSlowThreshold}ms` : "n/a"}):{" "}
          {slowList.join(", ")}
        </div>
      )}
      {(() => {
        const degraded =
          filteredModules?.filter((m) => {
            const status = (m.status || "").toLowerCase();
            const ready = (m.ready_status || "").toLowerCase();
            return (
              status.includes("fail") ||
              status.includes("error") ||
              ready === "not-ready"
            );
          }) || [];
        if (degraded.length === 0) return null;
        return (
          <div className="notice error">
            Degraded modules:{" "}
            {degraded.map((m, idx) => (
              <span key={m.name}>
                {m.name}
                {m.status ? ` (${m.status})` : ""}
                {idx < degraded.length - 1 ? ", " : ""}
              </span>
            ))}
          </div>
        );
      })()}
      {modulesSummary && (
        <p className="muted mono">
          data: {(modulesSummary.data || []).join(", ") || "n/a"} • event:{" "}
          {(modulesSummary.event || []).join(", ") || "n/a"} • compute:{" "}
          {(modulesSummary.compute || []).join(", ") || "n/a"}
        </p>
      )}
      {modulesLayers && Object.keys(modulesLayers).length > 0 && (
        <div
          className="muted mono"
          style={{
            display: "flex",
            gap: "6px",
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <span>Layers:</span>
          {Object.entries(modulesLayers)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([layer, names]) => (
              <span
                key={layer}
                className={`tag subtle${
                  activeLayer?.toLowerCase() === layer.toLowerCase()
                    ? " active"
                    : ""
                }`}
                style={{ cursor: "pointer" }}
                title={(names || []).join(", ") || "n/a"}
                onClick={() =>
                  onLayerChange?.(
                    activeLayer?.toLowerCase() === layer.toLowerCase()
                      ? ""
                      : layer,
                  )
                }
              >
                {layer}: {names?.length ?? 0}
              </span>
            ))}
          {activeLayer && (
            <span
              className="tag subtle"
              style={{ cursor: "pointer" }}
              onClick={() => onLayerChange?.("")}
              title="Clear layer filter"
            >
              clear
            </span>
          )}
        </div>
      )}
      {modulesAPISummary && Object.keys(modulesAPISummary).length > 0 && (
        <div
          className="muted mono"
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "6px",
            alignItems: "center",
          }}
        >
          <span>API surfaces:</span>
          {Object.entries(modulesAPISummary)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([surface, mods]) => {
              const isActive = activeSurface === surface;
              return (
                <span
                  key={surface}
                  className={`tag subtle${isActive ? " active" : ""}`}
                  style={{ cursor: "pointer" }}
                  onClick={() => onSurfaceChange?.(isActive ? "" : surface)}
                  title={`Modules: ${(mods || []).join(", ") || "none"}`}
                >
                  {surface} ({mods?.length ?? 0})
                </span>
              );
            })}
          {activeSurface && (
            <span
              className="tag subtle"
              style={{ cursor: "pointer" }}
              onClick={() => onSurfaceChange?.("")}
              title="Clear API surface filter"
            >
              clear
            </span>
          )}
        </div>
      )}
      {surfaceStats.length > 0 && (
        <div
          className="row"
          style={{ gap: "6px", flexWrap: "wrap", alignItems: "center" }}
        >
          {surfaceStats.map((s) => (
            <span
              key={s.surface}
              className={`tag subtle ${s.slow > 0 ? "warning" : ""}`}
              title={`slow: ${s.slow}`}
            >
              {s.surface}: {s.total} {s.slow > 0 && `(slow ${s.slow})`}
            </span>
          ))}
        </div>
      )}
      {activeSurface && (
        <p className="muted mono">
          Filtering modules by API surface: <strong>{activeSurface}</strong>
        </p>
      )}
      {activeLayer && (
        <p className="muted mono">
          Filtering modules by layer: <strong>{activeLayer}</strong>
        </p>
      )}
      <ul className="list">
        {filteredModules.map((m) => (
          <li key={m.name}>
            <div className="row">
              <div>
                <strong>{m.name}</strong>{" "}
                {m.domain && <span className="tag">{m.domain}</span>}{" "}
                {m.category && (
                  <span className="tag subdued">{m.category}</span>
                )}
                {m.layer && <span className="tag subtle">{m.layer}</span>}
                {m.interfaces && m.interfaces.length > 0 && (
                  <span className="tag subtle">{m.interfaces.join(",")}</span>
                )}
                {m.apis && m.apis.length > 0 && (
                  <span className="tag subtle">
                    apis{" "}
                    {m.apis
                      .map((api) => {
                        const label = (api.surface || api.name || "").trim();
                        const stable = (api.stability || "").toLowerCase();
                        if (!label) return "";
                        return stable && stable !== "stable"
                          ? `${label}(${stable})`
                          : label;
                      })
                      .filter(Boolean)
                      .join(",")}
                  </span>
                )}
                {modulesPermissions?.[m.name] &&
                  modulesPermissions[m.name].length > 0 && (
                    <span
                      className="tag subtle"
                      title={`Bus permissions: ${modulesPermissions[m.name].join(",")}`}
                    >
                      perms ({modulesPermissions[m.name].length})
                    </span>
                  )}
                {modulesDeps?.[m.name] && modulesDeps[m.name].length > 0 && (
                  <span
                    className="tag subtle"
                    title={`Depends on: ${modulesDeps[m.name].join(",")}`}
                  >
                    deps ({modulesDeps[m.name].length})
                  </span>
                )}
                {modulesWaitingDeps?.includes(m.name) && (
                  <span
                    className="tag warning"
                    title="Dependencies not ready yet"
                  >
                    waiting deps
                  </span>
                )}
              </div>
              {slowList?.includes(m.name) && (
                <span className="tag warning">slow</span>
              )}
              {m.status && (
                <span
                  className={`tag ${m.status.includes("fail") || m.status.includes("error") ? "error" : "subdued"}`}
                >
                  {m.status}
                </span>
              )}
              {m.ready_status && (
                <span
                  className={`tag ${
                    modulesWaitingDeps?.includes(m.name)
                      ? "warning"
                      : m.ready_status === "ready"
                        ? "success"
                        : m.ready_status === "not-ready"
                          ? "error"
                          : "subdued"
                  }`}
                  title={
                    modulesWaitingDeps?.includes(m.name)
                      ? modulesWaitingReasons?.[m.name] ||
                        "Waiting on dependencies to become ready"
                      : undefined
                  }
                >
                  {modulesWaitingDeps?.includes(m.name)
                    ? "waiting"
                    : m.ready_status}
                </span>
              )}
            </div>
            {(() => {
              const uptime = computeUptime(m.started_at, m.stopped_at);
              return uptime ? (
                <span className="tag subdued">uptime {uptime}</span>
              ) : null;
            })()}
            {m.capabilities && m.capabilities.length > 0 && (
              <div className="muted mono">
                caps: {m.capabilities.join(", ")}
              </div>
            )}
            {m.requires_apis && m.requires_apis.length > 0 && (
              <div className="muted mono">
                requires: {m.requires_apis.join(", ")}
              </div>
            )}
            {m.quotas && Object.keys(m.quotas).length > 0 && (
              <div className="muted mono">
                quotas:{" "}
                {Object.entries(m.quotas)
                  .map(([k, v]) => `${k}=${v}`)
                  .join(", ")}
              </div>
            )}
            {(m.started_at || m.updated_at) && (
              <div className="muted mono">
                {m.started_at && (
                  <>started {formatTimestamp(m.started_at)} · </>
                )}
                updated {formatTimestamp(m.updated_at)}
              </div>
            )}
            {(modulesTimings?.[m.name] ||
              modulesUptime?.[m.name] !== undefined) && (
              <div className="muted mono">
                {modulesTimings?.[m.name] && (
                  <>
                    start {modulesTimings[m.name].start_ms?.toFixed(1)}ms · stop{" "}
                    {modulesTimings[m.name].stop_ms?.toFixed(1)}ms
                  </>
                )}
                {modulesUptime && modulesUptime[m.name] !== undefined && (
                  <>
                    {modulesTimings?.[m.name] ? " · " : ""}
                    uptime{" "}
                    {formatDuration(
                      Math.round((modulesUptime[m.name] || 0) * 1000),
                    )}
                  </>
                )}
              </div>
            )}
            {(modulesNotes?.[m.name]?.length || m.error || m.ready_error) && (
              <div className="muted mono">
                {m.error && <>err: {m.error}</>}
                {m.ready_error && (
                  <>
                    {m.error ? " · " : ""}
                    ready_err: {m.ready_error}
                  </>
                )}
                {modulesNotes?.[m.name]?.length
                  ? ` notes: ${modulesNotes[m.name].join(" | ")}`
                  : null}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
