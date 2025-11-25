import { Chart } from "../Chart";

type BusProps = {
  busFanout?: Record<string, { ok?: number; error?: number }>;
  busFanoutRecent?: Record<string, { ok?: number; error?: number }>;
  busFanoutRecentWindowSeconds?: number;
};

export function SystemBusCards({ busFanout, busFanoutRecent, busFanoutRecentWindowSeconds }: BusProps) {
  if (!busFanout && !busFanoutRecent) return null;
  return (
    <>
      {busFanout && Object.keys(busFanout).length > 0 && (
        <div className="card inner">
          <h4>Engine Bus Fan-out (lifetime)</h4>
          <p className="muted">Counts since process start; use Prometheus or slctl bus stats for windowed rates.</p>
          <ul className="list">
            {Object.entries(busFanout)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([kind, counts]) => (
                <li key={kind}>
                  <div className="row">
                    <span className="tag subdued">{kind}</span>
                    <span className="tag success" title="Successful fan-outs">
                      ok {counts.ok ?? 0}
                    </span>
                    <span className={`tag ${counts.error ? "error" : "subdued"}`} title="Errored fan-outs">
                      err {counts.error ?? 0}
                    </span>
                  </div>
                </li>
              ))}
          </ul>
        </div>
      )}
      {busFanoutRecent && Object.keys(busFanoutRecent).length > 0 && (
        <div className="card inner">
          <h4>Engine Bus Fan-out (recent)</h4>
          <p className="muted">Counts over the last {busFanoutRecentWindowSeconds ? `${busFanoutRecentWindowSeconds}s` : "window"}.</p>
          <ul className="list">
            {Object.entries(busFanoutRecent)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([kind, counts]) => (
                <li key={kind}>
                  <div className="row">
                    <span className="tag subdued">{kind}</span>
                    <span className="tag success" title="Successful fan-outs (recent window)">
                      ok {counts.ok ?? 0}
                    </span>
                    <span className={`tag ${counts.error ? "error" : "subdued"}`} title="Errored fan-outs (recent window)">
                      err {counts.error ?? 0}
                    </span>
                  </div>
                </li>
              ))}
          </ul>
        </div>
      )}
    </>
  );
}
