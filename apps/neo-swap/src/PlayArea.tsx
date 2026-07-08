/**
 * PlayArea.tsx -- Neo Swap (liquidity desk rebuild)
 *
 * The route is the product: token assets, quote health, slippage guard, and the
 * wallet review sit in a focused trading stage. Controls stay compact and the
 * secondary token/settings surfaces live in drawers or inline selectors.
 */
import { useMemo, useState } from "react";
import { ArrowDownUp, RefreshCw, ShieldCheck, Wallet } from "lucide-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { ObservableState } from "@shared/react/context";
import {
  OpenUiProvider,
  OpenUiSegmented,
  OpenUiTextField,
  PlayStage,
} from "@shared/components-react/v2";
import type { Token } from "@/types";
import TokenIcon from "./components/TokenIcon";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: ObservableState;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

type TokenLike = Token | string | null | undefined;
type DrawerMode = "route" | "settings" | "tokens";

// Known symbols index as a guaranteed Token (noUncheckedIndexedAccess-safe);
// arbitrary strings stay `Token | undefined` for the dynamic lookups below.
const TOKEN_DEFAULTS: Record<"NEO" | "GAS", Token> & Record<string, Token | undefined> = {
  NEO: { symbol: "NEO", hash: "", balance: 0, decimals: 0 },
  GAS: { symbol: "GAS", hash: "", balance: 0, decimals: 8 },
};

const SLIPPAGE_PRESETS = [
  { label: "0.1%", value: 0.1, bps: 10 },
  { label: "0.5%", value: 0.5, bps: 50 },
  { label: "1%", value: 1, bps: 100 },
];
const SWAP_STAGE_ART = "swap-liquidity-stage.webp";

function normalizeToken(value: TokenLike, fallbackSymbol: "NEO" | "GAS"): Token {
  if (value && typeof value === "object" && "symbol" in value) {
    const symbol = String(value.symbol || fallbackSymbol).toUpperCase();
    return {
      ...TOKEN_DEFAULTS[symbol],
      ...value,
      symbol,
      balance: Number.isFinite(Number(value.balance)) ? Number(value.balance) : 0,
      decimals: Number.isFinite(Number(value.decimals))
        ? Number(value.decimals)
        : TOKEN_DEFAULTS[symbol]?.decimals ?? 8,
    };
  }
  const symbol = String(value || fallbackSymbol).toUpperCase();
  return { ...(TOKEN_DEFAULTS[symbol] ?? TOKEN_DEFAULTS[fallbackSymbol]), symbol };
}

function normalizeTokenList(values: unknown, fromToken: Token, toToken: Token): Token[] {
  const list = Array.isArray(values) ? values : [];
  const tokens = list
    .map((item, index) => normalizeToken(item as TokenLike, index === 0 ? "NEO" : "GAS"))
    .filter((token) => token.symbol);
  if (tokens.length > 0) return tokens;
  return [fromToken, toToken];
}

function formatBalance(token: Token): string {
  const maximumFractionDigits = token.decimals === 0 ? 0 : 4;
  return `${Number(token.balance || 0).toLocaleString(undefined, { maximumFractionDigits })} ${token.symbol}`;
}

function normalizeAmountForToken(value: string, token: Token): string {
  const text = String(value ?? "");
  if (token.decimals === 0) {
    return (text.split(/[.,]/)[0] ?? "").replace(/[^\d]/g, "").replace(/^0+(?=\d)/, "");
  }
  return text.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1");
}

function formatSlippage(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "0.5%";
  return trimmed.endsWith("%") ? trimmed : `${trimmed}%`;
}

function slippageToBps(raw: string, rawBps: unknown): number {
  const bps = Number(rawBps);
  if (Number.isFinite(bps) && bps > 0) return Math.round(bps);
  const pct = Number.parseFloat(raw.replace("%", ""));
  return Number.isFinite(pct) ? Math.round(pct * 100) : 50;
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { bool, val, str } = useStateBindings(state);
  const fromToken = normalizeToken(val<TokenLike>("fromToken", "NEO"), "NEO");
  const toToken = normalizeToken(val<TokenLike>("toToken", "GAS"), "GAS");
  const fromAmount = str("fromAmount");
  const toAmount = str("toAmount");
  const exchangeRate = str("exchangeRate");
  const rateLoading = bool("rateLoading");
  const loading = bool("loading");
  const isSwapping = bool("isSwapping");
  const canSwap = bool("canSwap");
  const swapButtonText = str("swapButtonText", t("tabSwap"));
  const slippage = formatSlippage(str("slippage", "0.5%"));
  const slippageBps = slippageToBps(slippage, val<number | null>("slippageValue", null));
  const minReceived = str("minReceived");
  const selectedPairDisplay = str("selectedPairDisplay", `${fromToken.symbol}/${toToken.symbol}`);
  const showSelector = bool("showSelector");
  const selectorTarget = str("selectorTarget", "from");
  const rateAsOf = str("rateAsOf");
  const routerAvailable = val<boolean | null>("routerAvailable", true) ?? true;
  const rateStale = bool("rateStale");
  const walletConnected = val<boolean | null>("walletConnected", true) ?? true;
  const availableTokens = normalizeTokenList(val<unknown>("availableTokens", []), fromToken, toToken);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>("route");

  const routeHealth = rateLoading
    ? t("swapRouteSyncing")
    : rateStale
      ? t("rateStale")
      : routerAvailable
        ? t("swapRouteReady")
        : t("swapRouteUnavailable");
  const quoteSource = rateAsOf
    ? rateStale
      ? t("rateStaleAsOf", { time: rateAsOf })
      : t("rateAsOf", { time: rateAsOf })
    : exchangeRate
      ? t("routeSourceMorpheus")
      : t("routeSourceAwaiting");
  const primaryDisabled = walletConnected
    ? !canSwap || loading || isSwapping || rateLoading || !routerAvailable || rateStale
    : false;
  const primaryLabel = walletConnected ? swapButtonText || t("tabSwap") : t("connectToPreview");
  const rateDisplay = exchangeRate ? `1 ${fromToken.symbol} ~= ${exchangeRate} ${toToken.symbol}` : t("pricePreviewAwaiting");

  const selectorTitle = selectorTarget === "to" ? t("to") : t("from");
  const activeSlippagePreset = useMemo(
    () => SLIPPAGE_PRESETS.find((preset) => preset.bps === slippageBps),
    [slippageBps],
  );
  const shortLabel = (key: string, fallback: string) => {
    const value = t(key);
    return value === key ? fallback : value;
  };
  const minReceivedLabel = shortLabel("minReceivedShort", t("minReceived"));
  const slippageLabel = shortLabel("slippageShort", t("slippage"));
  const exchangeRateLabel = shortLabel("exchangeRateShort", t("exchangeRate"));
  const drawerModes: Array<{ mode: DrawerMode; label: string }> = [
    { mode: "route", label: shortLabel("routeReviewShort", t("routeReview")) },
    { mode: "settings", label: slippageLabel },
    { mode: "tokens", label: t("selectToken") },
  ];
  const drawerModeValue = drawerMode;
  const slippagePresetValue = activeSlippagePreset ? String(activeSlippagePreset.bps) : "";

  const handlePrimary = () => {
    if (!walletConnected) {
      void dispatch("connectWallet");
      return;
    }
    if (!primaryDisabled) void dispatch("executeSwap");
  };
  const handleFromAmountChange = (value: string) => {
    void dispatch("setFromAmount", normalizeAmountForToken(value, fromToken));
  };
  const handleDrawerModeChange = (value: string) => {
    if (value === "route" || value === "settings" || value === "tokens") {
      setDrawerMode(value);
    }
  };
  const handleSlippagePresetChange = (value: string) => {
    const preset = SLIPPAGE_PRESETS.find((item) => String(item.bps) === value);
    if (preset) void dispatch("setSlippage", preset.value);
  };

  const scene = (
    <div
      className="swap-scene"
      data-state={loading || isSwapping ? "swapping" : rateLoading ? "quoting" : rateStale ? "stale" : "ready"}
      data-router={routerAvailable ? "live" : "preview"}
    >
      <section className="swap-terminal" aria-label={t("tabSwap")}>
        <header className="swap-terminal__header">
          <div>
            <span>{selectedPairDisplay}</span>
            <strong>{routeHealth}</strong>
          </div>
          <em>{slippageLabel}: {slippage}</em>
        </header>

        <div className="swap-terminal__body">
          <section className="swap-station" data-selector-open={showSelector ? "true" : "false"} aria-label={t("tabSwap")}>
            <div className="swap-leg swap-leg--from">
              <div className="swap-leg__head">
                <span>{t("payWith")}</span>
                <button
                  type="button"
                  className="swap-token-btn"
                  onClick={() => void dispatch("openFromSelector")}
                  disabled={loading || isSwapping}
                >
                  <TokenIcon symbol={fromToken.symbol} size={24} />
                  {fromToken.symbol}
                </button>
              </div>
              <div className="swap-leg__amount-row">
                <OpenUiTextField
                  id="swap-from-amount"
                  className="swap-amount-field"
                  inputClassName="swap-input"
                  label={t("payAmountLabel")}
                  value={fromAmount}
                  onChange={(event) => handleFromAmountChange(event.target.value)}
                  placeholder="0"
                  inputMode={fromToken.decimals === 0 ? "numeric" : "decimal"}
                  disabled={loading || isSwapping}
                />
                <button
                  type="button"
                  className="swap-max-btn"
                  onClick={() => void dispatch("setMaxAmount")}
                  disabled={loading || isSwapping}
                >
                  {t("max")}
                </button>
              </div>
              <span className="swap-leg__balance">{t("balance")}: {formatBalance(fromToken)}</span>
            </div>

            <div className="swap-station__bridge">
              <span className="swap-route-core__line" aria-hidden="true" />
              <span className="swap-route-core__bead swap-route-core__bead--one" aria-hidden="true" />
              <span className="swap-route-core__bead swap-route-core__bead--two" aria-hidden="true" />
              <button
                type="button"
                className="swap-switch-btn"
                onClick={() => void dispatch("swapTokens")}
                disabled={loading || isSwapping}
                aria-label={t("switchTokens")}
              >
                <ArrowDownUp size={18} />
              </button>
            </div>

            <div className="swap-leg swap-leg--to">
              <div className="swap-leg__head">
                <span>{t("receiveEstimated")}</span>
                <button
                  type="button"
                  className="swap-token-btn"
                  onClick={() => void dispatch("openToSelector")}
                  disabled={loading || isSwapping}
                >
                  <TokenIcon symbol={toToken.symbol} size={24} />
                  {toToken.symbol}
                </button>
              </div>
              <button
                type="button"
                className="swap-receive-value"
                onClick={() => void dispatch("openToSelector")}
                disabled={loading || isSwapping}
              >
                <strong>{toAmount || "0"}</strong>
                <em>{toToken.symbol}</em>
              </button>
              <span className="swap-leg__balance">{t("balance")}: {formatBalance(toToken)}</span>
            </div>

            {showSelector && (
              <div className="swap-selector" role="dialog" aria-label={`${t("selectToken")} ${selectorTitle}`}>
                <div className="swap-selector__head">
                  <strong>{t("selectToken")}</strong>
                  <button type="button" onClick={() => void dispatch("closeSelector")}>{t("dismiss")}</button>
                </div>
                <div className="swap-selector__grid">
                  {availableTokens.map((token) => (
                    <button
                      key={token.symbol}
                      type="button"
                      className="swap-selector__token"
                      onClick={() => void dispatch("selectToken", token)}
                    >
                      <TokenIcon symbol={token.symbol} size={30} />
                      <span>
                        <strong>{token.symbol}</strong>
                        <em>{formatBalance(token)}</em>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>

          <aside className="swap-quote-card" aria-label={t("routeReview")}>
            <img className="swap-quote-card__art" src={SWAP_STAGE_ART} alt="" loading="eager" decoding="async" />
            <div className="swap-quote-card__summary">
              <span>{exchangeRate ? routeHealth : t("routeStepQuote")}</span>
              <strong>{rateDisplay}</strong>
              <small>{quoteSource}</small>
            </div>
            <div className="swap-quote-card__metrics">
              <span>
                <small>{minReceivedLabel}</small>
                <strong>{minReceived || "0"} {toToken.symbol}</strong>
              </span>
              <span>
                <small>{slippageLabel}</small>
                <strong>{slippage}</strong>
              </span>
              <span>
                <small>{exchangeRateLabel}</small>
                <strong>{exchangeRate || "-"}</strong>
              </span>
            </div>
            <div className="swap-station__review">
              <span><ShieldCheck size={15} /> {t("minReceived")}: <strong>{minReceived || "0"} {toToken.symbol}</strong></span>
              <span><Wallet size={15} /> {routerAvailable ? t("routeModeLive") : t("routeModePreview")}</span>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );

  const drawer = (
    <div className="swap-drawer">
      <OpenUiSegmented
        className="swap-drawer-tabs"
        segmentedClassName="swap-drawer-tabs__group"
        label={t("routeReview")}
        value={drawerModeValue}
        onChange={handleDrawerModeChange}
        options={drawerModes.map((item) => ({
          value: item.mode,
          label: <span className="swap-drawer-tab">{item.label}</span>,
        }))}
      />

      {drawerMode === "route" && (
        <section className="swap-drawer-panel swap-drawer-panel--route">
          <div className="swap-drawer__head">
            <h4>{t("routeReview")}</h4>
            <button type="button" className="swap-refresh-btn" onClick={() => void dispatch("refreshRate")} disabled={rateLoading}>
              <RefreshCw size={15} />
              {t("refreshRate")}
            </button>
          </div>
          <p>{routerAvailable ? t("routeModeLiveBody") : t("routeModePreviewBody")}</p>
          <div className="swap-route-steps">
            <span>{t("routeStepQuote")}</span>
            <span>{t("routeStepPair")}</span>
            <span>{t("routeStepWallet")}</span>
          </div>
        </section>
      )}

      {drawerMode === "settings" && (
        <section className="swap-drawer-panel swap-drawer-panel--settings">
          <h4>{t("slippageControl")}</h4>
          <p>{t("slippageHint")}</p>
          <OpenUiSegmented
            className="swap-slippage-grid"
            segmentedClassName="swap-slippage-grid__group"
            label={t("slippageControl")}
            value={slippagePresetValue}
            onChange={handleSlippagePresetChange}
            options={SLIPPAGE_PRESETS.map((preset) => ({
              value: String(preset.bps),
              label: <span className="swap-slippage-option">{preset.label}</span>,
            }))}
          />
        </section>
      )}

      {drawerMode === "tokens" && (
        <section className="swap-drawer-panel swap-drawer-panel--tokens">
          <h4>{t("selectToken")}</h4>
          <div className="swap-token-list">
            {availableTokens.map((token) => (
              <button
                key={token.symbol}
                type="button"
                onClick={() => void dispatch("selectToken", token)}
              >
                <TokenIcon symbol={token.symbol} size={30} />
                <span>{token.symbol}</span>
                <em>{formatBalance(token)}</em>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );

  return (
    <OpenUiProvider>
      <div className="neo-swap-play-area mx2 mx2-cat-defi">
        <PlayStage
          category="defi"
          stage={{
            eyebrow: t("marketPairs"),
            title: selectedPairDisplay,
            subtitle: t("docSubtitle"),
            badges: <span className="mx2-badge" data-tone="accent"><span className="mx2-badge__dot" /> {routeHealth}</span>,
          }}
          scene={scene}
          actions={{
            primary: {
              label: primaryLabel,
              onClick: handlePrimary,
              disabled: primaryDisabled,
              loading: loading || isSwapping || rateLoading,
            },
          }}
          drawerToggleLabel={t("routeReviewShort")}
          drawer={{ title: t("routeReview"), children: drawer }}
        />
      </div>
    </OpenUiProvider>
  );
}
