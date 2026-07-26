/**
 * useSwapEngine -- React hook for token swap operations.
 *
 * Uses createObservable instead of Vue ref/computed.
 */

import { createObservable, createDerived } from "@shared/react/context";
import type { Observable } from "@shared/react/context";
import type { MiniAppFramework } from "@shared/react";
import { useMorpheusDataFeed } from "@shared/composables/useMorpheusDataFeed";
import { normalizeScriptHash } from "@shared/utils/neo";
import { BLOCKCHAIN_CONSTANTS } from "@shared/constants";
import type { NativeTokenSymbol, Token } from "../types";
import {
  applySlippageFloor,
  formatPriceRatio,
  formatSlippageBps,
  formatUnits,
  morpheusPriceUnits,
  parseDecimalUnits,
  parseSlippageBps,
  quoteOutputUnits,
  safeUnits,
} from "../quoteMath";
import {
  ACTIVE_SWAP_ROUTER_BINDING,
  isApprovedSwapRouter,
  normalizeSwapNetwork,
  type ApprovedSwapRouterBinding,
  type SwapNetwork,
} from "../settlement";

const NEO_TOKEN_TEMPLATE: Token = {
  symbol: "NEO",
  hash: BLOCKCHAIN_CONSTANTS.NEO_HASH,
  balance: "0",
  balanceUnits: "0",
  decimals: 0,
};
const GAS_TOKEN_TEMPLATE: Token = {
  symbol: "GAS",
  hash: BLOCKCHAIN_CONSTANTS.GAS_HASH,
  balance: "0",
  balanceUnits: "0",
  decimals: 8,
};
const SWAP_DEADLINE_SECONDS = 600;
// A quote whose on-chain recordTimestamp (the time the feed last WROTE on-chain)
// is older than this is treated as stale — the Morpheus feed keeps returning
// HALT with its last value even when updates have stopped, so the on-chain write
// time is the freshness signal. dataTimestamp (when the upstream SOURCE produced
// the value) is used only for the "as of" display: on testnet the source
// dataTimestamp can lag far behind while the feed still writes fresh on-chain
// records, which would otherwise raise a false "stale" banner.
const RATE_STALE_AFTER_MS = 10 * 60 * 1000;
const MAX_RECORD_FUTURE_SKEW_MS = 2 * 60 * 1000;
// GAS reserved for network fees when MAX-ing a GAS balance, so the swap (and the
// fee) can both settle instead of consuming the entire balance.
const GAS_FEE_HEADROOM_UNITS = 10_000_000n;
const PENDING_SWAP_STORAGE_PREFIX = "pending-swap:v1:";
// Slippage tolerance is expressed in basis points (1 bp = 0.01%) and applied as
// minReceived = output * (10000 - bps) / 10000. The default is 50 bps (0.5%);
// the user can pick a preset or enter a custom value. Selecting more slippage
// only LOWERS the minimum-received floor — it never changes the quoted output.
const DEFAULT_SLIPPAGE_BPS = 50;
// Bounds keep a custom slippage sane: 0.01% floor (1 bp) so minReceived stays
// meaningful, 50% ceiling so a fat-finger entry cannot zero out the floor.
const MIN_SLIPPAGE_BPS = 1;
const MAX_SLIPPAGE_BPS = 5000;
/** Canonical list of swappable pairs surfaced in the playarea + manifest stats. */
export const POPULAR_PAIRS: ReadonlyArray<{ id: string; name: string }> = [
  { id: "neo-gas", name: "NEO/GAS" },
  { id: "gas-neo", name: "GAS/NEO" },
];

export interface UseSwapEngineOptions {
  app: MiniAppFramework;
  t: (key: string, params?: Record<string, string | number>) => string;
  /** Explicit, reviewed route binding. The production app currently passes null. */
  settlementBinding?: ApprovedSwapRouterBinding | null;
}

type SwapTransactionStatus = "idle" | "signing" | "pending" | "unverified" | "confirmed" | "failed";

interface PendingSwapRecord {
  version: 1;
  txid: string;
  network: SwapNetwork;
  wallet: string;
  router: string;
  fromHash: string;
  toHash: string;
  amountIn: string;
  minOutput: string;
  submittedAt: number;
}

export function useSwapEngine({
  app,
  t,
  settlementBinding = ACTIVE_SWAP_ROUTER_BINDING,
}: UseSwapEngineOptions) {
  const chain = app.chain;
  // The framework narrows contractAddress to a get-only accessor, but the
  // underlying chain service exposes the full observable (with subscribe) that
  // the router-state views below react to. Alias it once at the observable type
  // so the reactive subscriptions keep firing exactly as before.
  const contractAddress = chain.contractAddress as unknown as Observable<string | null>;
  const fromToken = createObservable<Token>({ ...NEO_TOKEN_TEMPLATE });
  const toToken = createObservable<Token>({ ...GAS_TOKEN_TEMPLATE });
  const fromAmount = createObservable("");
  const toAmount = createObservable("");
  const exchangeRate = createObservable("");
  // Fixed-six Morpheus price legs and the quoted receiving-token base units.
  // These strings stay private to the engine so React state never needs to
  // serialize BigInt while all financial math remains integer-only.
  const fromPriceUnits = createObservable("");
  const toPriceUnits = createObservable("");
  const quotedOutputUnits = createObservable("");
  // A localized, user-safe quote failure. Raw RPC/provider errors stay in the
  // console; the product surface only explains that the quote is unavailable
  // and can be retried.
  const rateError = createObservable("");
  // The older of the two price legs' upstream-source dataTimestamp (epoch ms),
  // used ONLY for the "as of" display line. 0 when no quote is loaded.
  const rateTimestamp = createObservable(0);
  // The older of the two price legs' on-chain recordTimestamp (epoch ms) — the
  // time the feed last wrote on-chain. This is the freshness/staleness signal:
  // a frozen feed stops writing records, so this stops advancing. 0 when no
  // quote is loaded.
  const rateRecordTimestamp = createObservable(0);
  const rateLoading = createObservable(false);
  const balanceLoading = createObservable(false);
  const balanceOwner = createObservable("");
  const walletNetwork = createObservable<SwapNetwork | "">("");
  const networkError = createObservable("");
  const loading = createObservable(false);
  const showSelector = createObservable(false);
  const selectorTarget = createObservable<"from" | "to">("from");
  const isSwapping = createObservable(false);
  // Selected slippage tolerance in basis points. Defaults to 0.5% (50 bps).
  const slippageBps = createObservable(DEFAULT_SLIPPAGE_BPS);
  const rateExpired = createObservable(false);
  const transactionStatus = createObservable<SwapTransactionStatus>("idle");
  const pendingTxid = createObservable("");
  const transactionError = createObservable("");
  const recovering = createObservable(false);
  const datafeed = useMorpheusDataFeed();
  const quoteNetworkValue: SwapNetwork = datafeed.network;
  const quoteNetwork: Observable<SwapNetwork> = {
    get: () => quoteNetworkValue,
    set: () => {},
    subscribe: () => () => {},
  };
  let swapAnimTimer: ReturnType<typeof setTimeout> | null = null;
  let rateExpiryTimer: ReturnType<typeof setTimeout> | null = null;
  let quoteRequestId = 0;
  let balanceRequestId = 0;

  // The deployed manifest declares NO swap router (contracts: {}). A contract
  // address alone is never enough to enable settlement: it must exactly match
  // a reviewed network + ABI binding. This prevents a stale/misconfigured host
  // catalog entry from silently converting the quote desk into a write surface.
  const routerAvailable: Observable<boolean> = {
    get: () => isApprovedSwapRouter(settlementBinding, quoteNetworkValue, contractAddress.get()),
    set: () => {},
    subscribe: (fn) => contractAddress.subscribe(fn),
  };

  const networkVerified: Observable<boolean> = {
    get: () => Boolean(chain.address.get()) && walletNetwork.get() === quoteNetworkValue,
    set: () => {},
    subscribe: (fn) => {
      const u1 = chain.address.subscribe(fn);
      const u2 = walletNetwork.subscribe(fn);
      return () => { u1(); u2(); };
    },
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
      if (safeUnits(fromPriceUnits.get()) <= 0n || safeUnits(toPriceUnits.get()) <= 0n) return false;
      const ts = rateRecordTimestamp.get();
      if (!ts) return true;
      if (ts - Date.now() > MAX_RECORD_FUTURE_SKEW_MS) return true;
      return rateExpired.get() || Date.now() - ts >= RATE_STALE_AFTER_MS;
    },
    set: () => {},
    subscribe: (fn) => {
      const u1 = rateRecordTimestamp.subscribe(fn);
      const u2 = exchangeRate.subscribe(fn);
      const u3 = rateExpired.subscribe(fn);
      const u4 = fromPriceUnits.subscribe(fn);
      const u5 = toPriceUnits.subscribe(fn);
      return () => { u1(); u2(); u3(); u4(); u5(); };
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

  const balancesVerified: Observable<boolean> = {
    get: () => {
      const currentAddress = chain.address.get() ?? "";
      return Boolean(currentAddress) && balanceOwner.get() === currentAddress;
    },
    set: () => {},
    subscribe: (fn) => {
      const u1 = chain.address.subscribe(fn);
      const u2 = balanceOwner.subscribe(fn);
      return () => { u1(); u2(); };
    },
  };

  function tokenWithBalance(token: Token, units: bigint): Token {
    return {
      ...token,
      balance: formatUnits(units, token.decimals),
      balanceUnits: units.toString(),
    };
  }

  function applyTokenBalances(neo: bigint, gas: bigint) {
    const ft = fromToken.get();
    const tt = toToken.get();
    if (ft.symbol === "NEO") fromToken.set(tokenWithBalance(ft, neo));
    if (ft.symbol === "GAS") fromToken.set(tokenWithBalance(ft, gas));
    if (tt.symbol === "NEO") toToken.set(tokenWithBalance(tt, neo));
    if (tt.symbol === "GAS") toToken.set(tokenWithBalance(tt, gas));
  }

  function pendingStorageKey(network: SwapNetwork, wallet: string): string {
    return `${PENDING_SWAP_STORAGE_PREFIX}${network}:${wallet.trim().toLowerCase()}`;
  }

  function clearPendingSwap(): void {
    const wallet = chain.address.get() ?? "";
    const network = walletNetwork.get();
    if (wallet && network) app.storage.local.delete(pendingStorageKey(network, wallet));
    pendingTxid.set("");
  }

  function persistPendingSwap(record: PendingSwapRecord): void {
    app.storage.local.set(pendingStorageKey(record.network, record.wallet), record);
    pendingTxid.set(record.txid);
    transactionStatus.set("pending");
    transactionError.set("");
  }

  function readPendingSwap(): PendingSwapRecord | null {
    const wallet = chain.address.get() ?? "";
    const network = walletNetwork.get();
    if (!wallet || !network || !routerAvailable.get() || !settlementBinding) return null;
    const value = app.storage.local.get<PendingSwapRecord>(pendingStorageKey(network, wallet), null);
    if (!value || value.version !== 1) return null;
    const exactBinding =
      value.network === network &&
      value.wallet.trim().toLowerCase() === wallet.trim().toLowerCase() &&
      normalizeScriptHash(value.router) === normalizeScriptHash(settlementBinding.scriptHash) &&
      /^0x[0-9a-f]{64}$/i.test(value.txid) &&
      /^0x[0-9a-f]{40}$/i.test(value.fromHash) &&
      /^0x[0-9a-f]{40}$/i.test(value.toHash) &&
      /^\d{1,80}$/.test(value.amountIn) && BigInt(value.amountIn) > 0n &&
      /^\d{1,80}$/.test(value.minOutput) && BigInt(value.minOutput) > 0n &&
      Number.isFinite(value.submittedAt) && value.submittedAt > 0;
    if (!exactBinding) {
      app.storage.local.delete(pendingStorageKey(network, wallet));
      return null;
    }
    return value;
  }

  function restorePendingSwap(): void {
    const record = readPendingSwap();
    pendingTxid.set(record?.txid ?? "");
    if (record) transactionStatus.set("pending");
    else if (transactionStatus.get() === "pending" || transactionStatus.get() === "unverified") {
      transactionStatus.set("idle");
    }
  }

  async function refreshBalances() {
    const requestId = ++balanceRequestId;
    const requestedAddress = chain.address.get() ?? "";
    balanceOwner.set("");
    walletNetwork.set("");
    networkError.set("");
    pendingTxid.set("");
    if (!requestedAddress) {
      applyTokenBalances(0n, 0n);
      balanceLoading.set(false);
      return;
    }
    balanceLoading.set(true);
    try {
      const detectedBefore = normalizeSwapNetwork(await app.chain.detectNetwork());
      if (requestId !== balanceRequestId || chain.address.get() !== requestedAddress) return;
      if (!detectedBefore || detectedBefore !== quoteNetworkValue) {
        networkError.set(t("walletNetworkMismatch", { network: quoteNetworkValue }));
        applyTokenBalances(0n, 0n);
        return;
      }
      walletNetwork.set(detectedBefore);
      const [neo, gas] = await Promise.all([app.wallet.raw("NEO"), app.wallet.raw("GAS")]);
      const detectedAfter = normalizeSwapNetwork(await app.chain.detectNetwork());
      if (
        requestId !== balanceRequestId ||
        chain.address.get() !== requestedAddress ||
        detectedAfter !== detectedBefore
      ) return;
      if (neo < 0n || gas < 0n) {
        throw new Error("Wallet returned an invalid token balance");
      }
      applyTokenBalances(neo, gas);
      balanceOwner.set(requestedAddress);
      restorePendingSwap();
    } catch (e) {
      console.warn("[useSwapEngine] refreshBalances failed:", e instanceof Error ? e.message : String(e));
      if (requestId === balanceRequestId) balanceOwner.set("");
    } finally {
      if (requestId === balanceRequestId) balanceLoading.set(false);
    }
  }

  const availableTokens: Observable<Token[]> = {
    get: () => [
      fromToken.get().symbol === "NEO" ? { ...fromToken.get() } : { ...toToken.get() },
      fromToken.get().symbol === "GAS" ? { ...fromToken.get() } : { ...toToken.get() },
    ],
    set: () => {},
    subscribe: (fn) => { const u1 = fromToken.subscribe(fn); const u2 = toToken.subscribe(fn); return () => { u1(); u2(); }; },
  };

  function amountIssue(raw: string, token: Token): string {
    const trimmed = raw.trim();
    if (!trimmed) return "";
    if (!/^\d+(\.\d+)?$/.test(trimmed)) return t("invalidAmount");
    const fraction = trimmed.split(".")[1] ?? "";
    if (token.decimals === 0 && fraction.length > 0) return t("neoIntegerOnly");
    if (fraction.length > token.decimals) {
      return t("tokenPrecisionExceeded", { token: token.symbol, decimals: token.decimals });
    }
    return parseDecimalUnits(trimmed, token.decimals) !== null ? "" : t("invalidAmount");
  }

  const amountError: Observable<string> = {
    get: () => amountIssue(fromAmount.get(), fromToken.get()),
    set: () => {},
    subscribe: (fn) => {
      const u1 = fromAmount.subscribe(fn);
      const u2 = fromToken.subscribe(fn);
      return () => { u1(); u2(); };
    },
  };

  const canSwap: Observable<boolean> = {
    get: () => {
      // No router deployed → swap can never settle. A stale quote must not be
      // tradable either.
      if (
        !routerAvailable.get() ||
        rateStale.get() ||
        !balancesVerified.get() ||
        !networkVerified.get() ||
        Boolean(pendingTxid.get())
      ) return false;
      const ft = fromToken.get();
      const amountUnits = parseDecimalUnits(fromAmount.get(), ft.decimals);
      return safeUnits(fromPriceUnits.get()) > 0n
        && safeUnits(toPriceUnits.get()) > 0n
        && amountUnits !== null
        && amountUnits <= safeUnits(ft.balanceUnits)
        && safeUnits(quotedOutputUnits.get()) > 0n;
    },
    set: () => {},
    subscribe: (fn) => {
      const u1 = exchangeRate.subscribe(fn);
      const u2 = fromAmount.subscribe(fn);
      const u3 = fromToken.subscribe(fn);
      const u4 = rateRecordTimestamp.subscribe(fn);
      const u5 = contractAddress.subscribe(fn);
      const u6 = rateExpired.subscribe(fn);
      const u7 = balancesVerified.subscribe(fn);
      const u8 = walletNetwork.subscribe(fn);
      const u9 = pendingTxid.subscribe(fn);
      const u10 = quotedOutputUnits.subscribe(fn);
      return () => { u1(); u2(); u3(); u4(); u5(); u6(); u7(); u8(); u9(); u10(); };
    },
  };

  const swapButtonText: Observable<string> = {
    get: () => {
      // Router state and wallet connection take precedence over amount/rate copy
      // so the button never claims a swap is possible when it is not.
      if (!routerAvailable.get()) return t("swapRouterUnavailable");
      if (loading.get()) return t("swapping");
      if (pendingTxid.get()) return t("checkPendingSwap");
      if (!walletConnected.get()) return t("connectWallet");
      if (!networkVerified.get()) return t("walletNetworkMismatch", { network: quoteNetworkValue });
      if (!balancesVerified.get()) return t("balanceUnavailable");
      if (!fromAmount.get()) return t("enterAmount");
      if (rateLoading.get()) return t("loadingRate");
      if (rateError.get()) return t("refreshRate");
      if (rateStale.get()) return t("rateStale");
      if (safeUnits(fromPriceUnits.get()) <= 0n || safeUnits(toPriceUnits.get()) <= 0n) {
        return t("rateUnavailable");
      }
      const ft = fromToken.get();
      const issue = amountError.get();
      if (issue) return issue;
      const amountUnits = parseDecimalUnits(fromAmount.get(), ft.decimals);
      if (amountUnits === null) {
        return t("invalidAmount");
      }
      if (amountUnits > safeUnits(ft.balanceUnits)) return t("insufficientBalance");
      if (safeUnits(quotedOutputUnits.get()) <= 0n) return t("quoteRoundsToZero");
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
      const u8 = contractAddress.subscribe(fn);
      const u9 = chain.address.subscribe(fn);
      const u10 = rateError.subscribe(fn);
      const u11 = rateExpired.subscribe(fn);
      const u12 = balancesVerified.subscribe(fn);
      const u13 = walletNetwork.subscribe(fn);
      const u14 = pendingTxid.subscribe(fn);
      const u15 = quotedOutputUnits.subscribe(fn);
      return () => { u1(); u2(); u3(); u4(); u5(); u6(); u7(); u8(); u9(); u10(); u11(); u12(); u13(); u14(); u15(); };
    },
  };

  // Human-readable selected slippage, e.g. "0.5%". Read by the detail panel and
  // the wallet-review copy.
  const slippage: Observable<string> = {
    get: () => formatSlippageBps(slippageBps.get()),
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
    const next = parseSlippageBps(value, MIN_SLIPPAGE_BPS, MAX_SLIPPAGE_BPS);
    if (next === null) return;
    slippageBps.set(next);
    if (!pendingTxid.get() && (transactionStatus.get() === "confirmed" || transactionStatus.get() === "failed")) {
      transactionStatus.set("idle");
      transactionError.set("");
    }
  }

  /**
   * Minimum received, computed in integer base units to apply the selected
   * slippage floor without float scientific-notation artifacts. Returns a
   * decimal string quantized to the receiving token's decimals.
   */
  function computeMinReceived(): string {
    const tt = toToken.get();
    const minUnits = applySlippageFloor(safeUnits(quotedOutputUnits.get()), slippageBps.get());
    return formatUnits(minUnits, tt.decimals);
  }

  const minReceived: Observable<string> = {
    get: () => computeMinReceived(),
    set: () => {},
    subscribe: (fn) => {
      const u1 = quotedOutputUnits.subscribe(fn);
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
    () => exchangeRate.get() || t("rateUnavailable"),
    [exchangeRate],
  );

  function setMaxAmount() {
    const ft = fromToken.get();
    let maxUnits = safeUnits(ft.balanceUnits);
    // Reserve a little GAS for network fees so the swap + fee can both settle.
    if (ft.symbol === "GAS") {
      maxUnits = maxUnits > GAS_FEE_HEADROOM_UNITS ? maxUnits - GAS_FEE_HEADROOM_UNITS : 0n;
    }
    fromAmount.set(formatUnits(maxUnits, ft.decimals));
    onFromAmountChange();
  }

  function setFromAmount(value: string) {
    fromAmount.set(value);
    if (!pendingTxid.get() && (transactionStatus.get() === "confirmed" || transactionStatus.get() === "failed")) {
      transactionStatus.set("idle");
      transactionError.set("");
    }
    onFromAmountChange();
  }

  function clearRateExpiryTimer() {
    if (rateExpiryTimer) {
      clearTimeout(rateExpiryTimer);
      rateExpiryTimer = null;
    }
  }

  function scheduleRateExpiry(recordTimestampMs: number) {
    clearRateExpiryTimer();
    if (recordTimestampMs - Date.now() > MAX_RECORD_FUTURE_SKEW_MS) {
      rateExpired.set(true);
      return;
    }
    const remaining = RATE_STALE_AFTER_MS - (Date.now() - recordTimestampMs);
    if (remaining <= 0) {
      rateExpired.set(true);
      return;
    }
    rateExpiryTimer = setTimeout(() => {
      rateExpired.set(true);
      rateExpiryTimer = null;
    }, remaining);
  }

  function timestampSecondsToMs(value: number): number {
    if (
      !Number.isSafeInteger(value)
      || value <= 0
      || value > Math.floor(Number.MAX_SAFE_INTEGER / 1000)
    ) return 0;
    return value * 1000;
  }

  function clearQuote(): void {
    fromPriceUnits.set("");
    toPriceUnits.set("");
    exchangeRate.set("");
    quotedOutputUnits.set("");
    toAmount.set("");
    rateTimestamp.set(0);
    rateRecordTimestamp.set(0);
  }

  async function loadVerifiedPriceLeg(symbol: NativeTokenSymbol) {
    const canonical = await datafeed.getPriceWithMeta(symbol);
    if (
      Number.isFinite(canonical.price) &&
      canonical.price > 0 &&
      canonical.recordTimestamp > 0
    ) return canonical;

    // A registered AGG key may exist before its first update and return a HALT
    // struct filled with zeroes. That is not a quote and must not suppress the
    // composable's intended provider fallback. Ask for the explicit source key;
    // a non-positive value still fails, while a missing/old record time flows to
    // the existing stale guard and can never become a settlement quote.
    const provider = await datafeed.getPriceWithMeta(`TWELVEDATA:${symbol}-USD`);
    if (
      !Number.isFinite(provider.price) ||
      provider.price <= 0
    ) throw new Error(`No verifiable ${symbol} price record`);
    return provider;
  }

  async function loadExchangeRate() {
    const requestId = ++quoteRequestId;
    const requestedFrom = fromToken.get().symbol;
    const requestedTo = toToken.get().symbol;
    rateLoading.set(true);
    rateError.set("");
    rateExpired.set(false);
    clearRateExpiryTimer();
    clearQuote();
    try {
      const [fromQuote, toQuote] = await Promise.all([
        loadVerifiedPriceLeg(requestedFrom),
        loadVerifiedPriceLeg(requestedTo),
      ]);
      // A quote belongs to the exact pair that requested it. If the user flips
      // assets while RPC is in flight, only the newest matching response may
      // update the terminal.
      if (
        requestId !== quoteRequestId ||
        fromToken.get().symbol !== requestedFrom ||
        toToken.get().symbol !== requestedTo
      ) return;
      const exactFromPrice = morpheusPriceUnits(fromQuote.price);
      const exactToPrice = morpheusPriceUnits(toQuote.price);
      if (exactFromPrice !== null && exactToPrice !== null) {
        fromPriceUnits.set(exactFromPrice.toString());
        toPriceUnits.set(exactToPrice.toString());
        exchangeRate.set(formatPriceRatio(exactFromPrice, exactToPrice));
        // Freshness is the OLDER leg's on-chain recordTimestamp (epoch seconds →
        // ms): a stale leg makes the whole cross-rate stale. recordTimestamp is
        // when the feed last WROTE on-chain, so a frozen feed stops advancing it
        // — unlike dataTimestamp, which can lag on testnet even while the feed
        // keeps writing fresh records.
        const fromRecordMs = timestampSecondsToMs(fromQuote.recordTimestamp);
        const toRecordMs = timestampSecondsToMs(toQuote.recordTimestamp);
        const recordTimestampMs = fromRecordMs && toRecordMs ? Math.min(fromRecordMs, toRecordMs) : 0;
        rateRecordTimestamp.set(recordTimestampMs);
        // Keep the older leg's upstream-source dataTimestamp for the "as of"
        // display line only.
        const fromDataMs = timestampSecondsToMs(fromQuote.dataTimestamp);
        const toDataMs = timestampSecondsToMs(toQuote.dataTimestamp);
        rateTimestamp.set(fromDataMs && toDataMs ? Math.min(fromDataMs, toDataMs) : 0);
        if (recordTimestampMs > 0) scheduleRateExpiry(recordTimestampMs);
        onFromAmountChange();
      } else {
        rateError.set(t("rateRefreshFailed"));
      }
    } catch (e) {
      console.warn("[useSwapEngine] exchange rate load failed:", e instanceof Error ? e.message : String(e));
      if (requestId === quoteRequestId) rateError.set(t("rateRefreshFailed"));
    } finally {
      if (requestId === quoteRequestId) rateLoading.set(false);
    }
  }

  function onFromAmountChange() {
    const ft = fromToken.get();
    const tt = toToken.get();
    const amountUnits = parseDecimalUnits(fromAmount.get(), ft.decimals);
    const exactFromPrice = safeUnits(fromPriceUnits.get());
    const exactToPrice = safeUnits(toPriceUnits.get());
    if (amountUnits === null || exactFromPrice <= 0n || exactToPrice <= 0n) {
      quotedOutputUnits.set("");
      toAmount.set("");
      return;
    }
    const outputUnits = quoteOutputUnits(
      amountUnits,
      ft.decimals,
      tt.decimals,
      exactFromPrice,
      exactToPrice,
    );
    quotedOutputUnits.set(outputUnits.toString());
    toAmount.set(formatUnits(outputUnits, tt.decimals));
  }

  function swapTokens() {
    isSwapping.set(true);
    const temp = fromToken.get();
    fromToken.set(toToken.get());
    toToken.set(temp);
    fromAmount.set("");
    clearQuote();
    if (!pendingTxid.get()) {
      transactionStatus.set("idle");
      transactionError.set("");
    }
    loadExchangeRate().catch(() => {});
    if (swapAnimTimer) clearTimeout(swapAnimTimer);
    swapAnimTimer = setTimeout(() => { isSwapping.set(false); swapAnimTimer = null; }, 300);
  }

  function openFromSelector() { selectorTarget.set("from"); showSelector.set(true); }
  function openToSelector() { selectorTarget.set("to"); showSelector.set(true); }
  function closeSelector() { showSelector.set(false); }

  function nativeSymbolOf(value: unknown): NativeTokenSymbol | null {
    const raw = typeof value === "object" && value !== null && "symbol" in value
      ? String((value as { symbol?: unknown }).symbol ?? "")
      : String(value ?? "");
    const normalized = raw.trim().toUpperCase();
    return normalized === "NEO" || normalized === "GAS" ? normalized : null;
  }

  function canonicalToken(symbol: NativeTokenSymbol): Token {
    return availableTokens.get().find((token) => token.symbol === symbol)
      ?? { ...(symbol === "NEO" ? NEO_TOKEN_TEMPLATE : GAS_TOKEN_TEMPLATE) };
  }

  function selectToken(token: unknown) {
    const symbol = nativeSymbolOf(token);
    if (!symbol) {
      closeSelector();
      return;
    }
    const selected = canonicalToken(symbol);
    if (selectorTarget.get() === "from") {
      if (selected.symbol === fromToken.get().symbol) {
        closeSelector();
        return;
      }
      if (selected.symbol === toToken.get().symbol) {
        closeSelector();
        swapTokens();
        return;
      }
      fromToken.set(selected);
    } else {
      if (selected.symbol === toToken.get().symbol) {
        closeSelector();
        return;
      }
      if (selected.symbol === fromToken.get().symbol) {
        closeSelector();
        swapTokens();
        return;
      }
      toToken.set(selected);
    }
    closeSelector();
    fromAmount.set("");
    clearQuote();
    loadExchangeRate().catch(() => {});
  }

  function selectPair(pairId: unknown): boolean {
    const normalized = String(pairId ?? "").trim().toLowerCase();
    const pair = POPULAR_PAIRS.find((candidate) => candidate.id === normalized);
    if (!pair) return false;
    const [fromSymbol, toSymbol] = pair.name.split("/") as [NativeTokenSymbol, NativeTokenSymbol];
    fromToken.set(canonicalToken(fromSymbol));
    toToken.set(canonicalToken(toSymbol));
    fromAmount.set("");
    clearQuote();
    loadExchangeRate().catch(() => {});
    return true;
  }

  async function executeSwap() {
    if (!canSwap.get() || loading.get()) return;
    loading.set(true);
    transactionStatus.set("signing");
    transactionError.set("");
    try {
      await chain.ensureWallet();
      const sender = chain.address.get();
      if (!sender || !balancesVerified.get()) throw new Error(t("balanceUnavailable"));
      if (!networkVerified.get()) throw new Error(t("walletNetworkMismatch", { network: quoteNetworkValue }));
      if (!settlementBinding || !routerAvailable.get()) throw new Error(t("swapRouterUnavailable"));
      const ft = fromToken.get();
      const tt = toToken.get();
      const amountUnits = parseDecimalUnits(fromAmount.get(), ft.decimals);
      if (amountUnits === null) {
        throw new Error(ft.decimals === 0 ? t("neoIntegerOnly") : t("invalidAmount"));
      }
      if (amountUnits > safeUnits(ft.balanceUnits)) throw new Error(t("insufficientBalance"));
      const amountInt = amountUnits.toString();
      const outInt = safeUnits(quotedOutputUnits.get());
      const minOutputBig = applySlippageFloor(outInt, slippageBps.get());
      if (minOutputBig <= 0n) throw new Error(t("invalidAmount"));
      const minOutputInt = minOutputBig.toString();
      const routerAddress = contractAddress.get();
      if (!routerAddress) throw new Error(t("swapRouterUnavailable"));
      if (rateStale.get()) throw new Error(t("rateStale"));
      const liveNetwork = normalizeSwapNetwork(await app.chain.detectNetwork());
      if (
        liveNetwork !== quoteNetworkValue
        || chain.address.get() !== sender
        || liveNetwork !== settlementBinding.network
      ) {
        balanceOwner.set("");
        walletNetwork.set("");
        throw new Error(t("walletNetworkMismatch", { network: quoteNetworkValue }));
      }

      const pendingBase: Omit<PendingSwapRecord, "txid" | "submittedAt"> = {
        version: 1,
        network: settlementBinding.network,
        wallet: sender,
        router: settlementBinding.scriptHash,
        fromHash: normalizeScriptHash(ft.hash),
        toHash: normalizeScriptHash(tt.hash),
        amountIn: amountInt,
        minOutput: minOutputInt,
      };

      const deadline = Math.floor(Date.now() / 1000) + SWAP_DEADLINE_SECONDS;
      // The swap path is a Hash160[] of the in/out token script hashes, wrapped
      // as an Array arg. arg.array is natively typed for nested args, so the
      // previous `as unknown as` cast around the Array value is no longer needed.
      const path = app.chain.arg.array([
        app.chain.arg.hash160(ft.hash),
        app.chain.arg.hash160(tt.hash),
      ]);

      const result = await chain.invoke(settlementBinding.operation, [
        app.chain.arg.hash160(sender),
        app.chain.arg.integer(amountInt),
        app.chain.arg.integer(minOutputInt),
        path,
        app.chain.arg.integer(deadline),
      ], {
        scriptHash: routerAddress,
        waitForEvent: settlementBinding.confirmationEvent,
        waitTimeoutMs: 60_000,
        onTransactionSent: (txid) => {
          if (!/^0x[0-9a-f]{64}$/i.test(txid)) return;
          persistPendingSwap({ ...pendingBase, txid, submittedAt: Date.now() });
        },
      });

      // A broadcast is not a completed swap. The exact transaction-scoped
      // event must also bind the wallet, pair and integer amount intent.
      const confirmationMatches = Boolean(
        result.verified === true
        && /^0x[0-9a-f]{64}$/i.test(result.txid)
        && settlementBinding.validateConfirmation(result.event, {
          txid: result.txid,
          wallet: sender,
          fromHash: pendingBase.fromHash,
          toHash: pendingBase.toHash,
          amountIn: amountInt,
          minOutput: minOutputInt,
        }),
      );
      if (!confirmationMatches) {
        if (/^0x[0-9a-f]{64}$/i.test(result.txid) && !pendingTxid.get()) {
          persistPendingSwap({ ...pendingBase, txid: result.txid, submittedAt: Date.now() });
        }
        transactionStatus.set("unverified");
        transactionError.set(t("swapConfirmationPending"));
        throw new Error(t("swapConfirmationPending"));
      }

      // The legacy swap:success / swap:error eventBus emits were dead channels
      // (no subscriber anywhere) — deleted per the extraction plan, not
      // migrated. Success/error toasts come from the notify.guard wrapper in
      // main.tsx, exactly as before.
      fromAmount.set("");
      toAmount.set("");
      clearPendingSwap();
      transactionStatus.set("confirmed");
      await refreshBalances();
    } catch (error) {
      if (pendingTxid.get()) {
        transactionStatus.set("unverified");
        transactionError.set(t("swapConfirmationPending"));
      } else {
        transactionStatus.set("failed");
        transactionError.set(t("swapFailedRecoveryHint"));
        console.warn("[useSwapEngine] swap submission failed:", error instanceof Error ? error.message : String(error));
      }
      throw error;
    } finally {
      loading.set(false);
    }
  }

  async function recoverPendingSwap(): Promise<boolean> {
    if (recovering.get()) return false;
    const record = readPendingSwap();
    if (!record || !settlementBinding || !routerAvailable.get()) {
      pendingTxid.set("");
      transactionStatus.set("idle");
      return false;
    }
    recovering.set(true);
    transactionStatus.set("pending");
    transactionError.set("");
    try {
      const recoveryNetwork = normalizeSwapNetwork(await app.chain.detectNetwork());
      if (
        recoveryNetwork !== record.network
        || chain.address.get()?.trim().toLowerCase() !== record.wallet.trim().toLowerCase()
      ) {
        transactionStatus.set("unverified");
        transactionError.set(t("walletNetworkMismatch", { network: record.network }));
        return false;
      }
      const event = await app.events.waitFor(
        record.txid,
        settlementBinding.confirmationEvent,
        45_000,
      );
      const networkAfterWait = normalizeSwapNetwork(await app.chain.detectNetwork());
      const stillSameWallet = chain.address.get()?.trim().toLowerCase() === record.wallet.trim().toLowerCase();
      const confirmationMatches = Boolean(
        event
        && stillSameWallet
        && networkAfterWait === record.network
        && settlementBinding.validateConfirmation(event, {
          txid: record.txid,
          wallet: record.wallet,
          fromHash: record.fromHash,
          toHash: record.toHash,
          amountIn: record.amountIn,
          minOutput: record.minOutput,
        }),
      );
      if (!confirmationMatches) {
        transactionStatus.set("unverified");
        transactionError.set(t("swapStillPending"));
        return false;
      }
      app.storage.local.delete(pendingStorageKey(record.network, record.wallet));
      pendingTxid.set("");
      transactionStatus.set("confirmed");
      fromAmount.set("");
      quotedOutputUnits.set("");
      toAmount.set("");
      await refreshBalances();
      return true;
    } catch (error) {
      transactionStatus.set("unverified");
      transactionError.set(t("swapRecoveryFailed"));
      console.warn("[useSwapEngine] pending swap recovery failed:", error instanceof Error ? error.message : String(error));
      return false;
    } finally {
      recovering.set(false);
    }
  }

  const unsubscribeWallet = chain.address.subscribe(() => {
    balanceRequestId += 1;
    balanceLoading.set(false);
    balanceOwner.set("");
    walletNetwork.set("");
    networkError.set("");
    pendingTxid.set("");
    applyTokenBalances(0n, 0n);
    transactionStatus.set("idle");
    transactionError.set("");
    if (chain.address.get()) void refreshBalances();
  });

  const loadAll = async () => { await Promise.all([refreshBalances(), loadExchangeRate()]); };
  const cleanup = () => {
    quoteRequestId += 1;
    balanceRequestId += 1;
    clearRateExpiryTimer();
    rateLoading.set(false);
    balanceLoading.set(false);
    recovering.set(false);
    unsubscribeWallet();
    if (swapAnimTimer) { clearTimeout(swapAnimTimer); swapAnimTimer = null; }
  };

  return {
    fromToken, toToken, fromAmount, toAmount, exchangeRate, rateError, rateLoading, balanceLoading, loading,
    showSelector, selectorTarget, isSwapping, availableTokens, canSwap,
    swapButtonText, amountError, slippage, slippageValue, minReceived, selectedPairDisplay, pairCount, currentRate,
    routerAvailable, rateStale, rateAsOf, walletConnected, balancesVerified,
    quoteNetwork, walletNetwork, networkVerified, networkError,
    transactionStatus, pendingTxid, transactionError, recovering,
    setSlippage, setMaxAmount, setFromAmount, loadExchangeRate,
    swapTokens, openFromSelector, openToSelector, closeSelector, selectToken, selectPair,
    executeSwap, recoverPendingSwap, refreshBalances, loadAll, cleanup,
  };
}
