import { useEffect, useState } from "react";
import { NeoStatus } from "../../api";
import { Chart } from "../Chart";

type Props = {
  neo?: NeoStatus | { enabled: boolean; error: string };
};

export function SystemNeoCard({ neo }: Props) {
  const [lagSeries, setLagSeries] = useState<{ x: number; y: number }[]>([]);

  useEffect(() => {
    if (!neo || !("node_lag" in neo) || (neo as any).node_lag === undefined) return;
    const lagVal = (neo as any).node_lag as number;
    const ts = Math.floor(Date.now() / 1000);
    setLagSeries((prev) => {
      const next = [...prev, { x: ts, y: lagVal }];
      if (next.length > 50) next.shift();
      return next;
    });
  }, [neo]);

  if (!neo) return null;
  return (
    <div className="card inner">
      <h3>NEO</h3>
      {"enabled" in neo && neo.enabled === false ? (
        <p className="error">NEO disabled: {neo && "error" in neo ? neo.error : "unknown"}</p>
      ) : (
        <>
          <p className="muted mono">
            network: {(neo as any).network || "n/a"} • latest: {(neo as any).latest_height ?? "n/a"} • stable: {(neo as any).stable_height ?? "n/a"}
          </p>
          {"node_lag" in neo && (neo as any).node_lag !== undefined && (
            <>
              <p className="muted mono">node lag: {(neo as any).node_lag}</p>
              <Chart label="Node lag" data={lagSeries} color="#a855f7" height={160} />
            </>
          )}
        </>
      )}
    </div>
  );
}
