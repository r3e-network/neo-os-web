/**
 * PlayArea.tsx -- Neo Swap
 *
 * Host-native NEO/GAS swap console with route preview, wallet balances,
 * token selection, and wallet-submitted execution.
 */

import {
  Activity,
  ArrowDownUp,
  RefreshCw,
  ShieldCheck,
  Wallet,
  X,
} from "lucide-react";
import { NeoButton, NeoCard, NeoInput } from "@shared/components-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import SwapHero from "./components/SwapHero";
import PopularPairs from "./components/PopularPairs";
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

const popularPairs = [
  { id: "neo-gas", name: "NEO/GAS", rate: "1:45.2" },
  { id: "gas-neo", name: "GAS/NEO", rate: "1:0.0221" },
];

const formatBalance = (token: Token | null) =>
  token ? token.balance.toLocaleString(undefined, { maximumFractionDigits: 8 }) : "0";

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool, val } = useStateBindings(state);

  const fromToken = val<Token | null>("fromToken", null);
  const toToken = val<Token | null>("toToken", null);
  const fromAmount = str("fromAmount", "");
  const toAmount = str("toAmount", "");
  const exchangeRate = str("exchangeRate", t("rateUnavailable") || "--");
  const rateLoading = bool("rateLoading");
  const loading = bool("loading");
  const showSelector = bool("showSelector");
  const selectorTarget = str("selectorTarget", "");
  const isSwapping = bool("isSwapping");
  const availableTokens = val<Token[]>("availableTokens", []);
  const canSwap = bool("canSwap");
  const swapButtonText = str("swapButtonText", t("tabSwap") || "Swap");
  const slippage = str("slippage", "0.5%");
  const minReceived = str("minReceived", "");

  const routeHealth = rateLoading
    ? t("swapRouteSyncing")
    : exchangeRate
      ? t("swapRouteReady")
      : t("swapRouteUnavailable");
  const rateDisplay = rateLoading ? t("loadingRate") : exchangeRate || t("rateUnavailable");
  const formattedMinReceived = minReceived || "0.0000";
  const selectorTitle = selectorTarget === "to" ? t("to") : t("from");
  const fromSymbol = fromToken?.symbol || t("selectToken");
  const toSymbol = toToken?.symbol || t("selectToken");

  return (
    <div className="neo-swap-play-area">
      <div className="neo-swap-shell">
        <section className="neo-swap-hero-panel" aria-label={t("title")}>
          <SwapHero
            t={t}
            currentRate={rateDisplay}
            fromSymbol={fromSymbol}
            toSymbol={toSymbol}
          />
          <div className="neo-swap-balance-grid" aria-label={t("swapPortfolioLabel")}>
            <div className="neo-swap-balance-card">
              <span>{t("from")}</span>
              <strong>{formatBalance(fromToken)} {fromToken?.symbol || ""}</strong>
            </div>
            <div className="neo-swap-balance-card">
              <span>{t("to")}</span>
              <strong>{formatBalance(toToken)} {toToken?.symbol || ""}</strong>
            </div>
            <div className="neo-swap-balance-card">
              <span>{t("quoteHealth")}</span>
              <strong>{routeHealth}</strong>
            </div>
          </div>
        </section>

        <NeoCard variant="erobo" className="neo-swap-route-card">
          <div className="neo-swap-section-header">
            <div>
              <span>{t("swapRouteStatus")}</span>
              <strong>{routeHealth}</strong>
            </div>
            <NeoButton
              size="sm"
              variant="secondary"
              onClick={() => dispatch("refreshRate")}
              aria-label={t("refreshRate")}
            >
              <RefreshCw size={15} aria-hidden="true" />
              {t("refreshRate")}
            </NeoButton>
          </div>

          <div className="neo-swap-route-steps" aria-label={t("tabPool")}>
            <div>
              <Activity size={17} aria-hidden="true" />
              <span>{t("exchangeRate")}</span>
              <strong>{rateDisplay}</strong>
            </div>
            <div>
              <ShieldCheck size={17} aria-hidden="true" />
              <span>{t("slippage")}</span>
              <strong>{slippage}</strong>
            </div>
            <div>
              <Wallet size={17} aria-hidden="true" />
              <span>{t("minReceived")}</span>
              <strong>{formattedMinReceived}</strong>
            </div>
          </div>
        </NeoCard>
      </div>

      <div className="neo-swap-main-grid">
        <NeoCard variant="erobo" className="neo-swap-swap-card">
          <div className="neo-swap-section-header">
            <div>
              <span>{t("tabSwap")}</span>
              <strong>{fromSymbol} {t("swapArrow")} {toSymbol}</strong>
            </div>
          </div>

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
                placeholder={t("enterAmount") || "0.00"}
                onChange={(val) => { void dispatch("setFromAmount", val); }}
              />
              <NeoButton size="sm" variant="secondary" onClick={() => dispatch("setMaxAmount")}>
                {t("max") || "MAX"}
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
              aria-label={t("switchTokens") || "Switch tokens"}
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

          <div className="neo-swap-detail-panel">
            <div>
              <span>{t("exchangeRate")}</span>
              <strong>{rateDisplay}</strong>
            </div>
            <div>
              <span>{t("slippage")}</span>
              <strong>{slippage}</strong>
            </div>
            <div>
              <span>{t("minReceived")}</span>
              <strong>{formattedMinReceived}</strong>
            </div>
          </div>

          <NeoButton
            variant="primary"
            block
            loading={isSwapping || loading}
            disabled={!canSwap}
            onClick={() => dispatch("executeSwap")}
          >
            {isSwapping ? (t("swapping") || "Swapping...") : swapButtonText}
          </NeoButton>
        </NeoCard>

        <aside className="neo-swap-side-stack" aria-label={t("tabPool")}>
          <div className="neo-swap-trust-strip">
            <ShieldCheck size={19} aria-hidden="true" />
            <div>
              <span>{t("swapSafetyTitle")}</span>
              <strong>{t("swapSafetyCopy")}</strong>
            </div>
          </div>

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
                aria-label={t("dismiss") || "Close"}
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
