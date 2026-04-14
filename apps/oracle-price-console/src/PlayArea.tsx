/**
 * PlayArea.tsx -- Oracle Price Console
 *
 * Uses all state: asset, priceDisplay, oracleHash, networkDisplay,
 * datafeedHash, datafeedShort, publicApiUrl, isRequesting.
 * Actions: fetchPrice, updateAsset.
 */

import { NeoButton, NeoCard, NeoInput } from "@shared/components-react";
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

  const asset = str("asset", "NEO");
  const priceDisplay = str("priceDisplay", t("notAvailable") || "N/A");
  const oracleHash = str("oracleHash", "");
  const networkDisplay = str("networkDisplay", "");
  const datafeedHash = str("datafeedHash", "");
  const datafeedShort = str("datafeedShort", "");
  const publicApiUrl = str("publicApiUrl", "");
  const isRequesting = bool("isRequesting");

  return (
    <div className="price-play-area">
      {/* Result Section */}
      <div className="result-section">
        <span className="result-symbol">{asset}</span>
        <span className="result-price">{priceDisplay}</span>
      </div>

      {/* Infrastructure info */}
      <NeoCard variant="erobo" className="infra-card">
        <div className="infra-grid">
          {networkDisplay && (
            <div className="infra-row">
              <span className="infra-label">{t("network") || "Network"}</span>
              <span className="infra-value">{networkDisplay}</span>
            </div>
          )}
          {oracleHash && (
            <div className="infra-row">
              <span className="infra-label">Oracle</span>
              <span className="infra-value mono">{oracleHash.slice(0, 12)}...{oracleHash.slice(-8)}</span>
            </div>
          )}
          {datafeedShort && (
            <div className="infra-row">
              <span className="infra-label">{t("overviewDataFeed") || "DataFeed"}</span>
              <span className="infra-value mono">{datafeedShort}</span>
            </div>
          )}
          {publicApiUrl && (
            <div className="infra-row">
              <span className="infra-label">API</span>
              <span className="infra-value mono">{publicApiUrl}</span>
            </div>
          )}
        </div>
      </NeoCard>

      {/* Operation Section */}
      <div className="stack">
        <NeoInput
          value={asset}
          label={t("asset") || "Asset"}
          placeholder={t("assetPlaceholder") || "NEO / GAS / BTC"}
          onChange={(val) => dispatch("updateAsset", val)}
        />
        <NeoButton
          variant="primary"
          loading={isRequesting}
          aria-label={t("fetchPrice") || "Fetch Price"}
          onClick={() => dispatch("fetchPrice")}
        >
          {t("fetchPrice") || "Fetch Price"}
        </NeoButton>
      </div>
    </div>
  );
}
