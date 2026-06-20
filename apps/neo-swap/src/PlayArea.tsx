/**
 * PlayArea.tsx -- Neo Swap
 *
 * Host-native NEO/GAS swap console. Quoting is the always-available capability;
 * on-chain settlement depends on a deployed router. When no router exists the
 * screen leads with a single "Live price preview" focus block and folds the full
 * From/To/slippage apparatus behind a disclosure, so the available capability is
 * the focus instead of a wall of disabled signals.
 */

import {
  ArrowDownUp,
  Clock,
  Fuel,
  Network,
  RefreshCw,
  Route,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";
import { NeoButton, NeoCard, NeoInput } from "@shared/components-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import SwapHero from "./components/SwapHero";
import PopularPairs from "./components/PopularPairs";
import TokenIcon from "./components/TokenIcon";
import { POPULAR_PAIRS, SLIPPAGE_PRESET_BPS } from "./hooks/useSwapEngine";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

interface Token {
  symbol: string;
  hash: string;
  balance: number;
  decimals: number;
}

const popularPairs = POPULAR_PAIRS.map((pair) => ({ ...pair }));

const formatBalance = (token: Token | null) =>
  token ? token.balance.toLocaleString(undefined, { maximumFractionDigits: 8 }) : "0";

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool, val } = useStateBindings(state);

  const fromToken = val<Token | null>("fromToken", null);
  const toToken = val<Token | null>("toToken", null);
  const fromAmount = str("fromAmount", "");
  const toAmount = str("toAmount", "");
  const exchangeRate = str("exchangeRate", t("rateUnavailable"));
  const rateLoading = bool("rateLoading");
  const showSelector = bool("showSelector");
  const selectorTarget = str("selectorTarget", "");
  const availableTokens = val<Token[]>("availableTokens", []) ?? [];
  const slippage = str("slippage", "0.5%");
  const slippageValue = val<number>("slippageValue", 50) ?? 50;
  const minReceived = str("minReceived", "");
  // routerAvailable defaults to false: the manifest declares no router, so the
  // honest baseline is "no on-chain route" unless state says otherwise.
  const routerAvailable = state.routerAvailable ? bool("routerAvailable") : false;
  const rateStale = bool("rateStale");
  const rateAsOf = str("rateAsOf", "");
  const walletConnected = state.walletConnected ? bool("walletConnected") : false;

  // A single source of truth for "is there a usable quote loaded right now".
  // Drives the badge, exchange-rate cell, and minimum-received cell so the three
  // signals never contradict each other ("unavailable" vs "pending" vs "0").
  const hasQuote = !!exchangeRate && !rateStale;

  // The route badge must reflect the real settlement path. With no router the
  // swap cannot complete, so the badge says so up front rather than "ready".
  const routeHealth = rateLoading
    ? t("swapRouteSyncing")
    : !routerAvailable
      ? t("swapRouteUnavailable")
      : rateStale
        ? t("rateStale")
        : exchangeRate
          ? t("swapRouteReady")
          : t("swapRouteUnavailable");
  const routeReady = routerAvailable && !rateLoading && !rateStale && !!exchangeRate;

  // De-duplicated no-data wording. The single authoritative "unavailable" message
  // lives in the router notice / preview banner — the rate and min-received cells
  // must NOT echo it. They show the real figure when present, "Loading rate..."
  // while fetching, or a neutral em-dash placeholder otherwise (never a repeated
  // "Quote pending" that competes with the banner).
  const ratePlaceholder = t("balanceDefault");
  const rateDisplay = rateLoading
    ? t("loadingRate")
    : exchangeRate || ratePlaceholder;
  const formattedMinReceived = rateLoading
    ? t("loadingRate")
    : hasQuote && minReceived
      ? minReceived
      : ratePlaceholder;
  // The "1 NEO buys X GAS" line for the live-price-preview focus block: only
  // meaningful once a fresh quote has loaded.
  const previewRateAvailable = hasQuote && !!exchangeRate;

  const selectorTitle = selectorTarget === "to" ? t("to") : t("from");
  const fromSymbol = fromToken?.symbol || t("selectToken");
  const toSymbol = toToken?.symbol || t("selectToken");
  const pairLabel = `${fromSymbol}/${toSymbol}`;
  const receiveEstimate = toAmount || "0.00";
  const routeModeLabel = routerAvailable ? t("routeModeLive") : t("routeModePreview");
  const routeModeBody = routerAvailable ? t("routeModeLiveBody") : t("routeModePreviewBody");
  const routeSource = hasQuote ? t("routeSourceMorpheus") : t("routeSourceAwaiting");

  // Slippage above 1% (100 bps) warrants a gentle warning — the minimum received
  // can come in notably below the quote.
  const slippageHigh = slippageValue > 100;
  // Is the current selection one of the presets, or a custom value?
  const isPresetActive = (bps: number) => slippageValue === bps;
  const isCustomSlippage = !SLIPPAGE_PRESET_BPS.includes(slippageValue);
  const customSlippageDisplay = isCustomSlippage
    ? String(Math.round((slippageValue / 100) * 100) / 100)
    : "";

  // The full trade-setup apparatus (From / To / slippage / quote detail). Rendered
  // inline when a router is live, or tucked inside a disclosure when settlement is
  // unavailable so the price preview stays the focus. Identical markup either way.
  const tradeForm = (
    <div className="neo-swap-trade-workspace">
      <div className="neo-swap-deal-ticket" aria-label={t("tradeTicket")}>
        <section className="neo-swap-asset-card neo-swap-asset-card--pay">
          <div className="neo-swap-asset-card__top">
            <span className="neo-swap-asset-card__label">{t("payWith")}</span>
            <span className="neo-swap-balance-line">
              {t("balance")}: {formatBalance(fromToken)}
            </span>
          </div>
          <div className="neo-swap-asset-card__body">
            <button
              type="button"
              className="neo-swap-token-button"
              onClick={() => dispatch("openFromSelector")}
            >
              <TokenIcon symbol={fromSymbol} />
              <span>{fromSymbol}</span>
            </button>
            <div className="neo-swap-amount-shell">
              <NeoInput
                className="neo-swap-amount-input"
                value={fromAmount}
                type="number"
                min={0}
                placeholder={t("enterAmount")}
                aria-label={t("payAmountLabel")}
                onChange={(value) => { void dispatch("setFromAmount", value); }}
              />
              <NeoButton size="sm" variant="secondary" onClick={() => dispatch("setMaxAmount")}>
                {t("max")}
              </NeoButton>
            </div>
          </div>
        </section>

        <div className="neo-swap-direction">
          <NeoButton
            size="sm"
            variant="ghost"
            aria-label={t("switchTokens")}
            onClick={() => dispatch("swapTokens")}
          >
            <ArrowDownUp size={18} aria-hidden="true" />
          </NeoButton>
        </div>

        <section className="neo-swap-asset-card neo-swap-asset-card--receive">
          <div className="neo-swap-asset-card__top">
            <span className="neo-swap-asset-card__label">{t("receiveEstimated")}</span>
            <span className="neo-swap-balance-line">
              {t("balance")}: {formatBalance(toToken)}
            </span>
          </div>
          <div className="neo-swap-asset-card__body">
            <button
              type="button"
              className="neo-swap-token-button"
              onClick={() => dispatch("openToSelector")}
            >
              <TokenIcon symbol={toSymbol} />
              <span>{toSymbol}</span>
            </button>
            <div className="neo-swap-receive-amount" aria-live="polite">
              {receiveEstimate}
            </div>
          </div>
        </section>
      </div>

      <div className="neo-swap-quote-metrics" aria-label={t("quoteSummary")}>
        <div>
          <span><TrendingUp size={14} aria-hidden="true" />{t("exchangeRate")}</span>
          <strong>{rateDisplay}</strong>
        </div>
        <div>
          <span><ShieldCheck size={14} aria-hidden="true" />{t("minReceived")}</span>
          <strong>{formattedMinReceived}</strong>
        </div>
        <div>
          <span><SlidersHorizontal size={14} aria-hidden="true" />{t("slippage")}</span>
          <strong>{slippage}</strong>
        </div>
      </div>

      <div className="neo-swap-control-dock" role="group" aria-label={t("slippage")}>
        <div className="neo-swap-control-dock__copy">
          <span className="neo-swap-control-dock__label">{t("slippageControl")}</span>
          <p className={`neo-swap-slippage__hint${slippageHigh ? " is-warn" : ""}`}>
            {slippageHigh ? t("slippageHigh") : t("slippageHint")}
          </p>
        </div>
        <div className="neo-swap-slippage__controls">
          {SLIPPAGE_PRESET_BPS.map((bps) => {
            const pct = `${parseFloat((bps / 100).toFixed(2))}%`;
            return (
              <button
                key={bps}
                type="button"
                className={`neo-swap-chip${isPresetActive(bps) ? " is-active" : ""}`}
                aria-pressed={isPresetActive(bps)}
                aria-label={t("slippagePreset", { pct })}
                onClick={() => dispatch("setSlippage", bps / 100)}
              >
                {pct}
              </button>
            );
          })}
          <div className={`neo-swap-chip-custom${isCustomSlippage ? " is-active" : ""}`}>
            <NeoInput
              className="neo-swap-slippage-input"
              type="number"
              min={0.01}
              max={50}
              step={0.1}
              value={customSlippageDisplay}
              placeholder={t("slippageCustom")}
              aria-label={t("slippageCustomLabel")}
              onChange={(value) => { void dispatch("setSlippage", value); }}
            />
            <span aria-hidden="true">%</span>
          </div>
        </div>
      </div>

      <section className="neo-swap-route-review" aria-label={t("routeReview")}>
        <div className="neo-swap-route-review__head">
          <span className="neo-swap-route-review__icon" aria-hidden="true">
            <Route size={20} />
          </span>
          <div>
            <span>{t("routeReview")}</span>
            <strong>{routeModeLabel}</strong>
            <p>{routeModeBody}</p>
          </div>
        </div>

        <ol className="neo-swap-route-steps">
          <li>
            <span aria-hidden="true">1</span>
            <div>
              <strong>{t("routeStepQuote")}</strong>
              <small>{routeSource}</small>
            </div>
          </li>
          <li>
            <span aria-hidden="true">2</span>
            <div>
              <strong>{t("routeStepPair")}</strong>
              <small>{t("routeDirectValue", { pair: pairLabel })}</small>
            </div>
          </li>
          <li>
            <span aria-hidden="true">3</span>
            <div>
              <strong>{t("routeStepWallet")}</strong>
              <small>{t("pricePreviewOnly")}</small>
            </div>
          </li>
        </ol>

        <dl className="neo-swap-route-facts">
          <div>
            <dt><Network size={14} aria-hidden="true" />{t("networkLabel")}</dt>
            <dd>{t("tokenNeo")} N3</dd>
          </div>
          <div>
            <dt><Clock size={14} aria-hidden="true" />{t("estSettlement")}</dt>
            <dd>{t("estSettlementValue")}</dd>
          </div>
          <div>
            <dt><Fuel size={14} aria-hidden="true" />{t("networkFeeLabel")}</dt>
            <dd>{t("networkFeeValue")}</dd>
          </div>
        </dl>
      </section>
    </div>
  );

  return (
    <div className="neo-swap-play-area">
      <section className="neo-swap-hero-panel" aria-label={t("title")}>
        <SwapHero
          t={t}
          fromSymbol={fromSymbol}
          toSymbol={toSymbol}
          rateDisplay={rateDisplay}
          routeHealth={routeHealth}
          rateAsOf={rateAsOf}
          rateStale={rateStale}
        />
      </section>

      <div className="neo-swap-main-grid">
        <section className="neo-swap-swap-card" aria-label={t("tradeTicket")}>
          <div className="neo-swap-section-header">
            <div>
              <span>{t("tabSwap")}</span>
              <strong>{fromSymbol} {t("swapArrow")} {toSymbol}</strong>
            </div>
            <span
              className={`neo-swap-route-badge${routeReady ? " is-ready" : ""}`}
              aria-label={t("swapRouteStatus")}
            >
              {routeHealth}
            </span>
          </div>

          {!walletConnected && (
            <div className="neo-swap-intro" role="status">
              <div className="neo-swap-intro__lead">
                <span className="neo-swap-intro__badge" aria-hidden="true">
                  <Wallet size={18} />
                </span>
                <div>
                  <strong className="neo-swap-intro__title">{t("introHeading")}</strong>
                  <p className="neo-swap-intro__body">{t("introBody")}</p>
                </div>
              </div>
              <ul className="neo-swap-intro__steps">
                <li>
                  <TrendingUp size={16} aria-hidden="true" />
                  <div>
                    <strong>{t("introStepRate")}</strong>
                    <span>{t("introStepRateBody")}</span>
                  </div>
                </li>
                <li>
                  <SlidersHorizontal size={16} aria-hidden="true" />
                  <div>
                    <strong>{t("introStepSlippage")}</strong>
                    <span>{t("introStepSlippageBody")}</span>
                  </div>
                </li>
                <li>
                  <ShieldCheck size={16} aria-hidden="true" />
                  <div>
                    <strong>{t("introStepSettle")}</strong>
                    <span>{t("introStepSettleBody")}</span>
                  </div>
                </li>
              </ul>
              <NeoButton
                variant="primary"
                block
                onClick={() => dispatch("connectWallet")}
              >
                <Wallet size={16} aria-hidden="true" />
                {t("connectToPreview")}
              </NeoButton>
            </div>
          )}

          {!routerAvailable && (
            <div className="neo-swap-preview" role="region" aria-label={t("pricePreviewTitle")}>
              <div className="neo-swap-preview__head">
                <span className="neo-swap-preview__eyebrow">
                  <Sparkles size={14} aria-hidden="true" />
                  {t("pricePreviewTitle")}
                </span>
                <span className="neo-swap-preview__meta">
                  <span className="neo-swap-preview__mode">{routeModeLabel}</span>
                  {rateAsOf && (
                    <span className={`neo-swap-preview__asof${rateStale ? " is-stale" : ""}`}>
                      {rateStale ? t("rateStale") : t("rateAsOf", { time: rateAsOf })}
                    </span>
                  )}
                </span>
              </div>
              {rateLoading ? (
                <strong className="neo-swap-preview__rate is-muted">{t("loadingRate")}</strong>
              ) : previewRateAvailable ? (
                <strong className="neo-swap-preview__rate">
                  <span className="neo-swap-preview__rate-lead">
                    {t("pricePreviewRate", { from: fromSymbol })}
                  </span>
                  <span className="neo-swap-preview__rate-figure">
                    {exchangeRate} {toSymbol}
                  </span>
                </strong>
              ) : (
                <strong className="neo-swap-preview__rate is-muted">
                  {t("pricePreviewAwaiting")}
                </strong>
              )}
              <p className="neo-swap-preview__body">{t("pricePreviewBody")}</p>
              <NeoButton
                className="neo-swap-preview__refresh"
                variant={walletConnected ? "primary" : "secondary"}
                block
                loading={rateLoading}
                onClick={() => dispatch("refreshRate")}
              >
                <RefreshCw size={16} aria-hidden="true" />
                {t("refreshRate")}
              </NeoButton>
            </div>
          )}

          {routerAvailable ? (
            <>
              {tradeForm}

              {rateAsOf && (
                <p className={`neo-swap-rate-asof${rateStale ? " is-stale" : ""}`}>
                  {rateStale
                    ? t("rateSourceStaleAsOf", { time: rateAsOf })
                    : t("rateSourceAsOf", { time: rateAsOf })}
                </p>
              )}

              <p className="neo-swap-preview-note">{t("pricePreviewOnly")}</p>

              <NeoButton
                variant="primary"
                block
                loading={bool("isSwapping") || bool("loading")}
                disabled={!bool("canSwap")}
                onClick={() => dispatch("executeSwap")}
              >
                {bool("isSwapping") ? t("swapping") : str("swapButtonText", t("tabSwap"))}
              </NeoButton>
            </>
          ) : (
            <details className="neo-swap-disclosure">
              <summary className="neo-swap-disclosure__summary">
                <SlidersHorizontal size={15} aria-hidden="true" />
                {t("setupTradeSummary")}
              </summary>
              <div className="neo-swap-disclosure__body">
                {tradeForm}
                <p className="neo-swap-preview-note">{t("pricePreviewOnly")}</p>
                <NeoButton variant="secondary" block disabled>
                  {t("settlementUnavailable")}
                </NeoButton>
              </div>
            </details>
          )}
        </section>

        <aside className="neo-swap-side-stack" aria-label={t("tabPool")}>
          <PopularPairs
            t={t}
            selectedPair={
              fromToken && toToken
                ? `${fromToken.symbol.toLowerCase()}-${toToken.symbol.toLowerCase()}`
                : ""
            }
            popularPairs={popularPairs}
            routeHealth={routeHealth}
            dispatch={dispatch}
          />
        </aside>
      </div>

      {showSelector && (
        <div className="neo-swap-token-modal" role="dialog" aria-modal="true">
          <NeoCard variant="erobo" className="neo-swap-token-modal-card">
            <div className="neo-swap-section-header">
              <div>
                <span>{selectorTitle}</span>
                <strong>{t("selectToken")}</strong>
              </div>
              <NeoButton
                size="sm"
                variant="ghost"
                aria-label={t("dismiss")}
                onClick={() => dispatch("closeSelector")}
              >
                <X size={17} aria-hidden="true" />
              </NeoButton>
            </div>
            <div className="neo-swap-token-list">
              {availableTokens.map((token) => (
                <button
                  key={token.hash}
                  type="button"
                  className="neo-swap-token-option"
                  onClick={() => dispatch("selectToken", token as unknown)}
                >
                  <TokenIcon symbol={token.symbol} />
                  <strong>{token.symbol}</strong>
                  <small>{t("balance")}: {formatBalance(token)}</small>
                </button>
              ))}
            </div>
          </NeoCard>
        </div>
      )}
    </div>
  );
}
