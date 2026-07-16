/**
 * PlayArea.tsx - Neo Treasury (v2 scene-driven rebuild)
 *
 * DeFi/tool identity (bright Neo green + warm gold, clean/trustworthy). The
 * dashboard IS the scene: public Mainnet balances and allocation lead, while
 * the connected-wallet transfer route remains a compact, clearly separate
 * action. Watchlist details, policy, and payout editing stay in the drawer.
 */
import { useEffect, useState } from "react";
import type { PlayAreaProps } from "@shared/react/defineMiniApp";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import { getLaunchParam } from "@shared/utils/launch-params";
import { DA_HONGFEI_ADDRESSES, ERIK_ZHANG_ADDRESSES, WATCHLIST_REFERENCE_URL } from "./utils/treasury";
import {
  buildTreasuryDisbursementPreview,
  formatTreasuryOperationError,
  normalizeTreasuryNetwork,
  TREASURY_INPUT_LIMITS,
  TreasuryOperationError,
  type PendingTreasuryTransfer,
  type TreasuryAsset,
  type TreasuryDisbursementPreview,
  type TreasuryNetwork,
  type TreasuryTransferIntent,
} from "./utils/treasuryOperations";
import { CoinArt } from "@shared/art";
import {
  OpenUiLiteProvider as OpenUiProvider,
  OpenUiLiteSegmented as OpenUiSegmented,
  OpenUiLiteTextField as OpenUiTextField,
} from "@shared/components-react/v2/OpenUiLite";
import { PlayStage } from "@shared/components-react/v2/PlayStage";
import { CircleAlert, FileSignature, RefreshCw, Send, ShieldCheck, WalletCards } from "lucide-react";
import "./PlayArea.scss";

interface TreasuryData {
  totalUsd: number | null;
  totalNeo: number;
  totalGas: number;
  totalNeoDisplay?: string;
  totalGasDisplay?: string;
  lastUpdated: number | string;
  prices: Record<string, unknown> | null;
  priceStale?: boolean;
  failedCount?: number;
  categories: Array<{
    name: string;
    failedCount?: number;
    totalUsd?: number | null;
    totalNeoDisplay?: string;
    totalGasDisplay?: string;
    wallets?: Array<{
      address?: string;
      label?: string;
      neo?: number;
      gas?: number;
      neoDisplay?: string;
      gasDisplay?: string;
      failed?: boolean;
    }>;
    [key: string]: unknown;
  }>;
}

function formatNumber(value: unknown, maximumFractionDigits = 2) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString(undefined, { maximumFractionDigits });
}
function formatLastUpdated(value: number | string | undefined) {
  if (!value) return "";
  if (typeof value === "string") return value;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString();
}
function resolveTreasuryNetwork(value: unknown): TreasuryNetwork | null {
  try {
    return normalizeTreasuryNetwork(value);
  } catch {
    return null;
  }
}

/*
 * NOTE on the payout network's three subjects, which this surface used to blur
 * into one word and so contradicted itself on first paint:
 *
 *   - the PAYOUT network — bound by the launch context, resolved here. Null
 *     means the host bound no usable Neo N3 network (absent or unrecognised —
 *     `parseMiniAppLaunchContext` already collapses both to null upstream, so
 *     the two are genuinely indistinguishable at this layer). Payouts fail
 *     closed in that state, deliberately.
 *   - the WALLET network — checked at signing time by
 *     `assertTreasuryWalletNetwork`. Only meaningful once a wallet exists.
 *   - the WATCHLIST — a public read of known mainnet addresses over a fixed
 *     RPC. Independent of both, and honestly live on first paint.
 *
 * Copy on each must name its own subject.
 */
function formatValuation(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount)
    ? `$${amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
    : "—";
}
function compactAddress(address: string) {
  return address.length <= 16 ? address : `${address.slice(0, 7)}…${address.slice(-6)}`;
}
function compactTxid(txid: string) {
  return txid.length > 18 ? `${txid.slice(0, 10)}…${txid.slice(-8)}` : txid;
}
const AMOUNT_PRESETS: Record<TreasuryAsset, string[]> = {
  GAS: ["0.1", "1", "5"],
  NEO: ["1", "5", "10"],
};
const TREASURY_VAULT_ART = "treasury-vault-desk.webp";
const INITIAL_LOAD_WARNING_MS = 10_000;
type DrawerMode = "payout" | "watchlist" | "policy";

function normalizeAmountInput(value: string) {
  const decimalNormalized = value.replace(/,/g, ".");
  const sanitized = decimalNormalized.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1");
  // Keep a pasted fractional NEO value visible so validation can explain it;
  // silently truncating 2.9 to 2 changes financial intent without consent.
  return sanitized;
}

function boundLaunchValue(value: string, maxLength: number) {
  return value.length > maxLength ? value.slice(0, maxLength + 1) : value;
}

export default function PlayArea({ t, state, dispatch, launchContext, setStatus }: PlayAreaProps) {
  const { bool, str, val } = useStateBindings(state);
  const data = val<TreasuryData>("data");
  const loading = bool("loading");
  const stale = bool("stale");
  const error = str("error");
  const address = str("address");
  const disbursementSubmitting = bool("disbursementSubmitting");
  const disbursementError = str("disbursementError");
  const lastTxid = str("lastTxid");
  const pendingTransfer = val<PendingTreasuryTransfer | null>("pendingTransfer");
  const lastIntent = val<TreasuryTransferIntent | null>("lastIntent");
  const confirmationChecking = bool("confirmationChecking");
  const settlementStatus = str("settlementStatus", "idle");
  const settlementMessage = str("settlementMessage");
  // These read-outs hold `undefined` until the watchlist sweep lands (see
  // main.tsx). The token chips render their value unconditionally, so they take
  // the same "Reading…" copy the chrome's manifest bindings declare — a chip
  // reading "NEO —" claims a balance was read and found absent.
  //
  // `totalUsdDisplay` deliberately takes NO fallback: the gauge below switches
  // on whether it holds a value, and an empty string routes it to the honest
  // "Live balance status · NEO / GAS" label rather than captioning the pending
  // copy as an "Estimated watchlist value".
  const totalUsdDisplay = str("totalUsdDisplay");
  const totalNeoDisplay = str("totalNeoDisplay", t("treasuryStatAwaitingRead"));
  const totalGasDisplay = str("totalGasDisplay", t("treasuryStatAwaitingRead"));

  const hasLiveData = Boolean(data);
  const isBalanceStale = hasLiveData && stale;
  const isPriceDelayed = hasLiveData && Boolean(data?.priceStale);
  const failedCount = Number(data?.failedCount ?? 0);
  const priceFeedDown = hasLiveData && data?.totalUsd == null;
  const hasUsdValue = !priceFeedDown && Boolean(totalUsdDisplay.trim());
  const watchedAddressCount = DA_HONGFEI_ADDRESSES.length + ERIK_ZHANG_ADDRESSES.length;
  const lastUpdated = formatLastUpdated(data?.lastUpdated);
  const signalLabel = isBalanceStale ? t("treasuryStale") : hasLiveData ? t("treasuryLiveSynced") : loading ? t("treasuryLiveLoading") : t("treasuryLivePending");
  const sceneGaugeLabel = hasUsdValue ? t("treasuryEstimatedValue") : t("treasuryLiveStatus");
  const sceneGaugeValue = hasUsdValue ? totalUsdDisplay : `${t("tokenNeo")} / ${t("tokenGas")}`;
  const payoutNetwork = resolveTreasuryNetwork(launchContext.network);
  const networkLabel = payoutNetwork === "testnet"
    ? t("networkTestnet")
    : payoutNetwork === "mainnet"
      ? t("networkMainnet")
      : t("payoutNetworkUnverified");
  const priceRecordTimestamp = Number(data?.prices?.feedRecordTimestamp ?? 0);
  const priceRecordLabel = priceRecordTimestamp > 0 ? formatLastUpdated(priceRecordTimestamp) : "";
  const priceStatus = priceFeedDown ? "unavailable" : isPriceDelayed ? "delayed" : hasUsdValue ? "fresh" : "pending";
  const priceStatusLabel = priceFeedDown
    ? t("treasuryPriceUnavailableShort")
    : isPriceDelayed
      ? t("treasuryPriceDelayed")
      : hasUsdValue
        ? t("treasuryPriceFresh")
        : t("treasuryLivePending");
  const allocationRows = data?.categories ?? [];
  const launchParams = launchContext.params;

  const [asset, setAsset] = useState<TreasuryAsset>("GAS");
  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState("");
  const [memo, setMemo] = useState("");
  const [drawerMode, setDrawerMode] = useState<DrawerMode>("payout");
  const [initialLoadTimedOut, setInitialLoadTimedOut] = useState(false);

  useEffect(() => {
    const launchParamContext = { params: launchParams };
    const launchedAsset = getLaunchParam(launchParamContext, ["asset", "token"], "GAS").toUpperCase();
    const nextAsset = launchedAsset === "NEO" ? "NEO" : "GAS";
    setAsset(nextAsset);
    setAmount(boundLaunchValue(
      normalizeAmountInput(getLaunchParam(launchParamContext, ["amount", "value", "total"], "")),
      TREASURY_INPUT_LIMITS.amount,
    ));
    setRecipient(boundLaunchValue(
      getLaunchParam(launchParamContext, ["recipient", "to", "address"], ""),
      TREASURY_INPUT_LIMITS.address,
    ));
    setMemo(boundLaunchValue(
      getLaunchParam(launchParamContext, ["memo", "note", "purpose"], ""),
      TREASURY_INPUT_LIMITS.memo,
    ));
  }, [launchParams]);

  useEffect(() => {
    if (hasLiveData || !loading) {
      setInitialLoadTimedOut(false);
      return undefined;
    }
    const timer = window.setTimeout(() => setInitialLoadTimedOut(true), INITIAL_LOAD_WARNING_MS);
    return () => window.clearTimeout(timer);
  }, [hasLiveData, loading]);

  const selectAsset = (nextAsset: TreasuryAsset) => {
    setAsset(nextAsset);
    setAmount((value) => normalizeAmountInput(value));
  };
  const selectAssetSafe = (value: string) => {
    if (value === "GAS" || value === "NEO") {
      selectAsset(value);
    }
  };
  const setDrawerModeSafe = (value: string) => {
    if (value === "payout" || value === "watchlist" || value === "policy") {
      setDrawerMode(value);
    }
  };

  const hasDraftFields = Boolean(amount.trim() && recipient.trim());
  const hasAnyDraftField = Boolean(amount.trim() || recipient.trim() || memo.trim());
  const draftReview: { preview: TreasuryDisbursementPreview | null; error: string; errorKey: string } = (() => {
    if (!hasDraftFields) return { preview: null, error: "", errorKey: "" };
    try {
      return { preview: buildTreasuryDisbursementPreview({ asset, amount, recipient, memo }, address || undefined), error: "", errorKey: "" };
    } catch (e) {
      return {
        preview: null,
        error: formatTreasuryOperationError(e, t),
        errorKey: e instanceof TreasuryOperationError ? e.messageKey : "",
      };
    }
  })();
  const amountInvalid = [
    "treasuryErrorAsset",
    "treasuryErrorAmountNumber",
    "treasuryErrorNeoWhole",
    "treasuryErrorGasDecimals",
    "treasuryErrorAmountPositive",
  ].includes(draftReview.errorKey);
  const recipientInvalid = ["treasuryErrorRecipient", "treasuryErrorSelfTransfer"].includes(draftReview.errorKey);
  const hasPendingTransfer = Boolean(pendingTransfer);
  const controlsLocked = disbursementSubmitting || confirmationChecking || hasPendingTransfer;
  const submitDisabled = controlsLocked || !payoutNetwork || !amount.trim() || !recipient.trim();
  const submitBlocked = submitDisabled || Boolean(draftReview.error);
  const draftReady = Boolean(draftReview.preview);
  const confirmedDraftMatches = Boolean(
    settlementStatus === "confirmed" &&
    lastIntent &&
    draftReview.preview &&
    lastIntent.asset === draftReview.preview.asset &&
    lastIntent.scaledAmount === draftReview.preview.scaledAmount &&
    lastIntent.recipientHash === draftReview.preview.recipientHash &&
    lastIntent.senderHash === draftReview.preview.senderHash &&
    lastIntent.memo === draftReview.preview.memo,
  );
  const showConfirmedSettlement = settlementStatus === "confirmed" && Boolean(lastIntent) && (
    !hasAnyDraftField || confirmedDraftMatches
  );
  const presentedSettlementStatus = settlementStatus === "confirmed" && !showConfirmedSettlement
    ? "idle"
    : settlementStatus;
  const presentedSettlementMessage = presentedSettlementStatus === "idle" ? "" : settlementMessage;
  const settledDisplayIntent = pendingTransfer ?? (showConfirmedSettlement ? lastIntent : null);
  const displayAsset = settledDisplayIntent?.asset ?? asset;
  const displayAmount = settledDisplayIntent?.amount ?? amount;
  const displayRecipientHash = settledDisplayIntent?.recipientHash ?? draftReview.preview?.recipientHash;
  const displaySenderHash = settledDisplayIntent?.senderHash ?? (address ? draftReview.preview?.senderHash : undefined);
  const hasAmount = Boolean(displayAmount.trim());
  const hasRecipient = Boolean(pendingTransfer?.recipientHash || recipient.trim());
  const ticketState = presentedSettlementStatus === "confirmed"
    ? "confirmed"
    : presentedSettlementStatus === "binding-mismatch"
      ? "error"
      : confirmationChecking || hasPendingTransfer
        ? "pending"
        : disbursementSubmitting
    ? "signing"
    : draftReview.error
      ? "error"
      : draftReady
        ? "ready"
        : hasDraftFields
          ? "draft"
          : "idle";
  const activeAssetIcon = displayAsset.toLowerCase() as "gas" | "neo";
  const payoutStatus = presentedSettlementMessage || (draftReview.error
    ? t("treasuryFlowError")
    : disbursementSubmitting
      ? t("treasuryFlowSigning")
      : draftReady
        ? t("treasuryFlowReady")
        : hasDraftFields
          ? t("treasuryFlowDraft")
          : t("walletRequired"));
  const draftAmountLabel = hasAmount ? `${displayAmount} ${displayAsset}` : t("amount");
  const draftRecipientLabel = displayRecipientHash ? compactTxid(displayRecipientHash) : hasRecipient ? compactAddress(recipient) : t("recipient");
  const balanceStatusNotice = error
    ? error
    : initialLoadTimedOut
      ? `${t("treasuryLoadTimeout")} ${t("treasuryLoadTimeoutHint")}`
      : !hasLiveData && loading
        ? t("treasuryLiveLoading")
        : "";
  const drawerModes = [
    { mode: "payout" as const, label: t("disbursementTitle") },
    { mode: "watchlist" as const, label: t("treasuryWatchlist"), count: watchedAddressCount },
    { mode: "policy" as const, label: t("policyTitle") },
  ];

  const dispatchSafely = async (name: string, ...args: unknown[]) => {
    try {
      return await dispatch(name, ...args);
    } catch {
      // Actions already publish localized status. Prevent rejected embedded
      // dispatches from becoming unhandled promise rejections in the host.
      return undefined;
    }
  };

  const handleSubmit = async () => {
    if (hasPendingTransfer) {
      await dispatchSafely("recoverDisbursement");
      return;
    }
    // Deliberate fail-closed posture for a money app: an unresolved payout
    // network stops the flow before it starts, rather than letting a visitor
    // build a ticket that can never be signed. Only the message changes here —
    // it names the launch, which is the thing that is actually unresolved.
    if (!address) {
      if (!payoutNetwork) {
        setStatus?.(t("treasuryErrorPayoutNetworkUnverified"), "error");
        return;
      }
      await dispatchSafely("connectWallet");
      return;
    }
    if (!payoutNetwork) {
      setStatus?.(t("treasuryErrorPayoutNetworkUnverified"), "error");
      return;
    }
    if (submitBlocked) {
      if (draftReview.error) setStatus?.(draftReview.error, "error");
      return;
    }
    await dispatchSafely("submitDisbursement", { asset, amount: normalizeAmountInput(amount).trim(), recipient: recipient.trim(), memo: memo.trim() });
  };

  const scene = (
    <div className="treasury-workspace" data-state={ticketState}>
      <section className="treasury-ticket" data-state={ticketState} aria-label={t("intentTitle")}>
        <header className="treasury-ticket__head">
          <span className="treasury-ticket__icon" aria-hidden="true">
            <FileSignature size={18} strokeWidth={2.25} />
          </span>
          <div>
            <span>{t("intentTitle")}</span>
            <strong>{draftReady ? t("intentReady") : t("intentWaiting")}</strong>
          </div>
          <em>{payoutStatus}</em>
        </header>

        <div className="treasury-ticket__flow" aria-label={t("treasuryFlowChecks")}>
          <div className="treasury-ticket__node" data-ready={displaySenderHash || address ? "true" : undefined}>
            <WalletCards size={17} strokeWidth={2.25} aria-hidden="true" />
            <span>{t("treasuryFlowSource")}</span>
            <strong>{displaySenderHash ? compactTxid(displaySenderHash) : address ? compactAddress(address) : t("walletRequired")}</strong>
          </div>
          <div className="treasury-ticket__rail" aria-hidden="true">
            <span />
            <CoinArt size={24} variant={activeAssetIcon} className={disbursementSubmitting ? "treasury-ticket__rail-coin is-moving" : "treasury-ticket__rail-coin"} decorative />
            <span />
          </div>
          <div className="treasury-ticket__node" data-ready={displayRecipientHash ? "true" : undefined}>
            <Send size={17} strokeWidth={2.25} aria-hidden="true" />
            <span>{t("treasuryFlowRecipient")}</span>
            <strong>{displayRecipientHash ? compactTxid(displayRecipientHash) : t("treasuryFlowDraft")}</strong>
          </div>
        </div>

        <div className="treasury-ticket__summary-grid" aria-label={t("intentTitle")}>
          <div
            className="treasury-ticket__summary-card"
            data-ready={hasAmount ? "true" : undefined}
          >
            <span><CoinArt size={18} variant={activeAssetIcon} decorative /> {t("amount")}</span>
            <strong>{draftAmountLabel}</strong>
            <small>{displayAsset === "NEO" ? t("assetNeoMeta") : t("assetGasMeta")}</small>
          </div>
          <div
            className="treasury-ticket__summary-card"
            data-ready={hasRecipient && !draftReview.error ? "true" : undefined}
          >
            <span><Send size={15} strokeWidth={2.25} aria-hidden="true" /> {t("recipient")}</span>
            <strong>{draftRecipientLabel}</strong>
            <small>{displayRecipientHash ? t("intentRecipientHash") : t("recipientCaption")}</small>
          </div>
        </div>

        <div className="treasury-ticket__route" aria-label={t("treasuryFlowChecks")}>
          <span data-ready={hasAmount ? "true" : undefined}><ShieldCheck size={14} strokeWidth={2.25} /> {displayAsset}</span>
          <span data-ready={displayRecipientHash ? "true" : undefined}><Send size={14} strokeWidth={2.25} /> {displayRecipientHash ? compactTxid(displayRecipientHash) : t("treasuryFlowRecipient")}</span>
          <span data-ready={displaySenderHash || address ? "true" : undefined}><WalletCards size={14} strokeWidth={2.25} /> {displaySenderHash || address ? t("walletConnected") : t("walletRequired")}</span>
        </div>

        {(pendingTransfer || presentedSettlementStatus === "confirmed") && (
          <section className="treasury-settlement" data-status={presentedSettlementStatus} role="status" aria-live="polite">
            <div className="treasury-settlement__head">
              <span aria-hidden="true">
                {confirmationChecking ? <RefreshCw size={17} className="is-spinning" /> : <ShieldCheck size={17} />}
              </span>
              <div>
                <strong>{presentedSettlementStatus === "confirmed" ? t("disbursementConfirmedTitle") : t("disbursementPendingTitle")}</strong>
                <small>{presentedSettlementMessage}</small>
              </div>
            </div>
            {settledDisplayIntent && (
              <div className="treasury-settlement__binding" aria-label={t("intentExactBinding")}>
                <span><em>{t("network")}</em><strong>{settledDisplayIntent.network === "testnet" ? t("networkTestnet") : t("networkMainnet")}</strong></span>
                <span><em>{t("amount")}</em><strong>{settledDisplayIntent.amount} {settledDisplayIntent.asset}</strong></span>
                <span><em>{t("intentContract")}</em><code>{compactTxid(settledDisplayIntent.scriptHash)}</code></span>
                <span><em>{t("lastTx")}</em><code>{compactTxid(pendingTransfer?.txid ?? lastTxid)}</code></span>
              </div>
            )}
          </section>
        )}

        {(draftReview.error || disbursementError) && (
          <p className="treasury-ticket__error" role="alert">
            <CircleAlert size={15} strokeWidth={2.25} aria-hidden="true" />
            {draftReview.error || disbursementError}
          </p>
        )}
        {/* An unresolved payout network is a launch-configuration precondition,
            not a runtime failure and not something the visitor did — on a cold
            visit there is no wallet, so there is no "wallet network" to have
            failed verification. Payouts still fail closed (the badge says so
            and submit is blocked); this states which step is outstanding, in
            the neutral tone the fact deserves, and says plainly that it does
            not contradict the live watchlist above it. */}
        {!payoutNetwork && !draftReview.error && !disbursementError && (
          <p className="treasury-ticket__note">{t("treasuryPayoutNetworkHint")}</p>
        )}
        {lastTxid && !pendingTransfer && presentedSettlementStatus !== "confirmed" && <p className="treasury-ticket__tx">{t("lastTx")}: <code>{compactTxid(lastTxid)}</code></p>}
      </section>

      <aside className="treasury-scene" data-state={isBalanceStale ? "stale" : hasLiveData ? "live" : "loading"} aria-label={t("treasuryLiveStatus")}>
        <div className="treasury-scene__pulse" data-stale={isBalanceStale ? "true" : undefined}>
          <span className="treasury-scene__pulse-dot" />
          <span className="treasury-scene__pulse-label">{t("watchlistMainnetBadge")} · {signalLabel}</span>
        </div>
        <div className="treasury-scene__art" aria-hidden="true">
          <img src={TREASURY_VAULT_ART} alt="" loading="eager" decoding="async" />
        </div>
        <div className="treasury-scene__gauge">
          <CoinArt size={34} variant="gas" className="mx2-float" decorative />
          <div>
            <span>{sceneGaugeLabel}</span>
            <strong className="treasury-scene__gauge-usd">{sceneGaugeValue}</strong>
          </div>
        </div>
        <div className="treasury-scene__tokens">
          <span className="treasury-scene__token" title={`${totalNeoDisplay} NEO`}><CoinArt size={18} variant="neo" decorative /> {t("tokenNeo")} <strong>{totalNeoDisplay}</strong></span>
          <span className="treasury-scene__token" title={`${totalGasDisplay} GAS`}><CoinArt size={18} variant="gas" decorative /> {t("tokenGas")} <strong>{totalGasDisplay}</strong></span>
        </div>
        <section className="treasury-allocation" aria-label={t("treasuryAllocationTitle")}>
          <header>
            <div>
              <strong>{t("treasuryAllocationTitle")}</strong>
              <span>{t("treasuryAllocationCaption")}</span>
            </div>
            {failedCount > 0 && <em>{t("treasuryPartialTotals")}</em>}
          </header>
          <div className="treasury-allocation__rows">
            {allocationRows.length > 0 ? allocationRows.map((category) => {
              const categoryUsd = typeof category.totalUsd === "number" ? category.totalUsd : null;
              const share = categoryUsd != null && typeof data?.totalUsd === "number" && data.totalUsd > 0
                ? Math.max(0, Math.min(100, (categoryUsd / data.totalUsd) * 100))
                : null;
              const categoryNeo = category.wallets?.reduce((sum, wallet) => sum + (wallet.failed ? 0 : Number(wallet.neo ?? 0)), 0) ?? 0;
              const categoryGas = category.wallets?.reduce((sum, wallet) => sum + (wallet.failed ? 0 : Number(wallet.gas ?? 0)), 0) ?? 0;
              const categoryNeoDisplay = category.totalNeoDisplay ?? categoryNeo.toLocaleString(undefined, { maximumFractionDigits: 2 });
              const categoryGasDisplay = category.totalGasDisplay ?? categoryGas.toLocaleString(undefined, { maximumFractionDigits: 2 });
              return (
                <div key={category.name} className="treasury-allocation__row">
                  <div className="treasury-allocation__label">
                    <strong>{category.name}</strong>
                    <span title={`${categoryNeoDisplay} NEO · ${categoryGasDisplay} GAS`}>{categoryNeoDisplay} NEO · {categoryGasDisplay} GAS</span>
                  </div>
                  <div className="treasury-allocation__value">
                    <strong>{categoryUsd == null ? "—" : formatValuation(categoryUsd)}</strong>
                    <span>{share == null ? t("treasuryNativeOnly") : `${share.toFixed(1)}%`}</span>
                  </div>
                  <span className="treasury-allocation__track" aria-hidden="true">
                    <span style={{ width: `${share ?? 0}%` }} />
                  </span>
                </div>
              );
            }) : (
              <p className="treasury-allocation__empty">{t("treasuryLiveLoading")}</p>
            )}
          </div>
        </section>
        <div className="treasury-price-status" data-status={priceStatus}>
          <span className="treasury-price-status__dot" aria-hidden="true" />
          <div>
            <strong>{priceStatusLabel}</strong>
            <small>{priceRecordLabel ? `${t("treasuryPriceRecord")}: ${priceRecordLabel}` : t("priceFeedSourceNote")}</small>
          </div>
          {lastUpdated && <time>{t("treasuryBalancesReadAt")}: {lastUpdated}</time>}
        </div>
        {(failedCount > 0 || priceFeedDown || balanceStatusNotice) && (
          <p className="treasury-scene__notice" role="status">
            {balanceStatusNotice}
            {balanceStatusNotice && (failedCount > 0 || priceFeedDown) && " · "}
            {failedCount > 0 && `${failedCount} ${t("treasuryWalletsUnreachable").toLowerCase()} · ${t("treasuryPartialTotals")}`}
            {failedCount > 0 && priceFeedDown && " · "}
            {priceFeedDown && t("treasuryPriceFeedUnavailable")}
          </p>
        )}
      </aside>
    </div>
  );

  const payoutPanel = pendingTransfer ? (
    <div className="treasury-drawer__recovery" role="status">
      <div className="treasury-drawer__recovery-head">
        <ShieldCheck size={18} aria-hidden="true" />
        <div>
          <strong>{t("disbursementPendingTitle")}</strong>
          <span>{settlementMessage || t("disbursementConfirmationPending")}</span>
        </div>
      </div>
      <dl>
        <div><dt>{t("network")}</dt><dd>{pendingTransfer.network === "testnet" ? t("networkTestnet") : t("networkMainnet")}</dd></div>
        <div><dt>{t("asset")}</dt><dd><CoinArt size={18} variant={pendingTransfer.asset.toLowerCase() as "gas" | "neo"} decorative /> {pendingTransfer.asset}</dd></div>
        <div><dt>{t("amount")}</dt><dd>{pendingTransfer.amount} {pendingTransfer.asset}</dd></div>
        <div><dt>{t("intentContract")}</dt><dd><code>{pendingTransfer.scriptHash}</code></dd></div>
        <div><dt>{t("intentSigner")}</dt><dd><code>{pendingTransfer.senderHash}</code></dd></div>
        <div><dt>{t("recipient")}</dt><dd><code>{pendingTransfer.recipientHash}</code></dd></div>
        <div><dt>{t("lastTx")}</dt><dd><code>{pendingTransfer.txid}</code></dd></div>
      </dl>
      <p>{t("pendingNoRebroadcast")}</p>
    </div>
  ) : (
    <div className="treasury-drawer__payout">
      <div className="treasury-ticket__amount" data-ready={hasAmount ? "true" : undefined}>
        <div className="treasury-ticket__amount-head">
          <span>{t("amount")}</span>
          <OpenUiSegmented
            className="treasury-ticket__asset"
            segmentedClassName="treasury-ticket__asset-group"
            label={t("asset")}
            value={asset}
            onChange={selectAssetSafe}
            options={(["GAS", "NEO"] as const).map((a) => ({
              value: a,
              disabled: controlsLocked,
              label: (
                <span className="treasury-asset-option">
                  <CoinArt size={18} variant={a.toLowerCase() as "gas" | "neo"} decorative />
                  {a}
                </span>
              ),
            }))}
          />
        </div>
        <div className="treasury-ticket__amount-input">
          <CoinArt size={34} variant={activeAssetIcon} decorative />
          <OpenUiTextField
            className="treasury-amount-field"
            inputClassName="treasury-input-control treasury-input-control--amount"
            label={t("amount")}
            value={amount}
            onChange={(e) => setAmount(normalizeAmountInput(e.target.value))}
            placeholder={asset === "NEO" ? "1" : "0.00"}
            inputMode={asset === "NEO" ? "numeric" : "decimal"}
            maxLength={TREASURY_INPUT_LIMITS.amount}
            disabled={controlsLocked}
            aria-invalid={amountInvalid || undefined}
            hint={amountInvalid ? draftReview.error : undefined}
          />
        </div>
        <OpenUiSegmented
          className="treasury-ticket__presets"
          segmentedClassName="treasury-ticket__presets-group"
          label={t("amountPresets")}
          value={AMOUNT_PRESETS[asset].includes(amount) ? amount : ""}
          onChange={(value) => setAmount(normalizeAmountInput(value))}
          options={AMOUNT_PRESETS[asset].map((preset) => ({
            value: preset,
            disabled: controlsLocked,
            label: <span className="treasury-preset-option">{preset}</span>,
          }))}
        />
      </div>

      <div className="treasury-ticket__recipient" data-ready={hasRecipient && !draftReview.error ? "true" : undefined}>
        <span><Send size={15} strokeWidth={2.25} aria-hidden="true" /> {t("recipient")}</span>
        <OpenUiTextField
          className="treasury-recipient-field"
          inputClassName="treasury-input-control treasury-input-control--recipient"
          label={t("recipient")}
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          placeholder="N..."
          spellCheck={false}
          maxLength={TREASURY_INPUT_LIMITS.address}
          disabled={controlsLocked}
          mono
          aria-invalid={recipientInvalid || undefined}
          hint={recipientInvalid ? draftReview.error : undefined}
        />
        <small>{draftReview.preview ? compactTxid(draftReview.preview.recipientHash) : t("recipientCaption")}</small>
      </div>

      <details className="treasury-ticket__memo">
        <summary>{t("memoDetails")}</summary>
        <OpenUiTextField
          className="treasury-memo-field"
          inputClassName="treasury-input-control treasury-input-control--memo"
          label={t("memo")}
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder={t("memo")}
          maxLength={TREASURY_INPUT_LIMITS.memo}
          disabled={controlsLocked}
        />
      </details>
    </div>
  );

  const watchlistPanel = (
    <>
      <p className="treasury-drawer__attribution">{t("treasuryAttributionNotice")}</p>
      {!data?.categories?.length && (
        <div className="treasury-drawer__group treasury-drawer__group--empty">
          <h4>{t("treasuryWatchlist")}</h4>
          <p>{t("treasuryLoadTimeoutHint")}</p>
          <div className="treasury-drawer__group-stats">
            <span>{t("treasuryWatchlistNetwork")}: <strong>{t("networkMainnet")}</strong></span>
            <span>{t("treasuryFlowSource")}: <strong>{watchedAddressCount}</strong></span>
          </div>
        </div>
      )}
      {data?.categories?.map((cat) => (
        <details key={cat.name} className="treasury-drawer__group">
          <summary>
            <span>
              <strong>{cat.name}</strong>
              <small>{cat.wallets?.length ?? 0} {t("addresses")}</small>
            </span>
            <span className="treasury-drawer__group-stats">
              <span>{t("tokenNeo")}: <strong>{formatNumber(cat.wallets?.reduce((s, w) => s + (w.failed ? 0 : (w.neo ?? 0)), 0))}</strong></span>
              <span>{t("tokenGas")}: <strong>{formatNumber(cat.wallets?.reduce((s, w) => s + (w.failed ? 0 : (w.gas ?? 0)), 0))}</strong></span>
            </span>
          </summary>
          <div className="treasury-drawer__wallet-list">
            {cat.wallets?.map((wallet, index) => (
              <div key={wallet.address ?? index} className="treasury-drawer__wallet" data-failed={wallet.failed ? "true" : undefined}>
                <code title={wallet.address}>{compactAddress(wallet.address ?? "—")}</code>
                {wallet.failed ? (
                  <em>{t("treasuryBalanceUnavailable")}</em>
                ) : (
                  <span title={`${wallet.neoDisplay ?? formatNumber(wallet.neo, 4)} NEO · ${wallet.gasDisplay ?? formatNumber(wallet.gas, 4)} GAS`}>
                    {wallet.neoDisplay ?? formatNumber(wallet.neo, 4)} NEO · {wallet.gasDisplay ?? formatNumber(wallet.gas, 4)} GAS
                  </span>
                )}
              </div>
            ))}
          </div>
        </details>
      ))}
    </>
  );

  const policyPanel = (
    <div className="treasury-drawer__policy">
      <h4>{t("policyTitle")}</h4>
      <p>{t("policyCopy")}</p>
      <div className="treasury-policy-grid">
        <span><em>{t("payoutNetwork")}</em><strong>{networkLabel}</strong></span>
        <span><em>{t("treasuryWatchlistNetwork")}</em><strong>{t("networkMainnet")}</strong></span>
        <span><em>{t("executionModel")}</em><strong>{t("executionModelDirect")}</strong></span>
        <span><em>{t("governanceLayer")}</em><strong>{t("governanceLayerNone")}</strong></span>
      </div>
      <p className="treasury-drawer__guardrail">{t("governanceBoundary")}</p>
      <p className="treasury-drawer__source">{t("treasuryReadOnlyRoute")}</p>
      <p className="treasury-drawer__source">
        <a href={WATCHLIST_REFERENCE_URL} target="_blank" rel="noreferrer">{t("treasuryAddressSource")}</a>
      </p>
      {lastUpdated && <p className="treasury-drawer__source">{t("lastUpdated")}: {lastUpdated}</p>}
    </div>
  );

  return (
    <div className="treasury-play-area mx2 mx2-cat-defi">
      <OpenUiProvider>
        <PlayStage
          category="defi"
          stage={{
            title: t("treasuryFlowTitle"),
            subtitle: t("treasuryFlowSubtitle"),
            badges: (
              <span className="mx2-badge treasury-network-badge" data-tone="accent" data-verified={payoutNetwork ? "true" : "false"}>
                <span className="mx2-badge__dot" /> {networkLabel}
              </span>
            ),
          }}
          scene={scene}
          actions={{
            primary: {
              label: hasPendingTransfer
                ? t("checkTransferConfirmation")
                : address
                  ? t("submitDisbursement")
                  : t("connectWallet"),
              onClick: () => void handleSubmit(),
              disabled: hasPendingTransfer
                ? confirmationChecking
                : address
                  ? submitBlocked
                  : controlsLocked,
              loading: disbursementSubmitting || confirmationChecking,
            },
            secondary: [
              { label: t("refresh"), onClick: () => void dispatchSafely("refresh"), hint: t("refreshData") },
            ],
          }}
          drawerToggleLabel={t("treasuryFlowTitle")}
          drawer={{
            title: t("treasuryFlowTitle"),
            children: (
              <div className="treasury-drawer">
                <OpenUiSegmented
                  className="treasury-drawer-tabs"
                  segmentedClassName="treasury-drawer-tabs__group"
                  label={t("treasuryFlowTitle")}
                  value={drawerMode}
                  onChange={setDrawerModeSafe}
                  options={drawerModes.map((item) => ({
                    value: item.mode,
                    label: (
                      <span className="treasury-drawer-tab">
                        <span>{item.label}</span>
                        {"count" in item && <em>{item.count}</em>}
                      </span>
                    ),
                  }))}
                />
                <div className="treasury-drawer__panel" data-mode={drawerMode}>
                  {drawerMode === "payout" && payoutPanel}
                  {drawerMode === "watchlist" && watchlistPanel}
                  {drawerMode === "policy" && policyPanel}
                </div>
              </div>
            ),
          }}
        />
      </OpenUiProvider>
    </div>
  );
}
