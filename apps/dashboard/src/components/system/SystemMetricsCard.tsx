import { MetricSample, TimeSeries } from "../../metrics";
import { Chart } from "../Chart";

type Props = {
  rps?: MetricSample[];
  duration?: TimeSeries[];
  oracleQueue?: MetricSample[];
  datafeedStaleness?: MetricSample[];
  formatDuration: (value?: number) => string;
};

export function SystemMetricsCard({ rps, duration, oracleQueue, datafeedStaleness, formatDuration }: Props) {
  return (
    <>
      {rps && (
        <div className="card inner">
          <h3>HTTP RPS (5m)</h3>
          <ul className="list">
            {rps.map((m) => {
              const label = m.metric.status ? `Status ${m.metric.status}` : "All status codes";
              return (
                <li key={`${m.metric.status || "all"}`}>
                  <div className="row">
                    <span className="tag subdued">{label}</span>
                    <strong>{Number(m.value[1]).toFixed(3)}</strong>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {oracleQueue && oracleQueue.length > 0 && (
        <div className="card inner">
          <h3>Oracle Attempts</h3>
          <ul className="list">
            {oracleQueue.map((m) => {
              const statusLabel = m.metric.status || "all";
              return (
                <li key={`${statusLabel}`}>
                  <div className="row">
                    <span className="tag subdued">{statusLabel}</span>
                    <strong>{Number(m.value[1]).toFixed(0)}</strong>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {datafeedStaleness && datafeedStaleness.length > 0 && (
        <div className="card inner">
          <h3>Datafeed Freshness</h3>
          <ul className="list">
            {datafeedStaleness.slice(0, 5).map((m) => {
              const feedId = m.metric.feed_id || "feed";
              const status = m.metric.status || "unknown";
              const ageMs = Number(m.value[1]) * 1000;
              return (
                <li key={`${feedId}-${status}`}>
                  <div className="row">
                    <span className="tag subdued">{feedId}</span>
                    <span className={`tag ${status === "stale" ? "error" : "subdued"}`}>{status}</span>
                  </div>
                  <div className="muted mono">age {formatDuration(ageMs)}</div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {duration && duration.length > 0 && (
        <div className="card inner">
          <h3>HTTP p90 latency (past 30m)</h3>
          <ul className="list">
            {duration.map((ts, idx) => {
              const latest = ts.values[ts.values.length - 1];
              return (
                <li key={idx}>
                  <div className="row">
                    <span className="tag subdued">p90</span>
                    <strong>{Number(latest[1]).toFixed(3)}s</strong>
                  </div>
                </li>
              );
            })}
          </ul>
          <Chart
            label="p90 latency"
            data={duration[0].values.map(([x, y]) => ({ x, y: Number(y) }))}
            color="#0f766e"
            height={220}
          />
        </div>
      )}
    </>
  );
}
