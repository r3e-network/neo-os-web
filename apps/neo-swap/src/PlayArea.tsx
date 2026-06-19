/**
 * PlayArea.tsx -- Neo Swap
 *
 * Host-native NEO/GAS swap console. The swap form is the single primary
 * focal card; quote detail (rate / slippage / min received) appears once,
 * with popular pairs as a slim secondary column.
 */

import {
  ArrowDownUp,
  Clock,
  Fuel,
  Network,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";
import { NeoButton, NeoCard, NeoInput } from "@shared/components-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import SwapHero from "./components/SwapHero";
import PopularPairs from "./components/PopularPairs";
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
  const loading = bool("loading");
  const showSelector = bool("showSelector");
  const selectorTarget = str("selectorTarget", "");
  const isSwapping = bool("isSwapping");
  const availableTokens = val<Token[]>("availableTokens", []) ?? [];
  const canSwap = bool("canSwap");
  const swapButtonText = str("swapButtonText", t("tabSwap"));
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

  // Unified no-data wording: while loading say "Loading rate..." everywhere;
  // otherwise show the quote, or a single consistent "Quote pending" placeholder
  // when no quote is loaded — matching the route badge exactly.
  const quotePending = t("swapRouteUnavailable");
  const rateDisplay = rateLoading
    ? t("loadingRate")
    : exchangeRate || quotePending;
  const formattedMinReceived = rateLoading
    ? t("loadingRate")
    : hasQuote && minReceived
      ? minReceived
      : quotePending;
  const selectorTitle = selectorTarget === "to" ? t("to") : t("from");
  const fromSymbol = fromToken?.symbol || t("selectToken");
  const toSymbol = toToken?.symbol || t("selectToken");
  const pairLabel = `${fromSymbol}/${toSymbol}`;

  // Slippage above 1% (100 bps) warrants a gentle warning — the minimum received
  // can come in notably below the quote.
  const slippageHigh = slippageValue > 100;
  // Is the current selection one of the presets, or a custom value?
  const isPresetActive = (bps: number) => slippageValue === bps;
  const isCustomSlippage = !SLIPPAGE_PRESET_BPS.includes(slippageValue);
  const customSlippageDisplay = isCustomSlippage
    ? String(Math.round((slippageValue / 100) * 100) / 100)
    : "";

  return (
    <div className="neo-swap-play-area">
      <section className="neo-swap-hero-panel" aria-label={t("title")}>
        <SwapHero
          t={t}
          fromSymbol={fromSymbol}
          toSymbol={toSymbol}
        />
      </section>

      <div className="neo-swap-main-grid">
        <NeoCard variant="erobo" className="neo-swap-swap-card">
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
            <div className="neo-swap-router-notice" role="status">
              <span className="neo-swap-router-notice__title">{t("swapRouterUnavailable")}</span>
              <span>{t("swapRouterUnavailableHint")}</span>
            </div>
          )}

          <div className="neo-swap-token-field">
            <div className="neo-swap-token-header">
              <span>{t("from")}</span>
              <button
                type="button"
                className="neo-swap-token-button"
                onClick={() => dispatch("openFromSelector")}
              >
                <span>{fromSymbol.slice(0, 1)}</span>
                {fromSymbol}
              </button>
            </div>
            <div className="neo-swap-input-row">
              <NeoInput
                className="neo-swap-amount-input"
                value={fromAmount}
                type="number"
                min={0}
                placeholder={t("enterAmount")}
                onChange={(val) => { void dispatch("setFromAmount", val); }}
              />
              <NeoButton size="sm" variant="secondary" onClick={() => dispatch("setMaxAmount")}>
                {t("max")}
              </NeoButton>
            </div>
            <span className="neo-swap-balance-line">
              {t("balance")}: {formatBalance(fromToken)}
            </span>
          </div>

          <div className="neo-swap-direction">
            <NeoButton
              size="sm"
              variant="ghost"
              aria-label={t("switchTokens")}
              onClick={() => dispatch("swapTokens")}
            >
              <ArrowDownUp size={17} aria-hidden="true" />
            </NeoButton>
          </div>

          <div className="neo-swap-token-field neo-swap-token-field--receive">
            <div className="neo-swap-token-header">
              <span>{t("to")}</span>
              <button
                type="button"
                className="neo-swap-token-button"
                onClick={() => dispatch("openToSelector")}
              >
                <span>{toSymbol.slice(0, 1)}</span>
                {toSymbol}
              </button>
            </div>
            <NeoInput
              className="neo-swap-amount-input"
              value={toAmount}
              type="number"
              placeholder="0.00"
              disabled
            />
            <span className="neo-swap-balance-line">
              {t("balance")}: {formatBalance(toToken)}
            </span>
          </div>

          <div className="neo-swap-slippage" role="group" aria-label={t("slippage")}>
            <div className="neo-swap-slippage__head">
              <span className="neo-swap-slippage__label">{t("slippage")}</span>
              <strong className="neo-swap-slippage__value">{slippage}</strong>
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
            <p className={`neo-swap-slippage__hint${slippageHigh ? " is-warn" : ""}`}>
              {slippageHigh ? t("slippageHigh") : t("slippageHint")}
            </p>
          </div>

          <div className="neo-swap-detail-panel">
            <div>
              <span>{t("exchangeRate")}</span>
              <strong>{rateDisplay}</strong>
            </div>
            <div>
              <span>{t("minReceived")}</span>
              <strong>{formattedMinReceived}</strong>
            </div>
          </div>

          <dl className="neo-swap-tx-details">
            <div>
              <dt><Network size={14} aria-hidden="true" />{t("networkLabel")}</dt>
              <dd>{t("tokenNeo")} N3</dd>
            </div>
            <div>
              <dt><RefreshCw size={14} aria-hidden="true" />{t("routeLabel")}</dt>
              <dd>{t("routeDirectValue", { pair: pairLabel })}</dd>
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

          {rateAsOf && (
            <p className={`neo-swap-rate-asof${rateStale ? " is-stale" : ""}`}>
              {rateStale
                ? t("rateSourceStaleAsOf", { time: rateAsOf })
                : t("rateSourceAsOf", { time: rateAsOf })}
            </p>
          )}

          <p className="neo-swap-preview-note">{t("pricePreviewOnly")}</p>

          {routerAvailable ? (
            <NeoButton
              variant="primary"
              block
              loading={isSwapping || loading}
              disabled={!canSwap}
              onClick={() => dispatch("executeSwap")}
            >
              {isSwapping ? t("swapping") : swapButtonText}
            </NeoButton>
          ) : (
            <>
              {/* No router deployed: the real deliverable is the quote, so the
                  refresh control is the primary CTA — unless the wallet is
                  disconnected, where the intro panel's Connect is the single
                  primary and refresh steps down to secondary. The Swap action is
                  a plainly labeled "Settlement unavailable" disabled state
                  rather than a teasing primary button. */}
              <NeoButton
                variant={walletConnected ? "primary" : "secondary"}
                block
                loading={rateLoading}
                onClick={() => dispatch("refreshRate")}
              >
                <RefreshCw size={16} aria-hidden="true" />
                {t("refreshRate")}
              </NeoButton>
              <NeoButton variant="secondary" block disabled>
                {t("settlementUnavailable")}
              </NeoButton>
            </>
          )}
        </NeoCard>

        <aside className="neo-swap-side-stack" aria-label={t("tabPool")}>
          <PopularPairs
            t={t}
            selectedPair={
              fromToken && toToken
                ? `${fromToken.symbol.toLowerCase()}-${toToken.symbol.toLowerCase()}`
                : ""
            }
            popularPairs={popularPairs}
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
                  <span>{token.symbol.slice(0, 1)}</span>
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
