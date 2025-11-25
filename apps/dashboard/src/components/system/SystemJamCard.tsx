import { JamStatus } from "../../api";

type Props = { jam?: JamStatus };

export function SystemJamCard({ jam }: Props) {
  if (!jam) return null;
  return (
    <div className="card inner">
      <h3>JAM</h3>
      <p>
        Status: <span className={`tag ${jam.enabled ? "subdued" : "error"}`}>{jam.enabled ? "enabled" : "disabled"}</span>
      </p>
      <p className="muted mono">
        Store: {jam.store || "n/a"} • Rate limit: {jam.rate_limit_per_min ?? 0}/min • Max preimage bytes: {jam.max_preimage_bytes ?? 0}
      </p>
      <p className="muted mono">
        Pending packages: {jam.max_pending_packages ?? 0} • Auth required: {jam.auth_required ? "yes" : "no"}
      </p>
      {jam.accumulators_enabled && (
        <p className="muted mono">
          Accumulators enabled • Hash: {jam.accumulator_hash || "n/a"}
          {jam.accumulator_roots && jam.accumulator_roots.length > 0 && (
            <>
              <br />
              Roots: {jam.accumulator_roots.map((r) => r.root).join(", ")}
            </>
          )}
        </p>
      )}
    </div>
  );
}
