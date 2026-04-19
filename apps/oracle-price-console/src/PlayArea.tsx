/**
 * PlayArea.tsx -- Oracle Price Console (on-chain MorpheusDataFeed reader)
 *
 * Uses state: asset, priceDisplay, networkDisplay, datafeedHash,
 * datafeedShort, sourceLabel, isRequesting, errorMsg.
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
  const networkDisplay = str("networkDisplay", "");
  const datafeedHash = str("datafeedHash", "");
  const datafeedShort = str("datafeedShort", "");
  const sourceLabel = str("sourceLabel", "");
  const errorMsg = str("errorMsg", "");
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
          {datafeedShort && (
            <div className="infra-row">
              <span className="infra-label">{t("overviewDataFeed") || "DataFeed"}</span>
              <span className="infra-value mono">{datafeedShort}</span>
            </div>
          )}
          {sourceLabel && (
            <div className="infra-row">
              <span className="infra-label">Source</span>
              <span className="infra-value mono">{sourceLabel}</span>
            </div>
          )}
        </div>
      </NeoCard>
      {errorMsg && (
        <div className="error-banner mono">{errorMsg}</div>
      )}

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
