/**
 * PlayArea.tsx -- Oracle Price Console (on-chain MorpheusDataFeed reader)
 *
 * Uses state: asset, priceDisplay, freshness, freshnessLabel, availablePairs,
 * networkDisplay, datafeedShort, sourceLabel, isRequesting, errorMsg.
 * Actions: fetchPrice, updateAsset.
 */

import { NeoButton, NeoCard, NeoSelect } from "@shared/components-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import type { Freshness } from "./hooks/usePriceConsole";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool, val } = useStateBindings(state);

  const asset = str("asset", "NEO");
  const priceDisplay = str("priceDisplay", t("notAvailable"));
  const networkDisplay = str("networkDisplay", "");
  const datafeedShort = str("datafeedShort", "");
  const sourceLabel = str("sourceLabel", "");
  const errorMsg = str("errorMsg", "");
  const isRequesting = bool("isRequesting");
  const freshness = (val<Freshness>("freshness", "idle") ?? "idle") as Freshness;
  const freshnessLabel = str("freshnessLabel", t("priceStatusReady"));
  const pairs = val<string[]>("availablePairs", ["NEO", "GAS", "BTC"]) ?? [
    "NEO",
    "GAS",
    "BTC",
  ];

  const canFetchPrice = Boolean(asset);
  const assetInitial = asset.slice(0, 1);
  const displayPair = `${asset}/USD`;
  const priceLoaded = freshness !== "idle";
  const isStale = freshness === "stale";
  const assetOptions = pairs.map((symbol) => ({ value: symbol, label: symbol }));

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
            <strong>{datafeedShort || "—"}</strong>
          </div>
          <div className="price-metric">
            <span>{t("priceMetricNetwork")}</span>
            <strong>{networkDisplay || "—"}</strong>
          </div>
          <div className="price-metric">
            <span>{t("priceMetricSource")}</span>
            <strong>{sourceLabel || "—"}</strong>
          </div>
        </div>
      </section>

      <section className="price-balance-card" aria-label={t("latestPrice")}>
        <div className={`asset-token asset-token--${asset.toLowerCase()}`}>
          {assetInitial}
        </div>
        <div className="price-balance-card__content">
          <span className="result-symbol">{displayPair}</span>
          <span className={`result-price${priceLoaded ? "" : " result-price--empty"}`}>
            {priceLoaded ? priceDisplay : "—"}
          </span>
        </div>
        <span
          className={`price-status${priceLoaded ? " price-status--live" : ""}`}
          data-freshness={freshness}
          aria-label={t("priceSignalTitle")}
        >
          <i className="price-status__dot" aria-hidden="true" />
          {freshnessLabel}
        </span>
      </section>

      {isStale && (
        <div className="price-stale-note" role="status">
          {t("priceStaleHint")}
        </div>
      )}

      <NeoCard
        variant="erobo"
        className="price-action-panel"
        title={t("priceActionTitle")}
      >
        <div className="price-hint">{t("priceActionHint")}</div>
        <div className="stack">
          <NeoSelect
            value={asset}
            label={t("asset")}
            options={assetOptions}
            onChange={(value) => dispatch("updateAsset", value)}
          />
          <NeoButton
            variant="primary"
            loading={isRequesting}
            disabled={!canFetchPrice || isRequesting}
            aria-label={t("fetchPrice")}
            onClick={() => dispatch("fetchPrice")}
          >
            {t("fetchPrice")}
          </NeoButton>
        </div>
      </NeoCard>

      {errorMsg && <div className="error-banner mono">{errorMsg}</div>}
    </div>
  );
}
