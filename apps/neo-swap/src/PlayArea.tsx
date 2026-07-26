/**
 * PlayArea.tsx -- Neo Swap (liquidity desk rebuild)
 *
 * The route is the product: token assets, quote health, slippage guard, and the
 * wallet review sit in a focused trading stage. Controls stay compact and the
 * secondary token/settings surfaces live in drawers or inline selectors.
 */
import { useMemo, useState } from "react";
import { ArrowDownUp, ArrowRight, RefreshCw, ShieldCheck, Wallet } from "lucide-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { ObservableState } from "@shared/react/context";
import {
  OpenUiProvider,
  OpenUiSegmented,
  OpenUiTextField,
  PlayStage,
} from "@shared/components-react/v2";
import type { NativeTokenSymbol, Token } from "./types";
import { parseSlippageBps } from "./quoteMath";
import TokenIcon from "./components/TokenIcon";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: ObservableState;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

type TokenLike = Token | string | null | undefined;
type DrawerMode = "route" | "settings" | "tokens";
type TransactionStatus = "idle" | "signing" | "pending" | "unverified" | "confirmed" | "failed";

// Known symbols index as a guaranteed Token (noUncheckedIndexedAccess-safe);
// arbitrary strings stay `Token | undefined` for the dynamic lookups below.
const TOKEN_DEFAULTS: Record<"NEO" | "GAS", Token> & Record<string, Token | undefined> = {
  NEO: { symbol: "NEO", hash: "", balance: "0", balanceUnits: "0", decimals: 0 },
  GAS: { symbol: "GAS", hash: "", balance: "0", balanceUnits: "0", decimals: 8 },
};

const SLIPPAGE_PRESETS = [
  { label: "0.1%", value: 0.1, bps: 10 },
  { label: "0.5%", value: 0.5, bps: 50 },
  { label: "1%", value: 1, bps: 100 },
];
const SWAP_STAGE_ART = "liquidity-route-v2.webp";

function normalizeToken(value: TokenLike, fallbackSymbol: "NEO" | "GAS"): Token {
  if (value && typeof value === "object" && "symbol" in value) {
    const candidate = String(value.symbol || fallbackSymbol).toUpperCase();
    const symbol: NativeTokenSymbol = candidate === "GAS" ? "GAS" : candidate === "NEO" ? "NEO" : fallbackSymbol;
    const balance = String(value.balance ?? "0").trim();
    const balanceUnits = String(value.balanceUnits ?? "0").trim();
    return {
      ...TOKEN_DEFAULTS[symbol],
      ...value,
      symbol,
      balance: /^\d+(?:\.\d+)?$/.test(balance) ? balance : "0",
      balanceUnits: /^\d+$/.test(balanceUnits) ? balanceUnits : "0",
      decimals: TOKEN_DEFAULTS[symbol].decimals,
    };
  }
  const candidate = String(value || fallbackSymbol).toUpperCase();
  const symbol: NativeTokenSymbol = candidate === "GAS" ? "GAS" : candidate === "NEO" ? "NEO" : fallbackSymbol;
  return { ...TOKEN_DEFAULTS[symbol] };
}

function normalizeTokenList(values: unknown, fromToken: Token, toToken: Token): Token[] {
  const list = Array.isArray(values) ? values.slice(0, 8) : [];
  const tokens = list
    .map((item, index) => normalizeToken(item as TokenLike, index === 0 ? "NEO" : "GAS"))
    .filter((token) => token.symbol);
  const bySymbol = new Map<NativeTokenSymbol, Token>();
  for (const token of tokens) bySymbol.set(token.symbol, token);
  bySymbol.set(fromToken.symbol, fromToken);
  bySymbol.set(toToken.symbol, toToken);
  return (["NEO", "GAS"] as const).map((symbol) => bySymbol.get(symbol) ?? TOKEN_DEFAULTS[symbol]);
}

function formatBalance(token: Token): string {
  const maximumFractionDigits = token.decimals === 0 ? 0 : 4;
  const [whole = "0", fraction = ""] = token.balance.split(".");
  const groupedWhole = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const visibleFraction = fraction.slice(0, maximumFractionDigits).replace(/0+$/, "");
  return `${groupedWhole}${visibleFraction ? `.${visibleFraction}` : ""} ${token.symbol}`;
}

function formatSlippage(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "0.5%";
  return trimmed.endsWith("%") ? trimmed : `${trimmed}%`;
}

function slippageToBps(raw: string, rawBps: unknown): number {
  if (typeof rawBps === "number" && Number.isSafeInteger(rawBps) && rawBps > 0) return rawBps;
  return parseSlippageBps(raw, 1, 5000) ?? 50;
}

function shortTxid(txid: string): string {
  return txid.length > 18 ? `${txid.slice(0, 10)}…${txid.slice(-6)}` : txid;
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { bool, val, str } = useStateBindings(state);
  const fromToken = normalizeToken(val<TokenLike>("fromToken", "NEO"), "NEO");
  const toToken = normalizeToken(val<TokenLike>("toToken", "GAS"), "GAS");
  const fromAmount = str("fromAmount");
  const toAmount = str("toAmount");
  const exchangeRate = str("exchangeRate");
  const rateError = str("rateError");
  const rateLoading = bool("rateLoading");
  const balanceLoading = bool("balanceLoading");
  const loading = bool("loading");
  const isSwapping = bool("isSwapping");
  const canSwap = bool("canSwap");
  const swapButtonText = str("swapButtonText", t("tabSwap"));
  const amountError = str("amountError");
  const slippage = formatSlippage(str("slippage", "0.5%"));
  const slippageBps = slippageToBps(slippage, val<number | null>("slippageValue", null));
  const minReceived = str("minReceived");
  const selectedPairDisplay = str("selectedPairDisplay", `${fromToken.symbol}/${toToken.symbol}`);
  const showSelector = bool("showSelector");
  const selectorTarget = str("selectorTarget", "from");
  const rateAsOf = str("rateAsOf");
  const routerAvailable = val<boolean | null>("routerAvailable", false) ?? false;
  const rateStale = bool("rateStale");
  const walletConnected = val<boolean | null>("walletConnected", false) ?? false;
  const balancesVerified = val<boolean | null>("balancesVerified", false) ?? false;
  const quoteNetwork = str("quoteNetwork", "mainnet");
  const walletNetwork = str("walletNetwork");
  const networkVerified = bool("networkVerified");
  const networkError = str("networkError");
  const transactionStatus = str("transactionStatus", "idle") as TransactionStatus;
  const pendingTxid = str("pendingTxid");
  const transactionError = str("transactionError");
  const recovering = bool("recovering");
  const availableTokens = normalizeTokenList(val<unknown>("availableTokens", []), fromToken, toToken);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>("route");
  const dispatchSafely = (name: string, ...args: unknown[]) => {
    void dispatch(name, ...args).catch(() => {});
  };

  const routeHealth = rateLoading
    ? t("swapRouteSyncing")
    : rateError
      ? t("swapRouteNeedsAttention")
      : rateStale
        ? t("rateStale")
        : routerAvailable
          ? t("swapRouteReady")
          : t("swapRouteUnavailable");
  const quoteSource = rateError
    ? t("rateRetryHint")
    : rateAsOf
      ? rateStale
        ? t("rateStaleAsOf", { time: rateAsOf })
        : t("rateAsOf", { time: rateAsOf })
      : exchangeRate
        ? t("routeSourceMorpheus")
        : t("routeSourceAwaiting");
  // Quote-only networks should never ask for a wallet just to refresh public
  // market data. Wallet connection becomes primary only when a settlement
  // router is actually available.
  const quoteNeedsRefresh = Boolean(rateError) || rateStale;
  const primaryDisabled = quoteNeedsRefresh || !routerAvailable
    ? rateLoading || loading
    : pendingTxid
      ? recovering || loading
    : walletConnected
      ? !canSwap || loading || isSwapping || rateLoading
      : false;
  const primaryLabel = quoteNeedsRefresh || !routerAvailable
    ? t("refreshRate")
    : pendingTxid
      ? t("checkPendingSwap")
    : walletConnected
      ? swapButtonText || t("tabSwap")
      : t("connectToPreview");
  const rateDisplay = rateError
    ? t("rateUnavailable")
    : exchangeRate
      ? `1 ${fromToken.symbol} ${t("approxEqual")} ${exchangeRate} ${toToken.symbol}`
      : t("pricePreviewAwaiting");

  const selectorTitle = selectorTarget === "to" ? t("to") : t("from");
  const activeSlippagePreset = useMemo(
    () => SLIPPAGE_PRESETS.find((preset) => preset.bps === slippageBps),
    [slippageBps],
  );
  const shortLabel = (key: string, fallback: string) => {
    const value = t(key);
    return value === key ? fallback : value;
  };
  const minReceivedLabel = routerAvailable
    ? shortLabel("minReceivedShort", t("minReceived"))
    : t("planningFloor");
  // Awaiting-input state: with no quoted output the engine's derived floor is a
  // meaningless "0", so the readout must not print one until an amount exists.
  // A genuine 0 floor (NEO indivisibility) still renders once quoted. The
  // suppressed state is the visitor's own next step, not missing data, so it
  // says so rather than showing an em-dash void.
  const minReceivedDisplay = toAmount && minReceived
    ? `${minReceived} ${toToken.symbol}`
    : t("awaitingAmount");
  const slippageLabel = shortLabel("slippageShort", t("slippage"));
  const exchangeRateLabel = shortLabel("exchangeRateShort", t("exchangeRate"));
  const drawerModes: Array<{ mode: DrawerMode; label: string }> = [
    { mode: "route", label: shortLabel("routeReviewShort", t("routeReview")) },
    { mode: "settings", label: slippageLabel },
    { mode: "tokens", label: t("selectToken") },
  ];
  const drawerModeValue = drawerMode;
  const slippagePresetValue = activeSlippagePreset ? String(activeSlippagePreset.bps) : "";
  const balanceText = (token: Token) => balancesVerified
    ? formatBalance(token)
    : networkError
      ? networkError
    : walletConnected
      ? t("balanceUnavailable")
      : t("connectForBalance");

  const transactionLabel = t(`transaction${transactionStatus.charAt(0).toUpperCase()}${transactionStatus.slice(1)}`);

  const handlePrimary = () => {
    if (quoteNeedsRefresh || !routerAvailable) {
      if (!primaryDisabled) dispatchSafely("refreshRate");
      return;
    }
    if (pendingTxid) {
      if (!primaryDisabled) dispatchSafely("recoverPendingSwap");
      return;
    }
    if (!walletConnected) {
      dispatchSafely("connectWallet");
      return;
    }
    if (!primaryDisabled) dispatchSafely("executeSwap");
  };
  const handleFromAmountChange = (value: string) => {
    // Preserve exactly what the user typed. Silently truncating `1.5 NEO` to
    // `1 NEO` changes transaction intent; the engine validates precision and
    // explains the correction instead.
    dispatchSafely("setFromAmount", value);
  };
  const handleDrawerModeChange = (value: string) => {
    if (value === "route" || value === "settings" || value === "tokens") {
      setDrawerMode(value);
    }
  };
  const handleSlippagePresetChange = (value: string) => {
    const preset = SLIPPAGE_PRESETS.find((item) => String(item.bps) === value);
    if (preset) dispatchSafely("setSlippage", preset.value);
  };

  // Route-review facts shared by the desktop rail and the drawer panel. The
  // class name is parameterized because tests pin the drawer row count and the
  // two surfaces must not collide in selectors.
  const renderRouteChecks = (className: string) => (
    <dl className={className}>
      <div>
        <dt>{t("quoteNetwork")}</dt>
        <dd>{quoteNetwork.toUpperCase()}</dd>
      </div>
      <div data-tone={networkError ? "warning" : "neutral"}>
        <dt>{t("walletNetwork")}</dt>
        <dd>{networkError || (networkVerified ? walletNetwork.toUpperCase() : t("walletNotChecked"))}</dd>
      </div>
      <div>
        <dt>{t("priceImpact")}</dt>
        <dd>{t("priceImpactUnavailable")}</dd>
      </div>
      <div>
        <dt>{t("approvalLabel")}</dt>
        <dd>{routerAvailable ? t("approvalWalletTransaction") : t("approvalNotRequested")}</dd>
      </div>
      <div data-tone={transactionStatus === "unverified" || transactionStatus === "failed" ? "warning" : "neutral"}>
        <dt>{t("transactionLabel")}</dt>
        <dd>{transactionLabel}</dd>
      </div>
      {pendingTxid && (
        <div data-tone="warning">
          <dt>{t("pendingTxLabel")}</dt>
          <dd title={pendingTxid}>{shortTxid(pendingTxid)}</dd>
        </div>
      )}
    </dl>
  );
  const renderRouteSteps = () => (
    <div className="swap-route-steps">
      <span>{t("routeStepQuote")}</span>
      <span>{t("routeDirectValue", { pair: `${fromToken.symbol} → ${toToken.symbol}` })}</span>
      <span>{t("routeStepWallet")}</span>
    </div>
  );

  const scene = (
    <div
      className="swap-scene"
      data-state={loading || isSwapping ? "swapping" : rateLoading ? "quoting" : rateError ? "error" : rateStale ? "stale" : "ready"}
      data-router={routerAvailable ? "live" : "preview"}
    >
      <section className="swap-terminal" aria-label={t("tabSwap")}>
        <header className="swap-terminal__header">
          {/* The title slot names the card, not the quote's health. It used to
              render `routeHealth`, which made "Rate may be stale" the terminal's
              headline — a third copy of a warning already carried by the stage
              badge and the quote card, so a cold visit read as "this app's data
              is broken" before any interaction. The status still shows up in
              both places that are about status. */}
          <div>
            <span>{t("tabSwap")}</span>
            <strong>{selectedPairDisplay}</strong>
          </div>
          <em>{quoteNetwork.toUpperCase()} · {slippageLabel}: {slippage}</em>
        </header>

        <div className="swap-terminal__body">
          <section className="swap-station" data-selector-open={showSelector ? "true" : "false"} aria-label={t("tabSwap")}>
            <div className="swap-leg swap-leg--from" data-invalid={amountError ? "true" : "false"}>
              <div className="swap-leg__head">
                <span>{t("payWith")}</span>
                <button
                  type="button"
                  className="swap-token-btn"
                  onClick={() => dispatchSafely("openFromSelector")}
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
                  aria-invalid={amountError ? true : undefined}
                  hint={amountError || undefined}
                  disabled={loading || isSwapping}
                />
                <button
                  type="button"
                  className="swap-max-btn"
                  onClick={() => dispatchSafely("setMaxAmount")}
                  disabled={loading || isSwapping || !balancesVerified}
                >
                  {t("max")}
                </button>
              </div>
              <span className="swap-leg__balance" aria-live="polite">{t("balance")}: {balanceText(fromToken)}</span>
            </div>

            <div className="swap-station__bridge">
              <button
                type="button"
                className="swap-switch-btn"
                onClick={() => dispatchSafely("swapTokens")}
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
                  onClick={() => dispatchSafely("openToSelector")}
                  disabled={loading || isSwapping}
                >
                  <TokenIcon symbol={toToken.symbol} size={24} />
                  {toToken.symbol}
                </button>
              </div>
              <button
                type="button"
                className="swap-receive-value"
                data-empty={toAmount ? "false" : "true"}
                onClick={() => dispatchSafely("openToSelector")}
                disabled={loading || isSwapping}
              >
                <strong>{toAmount || t("awaitingAmount")}</strong>
                <em>{toToken.symbol}</em>
              </button>
              <span className="swap-leg__balance" aria-live="polite">{t("balance")}: {balanceText(toToken)}</span>
            </div>

            {showSelector && (
              <div className="swap-selector" role="group" aria-label={`${t("selectToken")} ${selectorTitle}`}>
                <div className="swap-selector__head">
                  <strong>{t("selectToken")}</strong>
                  <button type="button" onClick={() => dispatchSafely("closeSelector")}>{t("dismiss")}</button>
                </div>
                <div className="swap-selector__grid">
                  {availableTokens.map((token) => (
                    <button
                      key={token.symbol}
                      type="button"
                      className="swap-selector__token"
                      onClick={() => dispatchSafely("selectToken", token)}
                      aria-label={t("selectTokenAria", { token: token.symbol })}
                    >
                      <TokenIcon symbol={token.symbol} size={30} />
                      <span>
                        <strong>{token.symbol}</strong>
                        <em>{balanceText(token)}</em>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>

          <aside className="swap-quote-card" aria-label={t("routeReview")}>
            <div className="swap-quote-card__visual" aria-hidden="true">
              <img className="swap-quote-card__art" src={SWAP_STAGE_ART} alt="" loading="eager" decoding="async" />
              <div className="swap-quote-card__tokens">
                <TokenIcon symbol={fromToken.symbol} size={30} />
                <ArrowRight size={16} />
                <TokenIcon symbol={toToken.symbol} size={30} />
              </div>
            </div>
            {/* `data-tone` already carries the caution styling and `quoteSource`
                already states the staleness precisely and actionably ("Rate as
                of {time} — may be out of date"). The label just names the
                figure; repeating `routeHealth` here printed the same warning
                twice inside one card. */}
            <div className="swap-quote-card__summary" data-tone={rateError ? "error" : rateStale ? "warning" : "ready"} aria-live="polite">
              <span>{t("exchangeRateShort")}</span>
              <strong>{rateDisplay}</strong>
              <small>{quoteSource}</small>
            </div>
            <div className="swap-quote-card__metrics">
              <span>
                <small>{minReceivedLabel}</small>
                <strong>{minReceivedDisplay}</strong>
              </span>
              <span>
                <small>{slippageLabel}</small>
                <strong>{slippage}</strong>
              </span>
              <span>
                <small>{exchangeRateLabel}</small>
                <strong>{exchangeRate || "—"}</strong>
              </span>
            </div>
            <div className="swap-station__review">
              <span><ShieldCheck size={15} /> {minReceivedLabel}: <strong>{minReceivedDisplay}</strong></span>
              <span><Wallet size={15} /> {routerAvailable ? t("routeModeLive") : t("routeModePreview")}</span>
              <span data-tone={networkError ? "warning" : "neutral"}>
                {t("quoteNetwork")}: <strong>{quoteNetwork.toUpperCase()}</strong>
              </span>
            </div>
          </aside>
        </div>
      </section>

      <aside className="swap-route-rail" aria-label={t("routeReview")}>
        <div className="swap-route-rail__head">
          <h4>{t("routeReview")}</h4>
          <button
            type="button"
            className="swap-refresh-btn swap-refresh-btn--rail"
            onClick={() => dispatchSafely("refreshRate")}
            disabled={rateLoading}
          >
            <RefreshCw size={15} />
            {t("refreshRate")}
          </button>
        </div>
        <p>{routerAvailable ? t("routeModeLiveBody") : t("routeModePreviewBody")}</p>
        {renderRouteSteps()}
        {renderRouteChecks("swap-route-rail__checks")}
        {transactionError && <p className="swap-transaction-note" role="status">{transactionError}</p>}
      </aside>
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
            <button type="button" className="swap-refresh-btn" onClick={() => dispatchSafely("refreshRate")} disabled={rateLoading}>
              <RefreshCw size={15} />
              {t("refreshRate")}
            </button>
          </div>
          <p>{routerAvailable ? t("routeModeLiveBody") : t("routeModePreviewBody")}</p>
          {renderRouteSteps()}
          {renderRouteChecks("swap-settlement-checks")}
          {transactionError && <p className="swap-transaction-note" role="status">{transactionError}</p>}
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
          {!balancesVerified && (
            <button
              type="button"
              className="swap-balance-action"
              onClick={() => dispatchSafely(walletConnected ? "refreshBalances" : "connectWallet")}
              disabled={balanceLoading}
            >
              <Wallet size={17} />
              <span>{balanceLoading ? t("balanceLoading") : walletConnected ? t("retryBalance") : t("connectForBalances")}</span>
            </button>
          )}
          <div className="swap-token-list">
            {availableTokens.map((token) => (
              <button
                key={token.symbol}
                type="button"
                onClick={() => dispatchSafely("selectToken", token)}
                aria-label={t("selectTokenAria", { token: token.symbol })}
              >
                <TokenIcon symbol={token.symbol} size={30} />
                <span>{token.symbol}</span>
                <em>{balanceText(token)}</em>
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
            badges: <span className="mx2-badge" data-tone={rateError || rateStale ? "warning" : "accent"}><span className="mx2-badge__dot" /> {routeHealth}</span>,
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
