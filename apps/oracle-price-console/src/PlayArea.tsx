/**
 * PlayArea.tsx -- Oracle Price Console (on-chain MorpheusDataFeed reader)
 *
 * Uses state: asset, priceDisplay, freshness, freshnessLabel, availablePairs,
 * networkDisplay, datafeedShort, sourceLabel, isRequesting, errorMsg.
 * Actions: fetchPrice, updateAsset.
 */

import { useState } from "react";
import { Activity, Check, Copy, DatabaseZap, RefreshCw } from "lucide-react";
import { NeoButton, NeoCard } from "@shared/components-react";
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
  const selectedAssetHint = assetHintKey(asset);
  const featuredPairs = ["NEO", "GAS", "BTC"].filter((symbol) =>
    pairs.includes(symbol),
  );
  const catalogPairs = pairs.filter((symbol) => !featuredPairs.includes(symbol));

  return (
    <div className="price-play-area">
      <section className="price-hero" aria-label={t("priceHeroTitle")}>
        <div className="price-hero__copy">
          <span className="price-hero__badge" aria-hidden="true">
            <Activity size={22} />
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
                  <Check size={14} />
                ) : (
                  <Copy size={14} />
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

      <div className="price-console-body">
        <div className="price-result-col">
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
              hint={t("priceSignalIdleHint")}
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

          {/* Request path is always visible — it backs the "inspectable" promise
              up front, before any fetch, and keeps the resting viewport useful. */}
          <section className="price-reference" aria-label={t("priceReferenceTitle")}>
            <span className="price-reference__title">{t("priceReferenceTitle")}</span>
            <dl className="price-reference__rows">
              <div className="price-reference__row">
                <dt>{t("priceReferenceContract")}</dt>
                <dd className="price-reference__mono" title={datafeedHash || undefined}>
                  {datafeedShort || "—"}
                </dd>
              </div>
              <div className="price-reference__row">
                <dt>{t("priceReferenceMethod")}</dt>
                <dd className="price-reference__mono">{t("priceReferenceMethodValue")}</dd>
              </div>
              <div className="price-reference__row">
                <dt>{t("priceReferenceQuote")}</dt>
                <dd>{t("priceReferenceQuoteValue")}</dd>
              </div>
            </dl>
          </section>
        </div>

        <NeoCard
          variant="erobo"
          className="price-action-panel"
          title={t("priceActionTitle")}
        >
          <div className="price-oracle-station">
            <span className="price-oracle-station__icon" aria-hidden="true">
              <DatabaseZap size={20} />
            </span>
            <div className="price-oracle-station__copy">
              <span>{t("oracleStationEyebrow")}</span>
              <strong>{t("oracleStationTitle", { pair: displayPair })}</strong>
              <small>{t("priceActionHint")}</small>
            </div>
          </div>

          <section className="price-pair-picker" aria-label={t("asset")}>
            <div className="price-pair-picker__head">
              <span>{t("pairPickerTitle")}</span>
              <strong>{t("pairPickerSubtitle", { pair: displayPair })}</strong>
            </div>
            <div className="price-pair-options" role="radiogroup" aria-label={t("asset")}>
              <div className="price-pair-grid">
                {featuredPairs.map((symbol) => (
                  <PricePairButton
                    key={symbol}
                    symbol={symbol}
                    selected={asset === symbol}
                    t={t}
                    onSelect={() => void dispatch("updateAsset", symbol)}
                  />
                ))}
              </div>
              {catalogPairs.length > 0 && (
                <div className="price-catalog-dock">
                  <div className="price-catalog-dock__head">
                    <span>{t("pairCatalogTitle")}</span>
                    <strong>{t("pairCatalogCount", { count: catalogPairs.length })}</strong>
                  </div>
                  <div className="price-catalog-chips">
                    {catalogPairs.map((symbol) => (
                      <button
                        key={symbol}
                        type="button"
                        role="radio"
                        aria-checked={asset === symbol}
                        aria-label={`${symbol}/USD`}
                        className={`price-catalog-chip${
                          asset === symbol ? " price-catalog-chip--selected" : ""
                        }`}
                        onClick={() => void dispatch("updateAsset", symbol)}
                      >
                        {symbol}/USD
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>

          <div className="price-station-facts" aria-label={t("priceFlowTitle")}>
            <span>
              <small>{t("stationPair")}</small>
              <strong>{displayPair}</strong>
            </span>
            <span>
              <small>{t("stationMethod")}</small>
              <strong>{t("priceReferenceMethodValue")}</strong>
            </span>
            <span>
              <small>{t("stationFreshness")}</small>
              <strong>{t("stationFreshnessValue")}</strong>
            </span>
          </div>

          <div className="price-query-actions">
            <NeoButton
              variant="primary"
              loading={isRequesting}
              disabled={!canFetchPrice || isRequesting}
              aria-label={t("fetchPair", { pair: displayPair })}
              onClick={() => dispatch("fetchPrice")}
            >
              <RefreshCw size={16} aria-hidden="true" />
              {t("fetchPair", { pair: displayPair })}
            </NeoButton>
          </div>
          <p className="price-selected-note" role="note">
            {t(selectedAssetHint)}
          </p>
          {errorMsg && <div className="error-banner mono">{errorMsg}</div>}
        </NeoCard>
      </div>
    </div>
  );
}

function PricePairButton({
  symbol,
  selected,
  t,
  onSelect,
}: {
  symbol: string;
  selected: boolean;
  t: PlayAreaProps["t"];
  onSelect: () => void;
}) {
  const pair = `${symbol}/USD`;

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={pair}
      className={`price-pair-card${selected ? " price-pair-card--selected" : ""}`}
      onClick={onSelect}
    >
      <span className={`asset-token asset-token--${symbol.toLowerCase()}`}>
        {symbol.slice(0, 1)}
      </span>
      <span className="price-pair-card__copy">
        <strong>{pair}</strong>
        <small>{t(assetHintKey(symbol))}</small>
      </span>
    </button>
  );
}

function assetHintKey(symbol: string) {
  switch (symbol.toUpperCase()) {
    case "NEO":
      return "assetHintNeo";
    case "GAS":
      return "assetHintGas";
    case "BTC":
      return "assetHintBtc";
    default:
      return "assetHintGeneric";
  }
}
