import { useCallback, useState } from "react";
import {
  Account,
  Descriptor,
  JamStatus,
  ModuleStatus,
  NeoStatus,
  fetchAccounts,
  fetchDescriptors,
  fetchHealth,
  fetchSystemStatus,
  fetchVersion,
} from "../api";
import {
  MetricSample,
  MetricsConfig,
  promQuery,
  promQueryRange,
  TimeSeries,
} from "../metrics";

export type SystemState =
  | { status: "idle" }
  | { status: "loading" }
  | {
      status: "ready";
      descriptors: Descriptor[];
      accounts: Account[];
      version?: string;
      jam?: JamStatus;
      neo?: NeoStatus | { enabled: boolean; error: string };
      modules?: ModuleStatus[];
      modulesSummary?: {
        data?: string[];
        event?: string[];
        compute?: string[];
      };
      modulesAPIMeta?: Record<string, { total?: number; slow?: number }>;
      modulesAPISummary?: Record<string, string[]>;
      modulesLayers?: Record<string, string[]>;
      modulesTimings?: Record<string, { start_ms?: number; stop_ms?: number }>;
      modulesUptime?: Record<string, number>;
      modulesMeta?: Record<string, number>;
      modulesSlow?: string[];
      modulesSlowThreshold?: number;
      modulesNotes?: Record<string, string[]>;
      modulesPermissions?: Record<string, string[]>;
      modulesDeps?: Record<string, string[]>;
      modulesWaitingDeps?: string[];
      modulesWaitingReasons?: Record<string, string>;
      busFanout?: Record<string, { ok?: number; error?: number }>;
      busFanoutRecent?: Record<string, { ok?: number; error?: number }>;
      busFanoutRecentWindowSeconds?: number;
      metrics?: {
        rps?: MetricSample[];
        duration?: TimeSeries[];
        oracleQueue?: MetricSample[];
        datafeedStaleness?: MetricSample[];
        busFanout?: MetricSample[];
      };
    }
  | { status: "error"; message: string };

type ServerConfig = { baseUrl: string; token: string; tenant?: string };

export function useSystemInfo(
  config: ServerConfig,
  promConfig: MetricsConfig,
  canQuery: boolean,
) {
  const [state, setState] = useState<SystemState>({ status: "idle" });
  const [systemVersion, setSystemVersion] = useState<string>("");

  const load = useCallback(async () => {
    if (!canQuery) {
      setState({ status: "idle" });
      return;
    }
    setState({ status: "loading" });
    try {
      const [health, descriptors, version, systemStatus] = await Promise.all([
        fetchHealth(config),
        fetchDescriptors(config),
        fetchVersion(config),
        fetchSystemStatus(config),
      ]);
      let accounts: Account[] = [];
      try {
        accounts = await fetchAccounts(config);
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message.toLowerCase()
            : String(err).toLowerCase();
        if (
          !msg.includes("tenant required") &&
          !msg.includes("unauthorised") &&
          !msg.includes("401")
        ) {
          throw err;
        }
        accounts = [];
      }
      let metrics:
        | {
            rps?: MetricSample[];
            duration?: TimeSeries[];
            oracleQueue?: MetricSample[];
            datafeedStaleness?: MetricSample[];
            busFanout?: MetricSample[];
          }
        | undefined;
      if (promConfig.prometheusBaseUrl) {
        try {
          const now = Date.now() / 1000;
          const [rps, duration, oracleQueue, datafeedStaleness, busFanout] =
            await Promise.all([
              promQuery(
                "sum(rate(http_requests_total[5m])) by (status)",
                promConfig,
              ),
              promQueryRange(
                "histogram_quantile(0.9, sum by (le) (rate(http_request_duration_seconds_bucket[5m])))",
                now - 1800,
                now,
                60,
                promConfig,
              ),
              promQuery(
                "sum(service_layer_oracle_request_attempts_total) by (status)",
                promConfig,
              ),
              promQuery("service_layer_datafeeds_stale_seconds", promConfig),
              promQuery(
                "sum(increase(service_layer_engine_bus_fanout_total[5m])) by (kind,result)",
                promConfig,
              ),
            ]);
          metrics = {
            rps,
            duration,
            oracleQueue,
            datafeedStaleness,
            busFanout,
          };
        } catch {
          metrics = undefined;
        }
      }
      setState({
        status: "ready",
        descriptors,
        accounts,
        version: health.version ?? version.version,
        metrics,
        jam: systemStatus.jam,
        neo: systemStatus.neo as NeoStatus,
        modules: systemStatus.modules,
        modulesSummary: systemStatus.modules_summary,
        modulesAPIMeta: (systemStatus as any).modules_api_meta,
        modulesAPISummary: (systemStatus as any).modules_api_summary,
        modulesLayers: (systemStatus as any).modules_layers,
        modulesTimings: systemStatus.modules_timings,
        modulesUptime: systemStatus.modules_uptime,
        modulesMeta: systemStatus.modules_meta,
        modulesSlow: systemStatus.modules_slow,
        modulesSlowThreshold: systemStatus.modules_slow_threshold_ms,
        modulesWaitingDeps: systemStatus.modules_waiting_deps,
        modulesWaitingReasons: systemStatus.modules_waiting_reasons,
        busFanout: systemStatus.bus_fanout,
        busFanoutRecent: systemStatus.bus_fanout_recent,
        busFanoutRecentWindowSeconds: (systemStatus as any)
          .bus_fanout_recent_window_seconds,
        modulesNotes: (systemStatus.modules || []).reduce<
          Record<string, string[]>
        >((acc, m) => {
          if ((m as any).notes && (m as any).notes.length > 0) {
            acc[m.name] = (m as any).notes as string[];
          }
          return acc;
        }, {}),
        modulesPermissions: (systemStatus.modules || []).reduce<
          Record<string, string[]>
        >((acc, m) => {
          if ((m as any).permissions && (m as any).permissions.length > 0) {
            acc[m.name] = (m as any).permissions as string[];
          }
          return acc;
        }, {}),
        modulesDeps: (systemStatus.modules || []).reduce<
          Record<string, string[]>
        >((acc, m) => {
          if ((m as any).depends_on && (m as any).depends_on.length > 0) {
            acc[m.name] = (m as any).depends_on as string[];
          }
          return acc;
        }, {}),
      });
      setSystemVersion(version.version);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setState({ status: "error", message });
    }
  }, [canQuery, config, promConfig]);

  return { state, systemVersion, load };
}
