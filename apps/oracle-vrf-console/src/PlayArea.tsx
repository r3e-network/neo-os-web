import { NeoButton, NeoCard } from "@shared/components-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool } = useStateBindings(state);

  const requestId = str("requestId", t("notAvailable") || "N/A");
  const randomValue = str("randomValue", t("notAvailable") || "N/A");
  const proof = str("proof", t("notAvailable") || "N/A");
  const oracleHash = str("oracleHash", t("notAvailable") || "N/A");
  const networkDisplay = str("networkDisplay", "N3 TestNet");
  const publicApiUrl = str("publicApiUrl");
  const vrfMode = str("vrfMode", "Direct");
  const isRequesting = bool("isRequesting");

  return (
    <div className="vrf-play-area">
      {/* Stats Bar */}
      <div className="stats-bar">
        <div className="stat-chip">
          <span className="stat-chip-label">{t("network") || "Network"}</span>
          <span className="stat-chip-value">{networkDisplay}</span>
        </div>
        <div className="stat-chip">
          <span className="stat-chip-label">{t("mode") || "Mode"}</span>
          <span className="stat-chip-value">{vrfMode}</span>
        </div>
      </div>

      {/* Oracle Info */}
      <NeoCard title={t("oracleInfo") || "Oracle Info"}>
        <div className="info-grid">
          <div className="info-row">
            <span className="label">{t("oracleHash") || "Oracle Hash"}</span>
            <span className="value mono">{oracleHash}</span>
          </div>
          {publicApiUrl && (
            <div className="info-row">
              <span className="label">{t("apiUrl") || "API URL"}</span>
              <span className="value mono">{publicApiUrl}</span>
            </div>
          )}
        </div>
      </NeoCard>

      {/* Result Section */}
      <NeoCard title={t("results") || "Results"}>
        <div className="result-grid">
          <div className="result-row">
            <span className="label">{t("labelRequest") || "Request ID"}</span>
            <span className="value mono">{requestId}</span>
          </div>
          <div className="result-row">
            <span className="label">{t("labelValue") || "Random Value"}</span>
            <span className="value mono">{randomValue}</span>
          </div>
          <div className="result-row">
            <span className="label">{t("labelProof") || "Proof"}</span>
            <span className="value mono">{proof}</span>
          </div>
        </div>
      </NeoCard>

      {/* Operation Section */}
      <NeoButton
        variant="primary"
        size="lg"
        block
        loading={isRequesting}
        aria-label={t("requestRandom") || "Request Randomness"}
        onClick={() => dispatch("requestRandom")}
      >
        {isRequesting ? t("requesting") || "Requesting..." : t("requestRandom") || "Request Randomness"}
      </NeoButton>
    </div>
  );
}
