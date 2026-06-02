/**
 * PlayArea.tsx -- Oracle Price Console (on-chain MorpheusDataFeed reader)
 *
 * Uses state: asset, priceDisplay, networkDisplay, datafeedHash,
 * datafeedShort, sourceLabel, isRequesting, errorMsg.
 * Actions: fetchPrice, updateAsset.
 */

import { NeoButton, NeoCard, NeoSelect } from "@shared/components-react";
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
  const datafeedShort = str("datafeedShort", "");
  const sourceLabel = str("sourceLabel", "");
  const errorMsg = str("errorMsg", "");
  const isRequesting = bool("isRequesting");
  const canFetchPrice = Boolean(asset);
  const assetInitial = asset.slice(0, 1);
  const displayPair = `${asset}/USD`;
  const priceLoaded = priceDisplay !== (t("notAvailable") || "N/A");

  return (
    <div className="price-play-area">
      <section className="price-hero" aria-label={t("priceHeroTitle")}>
        <div className="price-hero__copy">
          <span className="price-hero__badge" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">
              <path
                d="M3 13h3l2.4-6 3.2 12 2.6-8 1.8 4H21"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span className="price-eyebrow">{t("priceHeroTitle")}</span>
          <h2>{displayPair}</h2>
          <p>{t("priceHeroSubtitle")}</p>
        </div>
        <div className="price-hero__metrics" aria-label={t("priceMetrics")}>
          <div className="price-metric">
            <span>{t("priceMetricFeed")}</span>
            <strong>{datafeedShort || "--"}</strong>
          </div>
          <div className="price-metric">
            <span>{t("priceMetricNetwork")}</span>
            <strong>{networkDisplay || "--"}</strong>
          </div>
          <div className="price-metric">
            <span>{t("priceMetricSource")}</span>
            <strong>{sourceLabel || "on-chain"}</strong>
          </div>
        </div>
      </section>

      <section className="price-balance-card" aria-label={t("latestPrice")}>
        <div className={`asset-token asset-token--${asset.toLowerCase()}`}>
          {assetInitial}
        </div>
        <div className="price-balance-card__content">
          <span className="result-symbol">{displayPair}</span>
          <span className="result-price">{priceDisplay}</span>
        </div>
        <span
          className={`price-status${priceLoaded ? " price-status--live" : ""}`}
          aria-label={t("priceSignalTitle")}
        >
          <i className="price-status__dot" aria-hidden="true" />
          {priceLoaded ? t("priceStatusLive") : t("priceStatusReady")}
        </span>
      </section>

      <NeoCard
        variant="erobo"
        className="price-action-panel"
        title={t("priceActionTitle")}
      >
        <div className="price-hint">{t("priceActionHint")}</div>
        <div className="stack">
          <NeoSelect
            value={asset}
            label={t("asset") || "Asset"}
            options={[
              { value: "NEO", label: "NEO" },
              { value: "GAS", label: "GAS" },
              { value: "BTC", label: "BTC" },
            ]}
            onChange={(val) => dispatch("updateAsset", val)}
          />
          <NeoButton
            variant="primary"
            loading={isRequesting}
            disabled={!canFetchPrice || isRequesting}
            aria-label={t("fetchPrice") || "Fetch Price"}
            onClick={() => dispatch("fetchPrice")}
          >
            {t("fetchPrice") || "Fetch Price"}
          </NeoButton>
        </div>
      </NeoCard>

      {errorMsg && <div className="error-banner mono">{errorMsg}</div>}
    </div>
  );
}
