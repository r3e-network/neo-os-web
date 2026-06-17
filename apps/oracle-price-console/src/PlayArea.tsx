/**
 * PlayArea.tsx -- Oracle Price Console (on-chain MorpheusDataFeed reader)
 *
 * Uses state: asset, priceDisplay, freshness, freshnessLabel, availablePairs,
 * networkDisplay, datafeedShort, sourceLabel, isRequesting, errorMsg.
 * Actions: fetchPrice, updateAsset.
 */

import { useState } from "react";
import { NeoButton, NeoCard, NeoSelect } from "@shared/components-react";
import { StateView } from "@shared/components";
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
  const [feedCopied, setFeedCopied] = useState(false);

  const asset = str("asset", "NEO");
  const priceDisplay = str("priceDisplay", t("notAvailable"));
  const networkDisplay = str("networkDisplay", "");
  const datafeedShort = str("datafeedShort", "");
  const datafeedHash = str("datafeedHash", "");
  const sourceLabel = str("sourceLabel", "");

  // Copy the full feed contract hash so the "inspectable" identifier the console
  // promises is actually retrievable, not just truncated to "0x03013f49…". Uses
  // the platform clipboard API directly (the PlayArea has no services handle)
  // with a brief "Copied" confirmation; failure leaves the label unchanged.
  const copyFeedHash = async () => {
    if (!datafeedHash) return;
    try {
      await navigator.clipboard?.writeText(datafeedHash);
      setFeedCopied(true);
      window.setTimeout(() => setFeedCopied(false), 1600);
    } catch {
      // Clipboard blocked (insecure context / denied permission): keep the
      // hash visible via the title tooltip rather than surfacing a failure.
    }
  };
  const errorMsg = str("errorMsg", "");
  const isRequesting = bool("isRequesting");
  const freshness = (val<Freshness>("freshness", "idle") ?? "idle") as Freshness;
  const freshnessLabel = str("freshnessLabel", t("priceStatusReady"));
  // Absolute on-chain write time of the displayed price (local-formatted). Empty
  // when the feed omitted a timestamp; surfaced as a tooltip + caption so a user
  // can independently verify freshness against the chain, not just "x ago".
  const freshnessTimestamp = str("freshnessTimestamp", "");
  const onChainTimeLabel = freshnessTimestamp
    ? t("priceOnChainTime", { time: freshnessTimestamp })
    : "";
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
          <button
            type="button"
            className="price-metric price-metric--copy"
            onClick={copyFeedHash}
            disabled={!datafeedHash}
            title={datafeedHash || undefined}
            aria-label={t("copyFeedHash")}
          >
            <span>{t("priceMetricFeed")}</span>
            <span className="price-metric__value">
              <strong>{datafeedShort || "—"}</strong>
              <span className="price-metric__copy-cue" aria-hidden="true">
                {feedCopied ? (
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none">
                    <path
                      d="M5 12.5 10 17.5 19 7"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none">
                    <rect x="9" y="9" width="11" height="11" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
                    <path
                      d="M5 15V6.5A1.5 1.5 0 0 1 6.5 5H15"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                  </svg>
                )}
              </span>
            </span>
          </button>
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

      {isRequesting ? (
        <StateView
          kind="loading"
          icon={null}
          title={t("loading")}
          className="price-balance-state"
        />
      ) : priceLoaded ? (
        <section className="price-balance-card" aria-label={t("latestPrice")}>
          <div className={`asset-token asset-token--${asset.toLowerCase()}`}>
            {assetInitial}
          </div>
          <div className="price-balance-card__content">
            <span className="result-symbol">{displayPair}</span>
            <span className="result-price">{priceDisplay}</span>
          </div>
          <span
            className="price-status price-status--live"
            data-freshness={freshness}
            aria-label={t("priceSignalTitle")}
            title={onChainTimeLabel || undefined}
          >
            <i className="price-status__dot" aria-hidden="true" />
            {freshnessLabel}
          </span>
        </section>
      ) : (
        <StateView
          kind="empty"
          icon={null}
          title={t("priceSignalIdle")}
          hint={t("priceStatusReady")}
          className="price-balance-state"
        />
      )}

      {onChainTimeLabel && (
        <div className="price-onchain-time" role="note">
          {onChainTimeLabel}
        </div>
      )}

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
