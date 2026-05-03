/**
 * PlayArea.tsx -- Neo Swap
 *
 * Uses all state: fromToken, toToken, fromAmount, toAmount, exchangeRate,
 * rateLoading, loading, showSelector, selectorTarget, isSwapping,
 * availableTokens, canSwap, swapButtonText, slippage, minReceived.
 * Actions: executeSwap, swapTokens, setMaxAmount, openFromSelector,
 * openToSelector, closeSelector, selectToken.
 * Keeps existing sub-components: SwapHero, PopularPairs.
 */

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

  return (
    <div className="neo-swap-play-area">
      {/* Hero rate display */}
      <SwapHero t={t} currentRate={exchangeRate} />

      {/* Swap form */}
      <NeoCard variant="erobo" className="swap-form-card">
        {/* From section */}
        <div className="swap-field">
          <div className="swap-field-header">
            <span className="swap-field-label">{t("from") || "From"}</span>
            <NeoButton size="sm" variant="ghost" onClick={() => dispatch("openFromSelector")}>
              {fromToken?.symbol || t("selectToken") || "Select"}
            </NeoButton>
          </div>
          <div className="swap-input-row">
            <NeoInput
              value={fromAmount}
              type="number"
              placeholder={t("enterAmount") || "0.00"}
              onChange={(val) => state.fromAmount?.set?.(val)}
            />
            <NeoButton size="sm" variant="secondary" onClick={() => dispatch("setMaxAmount")}>
              {t("max") || "MAX"}
            </NeoButton>
          </div>
          {fromToken && (
            <span className="swap-balance">{t("balance") || "Balance"}: {fromToken.balance}</span>
          )}
        </div>

        {/* Swap direction button */}
        <div className="swap-direction">
          <NeoButton size="sm" variant="ghost" aria-label={t("switchTokens") || "Switch tokens"} onClick={() => dispatch("swapTokens")}>
            {t("swapArrow") || "->"}
          </NeoButton>
        </div>

        {/* To section */}
        <div className="swap-field">
          <div className="swap-field-header">
            <span className="swap-field-label">{t("to") || "To"}</span>
            <NeoButton size="sm" variant="ghost" onClick={() => dispatch("openToSelector")}>
              {toToken?.symbol || t("selectToken") || "Select"}
            </NeoButton>
          </div>
          <div className="swap-input-row">
            <NeoInput
              value={toAmount}
              type="number"
              placeholder="0.00"
              disabled
            />
          </div>
          {toToken && (
            <span className="swap-balance">{t("balance") || "Balance"}: {toToken.balance}</span>
          )}
        </div>

        {/* Swap details */}
        <div className="swap-details">
          <div className="swap-detail-row">
            <span className="swap-detail-label">{t("exchangeRate") || "Exchange Rate"}</span>
            <span className="swap-detail-value">{rateLoading ? (t("loadingRate") || "Loading...") : exchangeRate}</span>
          </div>
          <div className="swap-detail-row">
            <span className="swap-detail-label">{t("slippage") || "Slippage"}</span>
            <span className="swap-detail-value">{slippage}</span>
          </div>
          {minReceived && (
            <div className="swap-detail-row">
              <span className="swap-detail-label">{t("minReceived") || "Min Received"}</span>
              <span className="swap-detail-value">{minReceived}</span>
            </div>
          )}
        </div>

        {/* Execute swap */}
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

      {/* Token selector overlay */}
      {showSelector && (
        <NeoCard variant="erobo" className="token-selector">
          <div className="selector-header">
            <span className="selector-title">{t("selectToken") || "Select Token"}</span>
            <NeoButton size="sm" variant="ghost" onClick={() => dispatch("closeSelector")}>X</NeoButton>
          </div>
          <div className="token-list">
            {availableTokens.map((token) => (
              <button
                key={token.hash}
                type="button"
                className="token-option"
                onClick={() => dispatch("selectToken", token as unknown)}
              >
                <span className="token-symbol">{token.symbol}</span>
                <span className="token-bal">{token.balance}</span>
              </button>
            ))}
          </div>
        </NeoCard>
      )}

      {/* Popular pairs */}
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
    </div>
  );
}
