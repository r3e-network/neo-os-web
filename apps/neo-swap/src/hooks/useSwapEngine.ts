/**
 * useSwapEngine -- React hook for token swap operations.
 *
 * Uses createObservable instead of Vue ref/computed.
 */

import { createObservable, createDerived } from "@shared/react/context";
import type { Observable } from "@shared/react/context";
import type { ChainService, BalanceService, EventBus } from "@shared/services";
import { useMorpheusDataFeed } from "@shared/composables/useMorpheusDataFeed";
import { toFixedDecimals } from "@shared/utils/format";
import { BLOCKCHAIN_CONSTANTS } from "@shared/constants";
import type { Token } from "@/types";

const NEO_TOKEN_TEMPLATE: Token = { symbol: "NEO", hash: BLOCKCHAIN_CONSTANTS.NEO_HASH, balance: 0, decimals: 0 };
const GAS_TOKEN_TEMPLATE: Token = { symbol: "GAS", hash: BLOCKCHAIN_CONSTANTS.GAS_HASH, balance: 0, decimals: 8 };
const SWAP_DEADLINE_SECONDS = 600;
// A quote whose on-chain recordTimestamp (the time the feed last WROTE on-chain)
// is older than this is treated as stale — the Morpheus feed keeps returning
// HALT with its last value even when updates have stopped, so the on-chain write
// time is the freshness signal. dataTimestamp (when the upstream SOURCE produced
// the value) is used only for the "as of" display: on testnet the source
// dataTimestamp can lag far behind while the feed still writes fresh on-chain
// records, which would otherwise raise a false "stale" banner.
const RATE_STALE_AFTER_MS = 10 * 60 * 1000;
// GAS reserved for network fees when MAX-ing a GAS balance, so the swap (and the
// fee) can both settle instead of consuming the entire balance.
const GAS_FEE_HEADROOM = 0.1;
// Slippage tolerance is expressed in basis points (1 bp = 0.01%) and applied as
// minReceived = output * (10000 - bps) / 10000. The default is 50 bps (0.5%);
// the user can pick a preset or enter a custom value. Selecting more slippage
// only LOWERS the minimum-received floor — it never changes the quoted output.
const SLIPPAGE_BPS_DENOMINATOR = 10000n;
const DEFAULT_SLIPPAGE_BPS = 50;
// Bounds keep a custom slippage sane: 0.01% floor (1 bp) so minReceived stays
// meaningful, 50% ceiling so a fat-finger entry cannot zero out the floor.
const MIN_SLIPPAGE_BPS = 1;
const MAX_SLIPPAGE_BPS = 5000;
/** Preset slippage chips, in basis points, surfaced as 0.1% / 0.5% / 1%. */
export const SLIPPAGE_PRESET_BPS: ReadonlyArray<number> = [10, 50, 100];

/** Canonical list of swappable pairs surfaced in the playarea + manifest stats. */
export const POPULAR_PAIRS: ReadonlyArray<{ id: string; name: string }> = [
  { id: "neo-gas", name: "NEO/GAS" },
  { id: "gas-neo", name: "GAS/NEO" },
];

export interface UseSwapEngineOptions {
  chain: ChainService;
  balance: BalanceService;
  eventBus: EventBus;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function useSwapEngine({ chain, balance, eventBus, t }: UseSwapEngineOptions) {
  const fromToken = createObservable<Token>({ ...NEO_TOKEN_TEMPLATE });
  const toToken = createObservable<Token>({ ...GAS_TOKEN_TEMPLATE });
  const fromAmount = createObservable("");
  const toAmount = createObservable("");
  const exchangeRate = createObservable("");
  // The older of the two price legs' upstream-source dataTimestamp (epoch ms),
  // used ONLY for the "as of" display line. 0 when no quote is loaded.
  const rateTimestamp = createObservable(0);
  // The older of the two price legs' on-chain recordTimestamp (epoch ms) — the
  // time the feed last wrote on-chain. This is the freshness/staleness signal:
  // a frozen feed stops writing records, so this stops advancing. 0 when no
  // quote is loaded.
  const rateRecordTimestamp = createObservable(0);
  const rateLoading = createObservable(false);
  const loading = createObservable(false);
  const showSelector = createObservable(false);
  const selectorTarget = createObservable<"from" | "to">("from");
  const isSwapping = createObservable(false);
  // Selected slippage tolerance in basis points. Defaults to 0.5% (50 bps).
  const slippageBps = createObservable(DEFAULT_SLIPPAGE_BPS);
  const datafeed = useMorpheusDataFeed();
  let swapAnimTimer: ReturnType<typeof setTimeout> | null = null;

  // The deployed manifest declares NO swap router (contracts: {}). Settlement
  // cannot complete, so the UI must say so up front rather than offering an
  // enabled CTA that throws after wallet connect. A non-empty contractAddress
  // (e.g. a future router deployment) flips this on automatically.
  const routerAvailable: Observable<boolean> = {
    get: () => Boolean(chain.contractAddress.get()),
    set: () => {},
    subscribe: (fn) => chain.contractAddress.subscribe(fn),
  };

  // True once a quote exists but its on-chain record (the time the feed last
  // wrote on-chain) is older than RATE_STALE_AFTER_MS — or carries NO record
  // time at all. Keyed on the on-chain recordTimestamp, NOT the upstream-source
  // dataTimestamp, so a fresh feed with a lagging source timestamp (e.g. on
  // testnet) is not falsely flagged stale.
  //
  // A recordTimestamp of 0 is treated as STALE, not fresh: a never-written feed
  // returns recordTimestamp=0, and a quote we cannot prove is live must not be
  // tradable. "Stale" only applies once a rate is actually loaded — a 0 with no
  // rate yet is the pre-quote idle state, which surfaces as "rate unavailable",
  // not "stale".
  const rateStale: Observable<boolean> = {
    get: () => {
      const rate = parseFloat(exchangeRate.get());
      if (!(Number.isFinite(rate) && rate > 0)) return false;
      const ts = rateRecordTimestamp.get();
      if (!ts) return true;
      return Date.now() - ts > RATE_STALE_AFTER_MS;
    },
    set: () => {},
    subscribe: (fn) => {
      const u1 = rateRecordTimestamp.subscribe(fn);
      const u2 = exchangeRate.subscribe(fn);
      return () => { u1(); u2(); };
    },
  };

  // "as of HH:MM" line for the quote's upstream-source data timestamp (empty
  // when unknown). This describes when the source produced the value, which is
  // what the "Rate ... as of {time}" copy communicates.
  const rateAsOf: Observable<string> = {
    get: () => {
      const ts = rateTimestamp.get();
      if (!ts) return "";
      return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(new Date(ts));
    },
    set: () => {},
    subscribe: (fn) => rateTimestamp.subscribe(fn),
  };

  const walletConnected: Observable<boolean> = {
    get: () => Boolean(chain.address.get()),
    set: () => {},
    subscribe: (fn) => chain.address.subscribe(fn),
  };

  function applyTokenBalances(neo: number, gas: number) {
    const ft = fromToken.get();
    const tt = toToken.get();
    if (ft.symbol === "NEO") fromToken.set({ ...ft, balance: neo });
    if (ft.symbol === "GAS") fromToken.set({ ...ft, balance: gas });
    if (tt.symbol === "NEO") toToken.set({ ...tt, balance: neo });
    if (tt.symbol === "GAS") toToken.set({ ...tt, balance: gas });
  }

  async function refreshBalances() {
    if (!chain.address.get()) { applyTokenBalances(0, 0); return; }
    try {
      const [neo, gas] = await Promise.all([balance.getNeoBalance(), balance.getGasBalance()]);
      applyTokenBalances(neo, gas);
    } catch (e) {
      console.warn("[useSwapEngine] refreshBalances failed:", e instanceof Error ? e.message : String(e));
    }
  }

  const availableTokens: Observable<Token[]> = {
    get: () => [
      { ...NEO_TOKEN_TEMPLATE, balance: fromToken.get().symbol === "NEO" ? fromToken.get().balance : toToken.get().symbol === "NEO" ? toToken.get().balance : 0 },
      { ...GAS_TOKEN_TEMPLATE, balance: fromToken.get().symbol === "GAS" ? fromToken.get().balance : toToken.get().symbol === "GAS" ? toToken.get().balance : 0 },
    ],
    set: () => {},
    subscribe: (fn) => { const u1 = fromToken.subscribe(fn); const u2 = toToken.subscribe(fn); return () => { u1(); u2(); }; },
  };

  /** Strict decimal: rejects NaN/scientific/hex/whitespace; enforces integer for 0-decimal tokens. */
  function parseAmount(raw: string, decimals: number): number | null {
    const trimmed = raw.trim();
    if (!/^\d+(\.\d+)?$/.test(trimmed)) return null;
    const amount = Number(trimmed);
    if (!Number.isFinite(amount) || amount <= 0) return null;
    if (decimals === 0 && !Number.isInteger(amount)) return null;
    return amount;
  }

  /**
   * Render an integer base-unit amount as a decimal string with `decimals`
   * fraction digits (0 for NEO → no fractional part). Trims trailing zeros for
   * fractional tokens so "1.50000000" displays as "1.5".
   */
  function formatBaseUnits(units: bigint, decimals: number): string {
    if (decimals <= 0) return units.toString();
    const scale = 10n ** BigInt(decimals);
    const whole = units / scale;
    const frac = (units % scale).toString().padStart(decimals, "0").replace(/0+$/, "");
    return frac ? `${whole}.${frac}` : whole.toString();
  }

  /**
   * Quantize a human amount to the token's decimals, returning a clean decimal
   * string. NEO (0 decimals) is floored to a whole number.
   */
  function quantizeToToken(amount: number, decimals: number): string {
    if (!Number.isFinite(amount) || amount <= 0) return "";
    const baseUnits = toFixedDecimals(amount.toString(), decimals);
    return formatBaseUnits(BigInt(baseUnits), decimals);
  }

  const canSwap: Observable<boolean> = {
    get: () => {
      // No router deployed → swap can never settle. A stale quote must not be
      // tradable either.
      if (!routerAvailable.get() || rateStale.get()) return false;
      const rate = parseFloat(exchangeRate.get());
      const hasRate = Number.isFinite(rate) && rate > 0;
      const ft = fromToken.get();
      const amount = parseAmount(fromAmount.get(), ft.decimals);
      return hasRate && amount !== null && amount <= ft.balance;
    },
    set: () => {},
    subscribe: (fn) => {
      const u1 = exchangeRate.subscribe(fn);
      const u2 = fromAmount.subscribe(fn);
      const u3 = fromToken.subscribe(fn);
      const u4 = rateRecordTimestamp.subscribe(fn);
      const u5 = chain.contractAddress.subscribe(fn);
      return () => { u1(); u2(); u3(); u4(); u5(); };
    },
  };

  const swapButtonText: Observable<string> = {
    get: () => {
      // Router state and wallet connection take precedence over amount/rate copy
      // so the button never claims a swap is possible when it is not.
      if (!routerAvailable.get()) return t("swapRouterUnavailable");
      if (loading.get()) return t("swapping");
      if (!walletConnected.get()) return t("connectWallet");
      if (!fromAmount.get()) return t("enterAmount");
      if (rateLoading.get()) return t("loadingRate");
      if (rateStale.get()) return t("rateStale");
      const rate = parseFloat(exchangeRate.get());
      if (!(Number.isFinite(rate) && rate > 0)) return t("rateUnavailable");
      const ft = fromToken.get();
      const amount = parseAmount(fromAmount.get(), ft.decimals);
      if (amount === null) {
        return ft.decimals === 0 && /\./.test(fromAmount.get().trim())
          ? t("neoIntegerOnly")
          : t("invalidAmount");
      }
      if (amount > ft.balance) return t("insufficientBalance");
      return `${t("tabSwap")} ${ft.symbol} ${t("swapArrow")} ${toToken.get().symbol}`;
    },
    set: () => {},
    subscribe: (fn) => {
      const u1 = loading.subscribe(fn);
      const u2 = fromAmount.subscribe(fn);
      const u3 = rateLoading.subscribe(fn);
      const u4 = exchangeRate.subscribe(fn);
      const u5 = fromToken.subscribe(fn);
      const u6 = toToken.subscribe(fn);
      const u7 = rateRecordTimestamp.subscribe(fn);
      const u8 = chain.contractAddress.subscribe(fn);
      const u9 = chain.address.subscribe(fn);
      return () => { u1(); u2(); u3(); u4(); u5(); u6(); u7(); u8(); u9(); };
    },
  };

  /** Format a basis-point value as a trimmed percentage string, e.g. 50 → "0.5%". */
  function formatSlippagePct(bps: number): string {
    const pct = bps / 100;
    // Up to 2 decimals, trailing zeros trimmed: 10→"0.1%", 50→"0.5%", 100→"1%".
    return `${parseFloat(pct.toFixed(2))}%`;
  }

  // Human-readable selected slippage, e.g. "0.5%". Read by the detail panel and
  // the wallet-review copy.
  const slippage: Observable<string> = {
    get: () => formatSlippagePct(slippageBps.get()),
    set: () => {},
    subscribe: (fn) => slippageBps.subscribe(fn),
  };

  // Raw selected slippage in basis points, so the UI can highlight the active
  // preset chip and the custom input can show the current value.
  const slippageValue: Observable<number> = {
    get: () => slippageBps.get(),
    set: () => {},
    subscribe: (fn) => slippageBps.subscribe(fn),
  };

  /**
   * Update the slippage tolerance from a percentage string or number (e.g. "0.5"
   * or 0.5 → 50 bps). Out-of-range / invalid input is clamped to the supported
   * 0.01%–50% band so the minimum-received floor stays meaningful. This only
   * adjusts the floor used for minReceived — it never alters the quoted output.
   */
  function setSlippage(value: string | number): void {
    const pct = typeof value === "number" ? value : parseFloat(String(value).trim().replace("%", ""));
    if (!Number.isFinite(pct)) return;
    const bps = Math.round(pct * 100);
    const clamped = Math.min(MAX_SLIPPAGE_BPS, Math.max(MIN_SLIPPAGE_BPS, bps));
    slippageBps.set(clamped);
  }

  /**
   * Minimum received, computed in integer base units to apply the selected
   * slippage floor without float scientific-notation artifacts. Returns a
   * decimal string quantized to the receiving token's decimals.
   */
  function computeMinReceived(): string {
    const tt = toToken.get();
    const outInt = toFixedDecimals(toAmount.get() || "0", tt.decimals);
    const numerator = BigInt(SLIPPAGE_BPS_DENOMINATOR - BigInt(slippageBps.get()));
    let minInt: bigint;
    try {
      minInt = (BigInt(outInt) * numerator) / SLIPPAGE_BPS_DENOMINATOR;
    } catch {
      return tt.decimals === 0 ? "0" : (0).toFixed(Math.min(tt.decimals, 4));
    }
    return formatBaseUnits(minInt, tt.decimals);
  }

  const minReceived: Observable<string> = {
    get: () => computeMinReceived(),
    set: () => {},
    subscribe: (fn) => {
      const u1 = toAmount.subscribe(fn);
      const u2 = toToken.subscribe(fn);
      const u3 = slippageBps.subscribe(fn);
      return () => { u1(); u2(); u3(); };
    },
  };

  // Manifest-bound views: header stats + sidebar rows read these keys.
  const selectedPairDisplay = createDerived<string>(
    () => `${fromToken.get().symbol}/${toToken.get().symbol}`,
    [fromToken, toToken],
  );
  const pairCount = createDerived<number>(() => POPULAR_PAIRS.length, []);
  const currentRate = createDerived<string>(
    () => {
      const rate = parseFloat(exchangeRate.get());
      return Number.isFinite(rate) && rate > 0 ? exchangeRate.get() : t("rateUnavailable");
    },
    [exchangeRate],
  );

  function setMaxAmount() {
    const ft = fromToken.get();
    let max = ft.balance;
    // Reserve a little GAS for network fees so the swap + fee can both settle.
    if (ft.symbol === "GAS") max = Math.max(0, ft.balance - GAS_FEE_HEADROOM);
    // NEO is indivisible — floor to a whole number.
    if (ft.decimals === 0) max = Math.floor(max);
    fromAmount.set(quantizeToToken(max, ft.decimals) || "0");
    onFromAmountChange();
  }

  function setFromAmount(value: string) {
    fromAmount.set(value);
    onFromAmountChange();
  }

  async function loadExchangeRate() {
    if (rateLoading.get()) return;
    rateLoading.set(true);
    exchangeRate.set("");
    rateTimestamp.set(0);
    rateRecordTimestamp.set(0);
    try {
      const [fromQuote, toQuote] = await Promise.all([
        datafeed.getPriceWithMeta(fromToken.get().symbol),
        datafeed.getPriceWithMeta(toToken.get().symbol),
      ]);
      const rate = fromQuote.price / toQuote.price;
      if (Number.isFinite(rate) && rate > 0) {
        exchangeRate.set(rate.toFixed(6));
        // Freshness is the OLDER leg's on-chain recordTimestamp (epoch seconds →
        // ms): a stale leg makes the whole cross-rate stale. recordTimestamp is
        // when the feed last WROTE on-chain, so a frozen feed stops advancing it
        // — unlike dataTimestamp, which can lag on testnet even while the feed
        // keeps writing fresh records.
        const oldestRecordSec = Math.min(
          fromQuote.recordTimestamp || 0,
          toQuote.recordTimestamp || 0,
        );
        rateRecordTimestamp.set(oldestRecordSec > 0 ? oldestRecordSec * 1000 : 0);
        // Keep the older leg's upstream-source dataTimestamp for the "as of"
        // display line only.
        const oldestDataSec = Math.min(
          fromQuote.dataTimestamp || 0,
          toQuote.dataTimestamp || 0,
        );
        rateTimestamp.set(oldestDataSec > 0 ? oldestDataSec * 1000 : 0);
        onFromAmountChange();
      }
    } catch (e) {
      console.warn("[useSwapEngine] exchange rate load failed:", e instanceof Error ? e.message : String(e));
    } finally {
      rateLoading.set(false);
    }
  }

  function onFromAmountChange() {
    const rate = parseFloat(exchangeRate.get());
    const amount = parseAmount(fromAmount.get(), fromToken.get().decimals);
    if (amount === null || !Number.isFinite(rate) || rate <= 0) { toAmount.set(""); return; }
    // Quantize the output to the receiving token's decimals — NEO outputs are
    // whole numbers, not fractional.
    toAmount.set(quantizeToToken(amount * rate, toToken.get().decimals));
  }

  function swapTokens() {
    isSwapping.set(true);
    const temp = fromToken.get();
    fromToken.set(toToken.get());
    toToken.set(temp);
    fromAmount.set("");
    toAmount.set("");
    loadExchangeRate().catch(() => {});
    if (swapAnimTimer) clearTimeout(swapAnimTimer);
    swapAnimTimer = setTimeout(() => { isSwapping.set(false); swapAnimTimer = null; }, 300);
  }

  function openFromSelector() { selectorTarget.set("from"); showSelector.set(true); }
  function openToSelector() { selectorTarget.set("to"); showSelector.set(true); }
  function closeSelector() { showSelector.set(false); }

  function selectToken(token: Token) {
    if (selectorTarget.get() === "from") {
      if (token.symbol === toToken.get().symbol) swapTokens();
      else fromToken.set({ ...token });
    } else {
      if (token.symbol === fromToken.get().symbol) swapTokens();
      else toToken.set({ ...token });
    }
    closeSelector();
    loadExchangeRate().catch(() => {});
  }

  async function executeSwap() {
    if (!canSwap.get() || loading.get()) return;
    loading.set(true);
    try {
      await chain.ensureWallet();
      const sender = chain.address.get() as string;
      const ft = fromToken.get();
      const tt = toToken.get();
      const parsedAmount = parseAmount(fromAmount.get(), ft.decimals);
      if (parsedAmount === null) {
        throw new Error(ft.decimals === 0 ? t("neoIntegerOnly") : t("invalidAmount"));
      }
      const amountInt = toFixedDecimals(fromAmount.get(), ft.decimals);
      // Min received in integer base units — apply the 0.5% floor with BigInt so
      // a tiny output never collapses to "0" via float scientific notation.
      const outInt = BigInt(toFixedDecimals(toAmount.get() || "0", tt.decimals));
      const slippageNumerator = SLIPPAGE_BPS_DENOMINATOR - BigInt(slippageBps.get());
      const minOutputBig = (outInt * slippageNumerator) / SLIPPAGE_BPS_DENOMINATOR;
      if (minOutputBig <= 0n) throw new Error(t("invalidAmount"));
      const minOutputInt = minOutputBig.toString();
      const routerAddress = chain.contractAddress.get();
      if (!routerAddress) throw new Error(t("swapRouterUnavailable"));
      if (rateStale.get()) throw new Error(t("rateStale"));

      const deadline = Math.floor(Date.now() / 1000) + SWAP_DEADLINE_SECONDS;
      const path = [
        { type: "Hash160" as const, value: ft.hash },
        { type: "Hash160" as const, value: tt.hash },
      ];

      await chain.invoke("swapTokenInForTokenOut", [
        { type: "Hash160", value: sender },
        { type: "Integer", value: amountInt },
        { type: "Integer", value: minOutputInt },
        { type: "Array", value: path } as unknown as { type: "Array"; value: string },
        { type: "Integer", value: String(deadline) },
      ], { waitForEvent: "SwapExecuted" });

      eventBus.emit("swap:success", { message: `${t("swapSuccess")}: ${parseFloat(fromAmount.get())} ${ft.symbol}` });
      fromAmount.set("");
      toAmount.set("");
      await refreshBalances();
    } catch (e) {
      eventBus.emit("swap:error", { message: e instanceof Error ? e.message : t("swapFailed") });
      throw e;
    } finally {
      loading.set(false);
    }
  }

  const loadAll = async () => { await Promise.all([refreshBalances(), loadExchangeRate()]); };
  const cleanup = () => { if (swapAnimTimer) { clearTimeout(swapAnimTimer); swapAnimTimer = null; } };

  return {
    fromToken, toToken, fromAmount, toAmount, exchangeRate, rateLoading, loading,
    showSelector, selectorTarget, isSwapping, availableTokens, canSwap,
    swapButtonText, slippage, slippageValue, minReceived, selectedPairDisplay, pairCount, currentRate,
    routerAvailable, rateStale, rateAsOf, walletConnected,
    setSlippage, setMaxAmount, setFromAmount, loadExchangeRate,
    swapTokens, openFromSelector, openToSelector, closeSelector, selectToken,
    executeSwap, refreshBalances, loadAll, cleanup,
  };
}
