/**
 * PlayArea.tsx -- Oracle Price Console (on-chain MorpheusDataFeed reader)
 *
 * Uses state: asset, priceDisplay, freshness, freshnessLabel, availablePairs,
 * networkDisplay, datafeedShort, sourceLabel, isRequesting, errorMsg.
 * Actions: fetchPrice, updateAsset.
 */

import { useState } from "react";
import { Activity, Check, Copy, DatabaseZap, RefreshCw } from "lucide-react";
import { NeoButton } from "@shared/components-react";
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
  const errorMsg = str("errorMsg", "");
  const isRequesting = bool("isRequesting");
  const freshness = (val<Freshness>("freshness", "idle") ?? "idle") as Freshness;
  const freshnessLabel = str("freshnessLabel", t("priceStatusReady"));
  const freshnessTimestamp = str("freshnessTimestamp", "");
  const onChainTimeLabel = freshnessTimestamp
    ? t("priceOnChainTime", { time: freshnessTimestamp })
    : "";
  const pairs = val<string[]>("availablePairs", ["NEO", "GAS", "BTC"]) ?? [
    "NEO",
    "GAS",
    "BTC",
  ];

  const copyFeedHash = async () => {
    if (!datafeedHash) return;
    try {
      await navigator.clipboard?.writeText(datafeedHash);
      setFeedCopied(true);
      window.setTimeout(() => setFeedCopied(false), 1600);
    } catch {
      // Keep the full hash inspectable via the title tooltip when clipboard is blocked.
    }
  };

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
  const boardState = isRequesting ? "loading" : priceLoaded ? freshness : "idle";
  const routeState = errorMsg ? "warn" : boardState;
  const routeNodes = [
    {
      key: "source",
      icon: <DatabaseZap size={18} aria-hidden="true" />,
      label: t("priceRouteSource"),
      value: sourceLabel || t("priceRouteSourceFallback"),
    },
    {
      key: "freshness",
      icon: <Activity size={18} aria-hidden="true" />,
      label: t("priceRouteFreshness"),
      value: isRequesting
        ? t("priceRouteReading")
        : priceLoaded
          ? freshnessLabel
          : t("priceRouteQueued"),
    },
    {
      key: "feed",
      icon: <Check size={18} aria-hidden="true" />,
      label: t("priceRouteFeed"),
      value: datafeedShort || t("priceRouteFeedPending"),
    },
  ];

  return (
    <div className="price-play-area">
      <section className="price-hero" aria-label={t("priceHeroTitle")}>
        <img
          className="price-hero__media"
          src="./oracle-market-stage.jpg"
          alt=""
          loading="eager"
          decoding="async"
        />
        <div className="price-hero__shade" aria-hidden="true" />

        <div className="price-hero__copy">
          <span className="price-hero__badge" aria-hidden="true">
            <Activity size={22} />
          </span>
          <span className="price-eyebrow price-eyebrow-badge">{t("priceHeroTitle")}</span>
          <h2>{displayPair}</h2>
          <p>{t("priceHeroSubtitle")}</p>
          <div className="price-hero__status-row" aria-label={t("priceSignalTitle")}>
            <span
              className={`price-status price-status-pill price-status--${boardState}`}
              data-freshness={freshness}
            >
              <i className="price-status__dot" aria-hidden="true" />
              {freshnessLabel}
            </span>
            <span className="price-hero__timestamp-pill">
              {onChainTimeLabel || t("feedTimePending")}
            </span>
          </div>
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
              <strong>{datafeedShort || "-"}</strong>
              <span className="price-metric__copy-cue" aria-hidden="true">
                {feedCopied ? <Check size={14} /> : <Copy size={14} />}
              </span>
            </span>
          </button>
          <div className="price-metric">
            <span>{t("priceMetricNetwork")}</span>
            <strong>{networkDisplay || "-"}</strong>
          </div>
          <div className="price-metric">
            <span>{t("priceMetricSource")}</span>
            <strong>{sourceLabel || "-"}</strong>
          </div>
        </div>
      </section>

      <div className="price-console-body">
        <section
          className={`price-market-board price-market-board--${boardState}`}
          aria-label={t("latestPrice")}
        >
          <div className="price-market-board__head">
            <div>
              <span>{t("marketBoardTitle")}</span>
              <strong>{t("marketBoardHint", { pair: displayPair })}</strong>
            </div>
            <span className={`asset-token asset-token--${asset.toLowerCase()}`}>
              {assetInitial}
            </span>
          </div>

          {isRequesting ? (
            <div className="price-market-state" role="status">
              <span className="price-market-state__spinner" aria-hidden="true" />
              <strong>{t("loading")}</strong>
              <small>{t("priceSignalIdleHint")}</small>
            </div>
          ) : priceLoaded ? (
            <div className="price-market-board__price">
              <span>{displayPair}</span>
              <strong>{priceDisplay}</strong>
              <small>{selectedAssetHint ? t(selectedAssetHint) : ""}</small>
            </div>
          ) : (
            <div className="price-market-state">
              <span className="price-market-state__icon" aria-hidden="true">
                <DatabaseZap size={20} />
              </span>
              <strong>{t("priceSignalIdle")}</strong>
              <small>{t("priceSignalIdleHint")}</small>
            </div>
          )}

          {isStale && (
            <div className="price-stale-note" role="status">
              {t("priceStaleHint")}
            </div>
          )}

          <div className="price-signal-strip" aria-label={t("priceFlowTitle")}>
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
              <strong>{priceLoaded ? freshnessLabel : t("stationFreshnessValue")}</strong>
            </span>
          </div>
        </section>

        <section
          className={`price-oracle-route price-oracle-route--${routeState}`}
          aria-label={t("priceRouteTitle")}
          aria-busy={isRequesting || undefined}
        >
          <div className="price-oracle-route__head">
            <div>
              <span>{t("priceRouteEyebrow")}</span>
              <strong>{t("priceRouteTitle")}</strong>
            </div>
            <small>{t("priceRouteHint")}</small>
          </div>
          <div className="price-oracle-route__path">
            <span className="price-oracle-route__packet" aria-hidden="true" />
            {routeNodes.map((node) => (
              <div
                key={node.key}
                className={`price-oracle-node price-oracle-node--${node.key}`}
              >
                <span className="price-oracle-node__icon">{node.icon}</span>
                <span className="price-oracle-node__copy">
                  <small>{node.label}</small>
                  <strong>{node.value}</strong>
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="price-action-panel" aria-label={t("priceActionTitle")}>
          <div className="price-action-panel__head">
            <span className="price-action-panel__icon" aria-hidden="true">
              <DatabaseZap size={20} />
            </span>
            <div>
              <span>{t("oracleStationEyebrow")}</span>
              <strong>{t("oracleStationTitle", { pair: displayPair })}</strong>
              <small>{t("priceActionHint")}</small>
            </div>
          </div>

          <section className="price-pair-picker" aria-label={t("asset")}>
            <div className="price-pair-picker__head">
              <span>{t("watchlistTitle")}</span>
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

          <div className="price-query-actions">
            <NeoButton
              variant="primary"
              disabled={!canFetchPrice || isRequesting}
              aria-label={t(isRequesting ? "readingPair" : "fetchPair", {
                pair: displayPair,
              })}
              onClick={() => dispatch("fetchPrice")}
            >
              {isRequesting ? (
                <span className="price-query-spinner" aria-hidden="true" />
              ) : (
                <RefreshCw size={16} aria-hidden="true" />
              )}
              {t(isRequesting ? "readingPair" : "fetchPair", { pair: displayPair })}
            </NeoButton>
          </div>

          <p className="price-selected-note" role="note">
            {t(selectedAssetHint)}
          </p>
          {errorMsg && <div className="error-banner mono">{errorMsg}</div>}
        </section>
      </div>

      <section className="price-reference" aria-label={t("priceReferenceTitle")}>
        <div className="price-reference__intro">
          <span>{t("requestPackage")}</span>
          <strong>{t("priceReferenceTitle")}</strong>
        </div>
        <dl className="price-reference__rows">
          <div className="price-reference__row">
            <dt>{t("priceReferenceContract")}</dt>
            <dd className="price-reference__mono" title={datafeedHash || undefined}>
              {datafeedShort || "-"}
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
      <span className="price-pair-card__cue">
        {selected ? t("pairSelected") : t("pairTapToRead")}
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
