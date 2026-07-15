/**
 * SelfLoan — production DeFi position desk.
 *
 * The surface is intentionally position-first: one collateral/debt scene, one
 * contextual composer, and one reviewed action. Protocol facts and recovery
 * tools live below the primary task instead of competing with it.
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  Banknote,
  CheckCircle2,
  CircleGauge,
  Info,
  Layers3,
  LockKeyhole,
  PlusCircle,
  RefreshCw,
  ShieldCheck,
  WalletCards,
  X,
} from "lucide-react";
import { CoinArt, ParticleBurst } from "@shared/art";
import { PlayStage } from "@shared/components-react/v2";
import { PhaseValue, resolvePhase, type DataPhase } from "@shared/components-react/v2/DataPhase";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { ObservableState } from "@shared/react/context";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, p?: Record<string, string | number>) => string;
  state: ObservableState;
  dispatch: (name: string, ...args: unknown[]) => Promise<unknown>;
}

interface Loan {
  borrowed?: number;
  collateralLocked?: number;
  ltvPercent?: number;
  active?: boolean;
  [key: string]: unknown;
}

interface LtvOption {
  tier: number;
  percent: number;
  label: string;
  desc?: string;
}

interface PlatformStats {
  platformFeeBps?: number;
}

type LoadStatus = "idle" | "loading" | "ready" | "awaiting-wallet" | "error";
type ManageMode = "repay" | "add";
type Review =
  | {
    kind: "borrow";
    amount: string;
    tier: number;
    ltvBps: number;
    feeBps: number;
    priceBase: bigint;
    priceGas: number;
    disbursedBase: bigint;
    grossGas: number;
    feeGas: number;
    netGas: number;
    requiresDeposit: boolean;
  }
  | { kind: "repay"; amount: string; requiresDeposit: boolean }
  | { kind: "add"; amount: string; requiresDeposit: boolean };

/**
 * Fallback tiers used only until the composable's derived ltvOptions arrive.
 * Labels stay empty rather than an em-dash: the tier percent beside them already
 * renders its own loading skeleton, and a lone "—" next to a shimmer reads as
 * two different kinds of nothing.
 */
const DEFAULT_LTV_OPTIONS: LtvOption[] = [
  { tier: 1, percent: 0, label: "", desc: "" },
  { tier: 2, percent: 0, label: "", desc: "" },
  { tier: 3, percent: 0, label: "", desc: "" },
];

function toFiniteNumber(value: unknown, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function toExactBigInt(value: unknown) {
  try {
    return BigInt(String(value ?? "0"));
  } catch {
    return 0n;
  }
}

function formatAmount(value: number, maximumFractionDigits = 2) {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits,
    minimumFractionDigits: value > 0 && value < 1 ? Math.min(2, maximumFractionDigits) : 0,
  }).format(value);
}

function decimalInput(value: string, decimals = 8) {
  const normalized = value.replace(/[^\d.]/g, "");
  const [whole = "", ...rest] = normalized.split(".");
  const fraction = rest.join("").slice(0, decimals);
  return rest.length ? `${whole || "0"}.${fraction}` : whole.replace(/^0+(?=\d)/, "");
}

function wholeNeoInput(value: string) {
  const whole = value.split(/[.,]/)[0] ?? "";
  return whole.replace(/[^\d]/g, "").replace(/^0+(?=\d)/, "");
}

function plainAmount(value: number, decimals = 8) {
  if (!Number.isFinite(value) || value <= 0) return "";
  return value.toFixed(decimals).replace(/\.?0+$/, "");
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool, num, val } = useStateBindings(state);
  const loan = val<Loan | null>("loan", null);
  const ltvOptions = val<LtvOption[]>("ltvOptions", DEFAULT_LTV_OPTIONS) ?? DEFAULT_LTV_OPTIONS;
  const platformStats = val<PlatformStats>("platformStats", {}) ?? {};

  const collateralAmount = str("collateralAmount", "");
  const selectedTier = num("selectedLtv", 1);
  const selectedLtvFromState = num("selectedLtvPercent", 0);
  const neoPrice = num("neoPrice", 0);
  const neoPriceBase = toExactBigInt(val<unknown>("neoPriceBase", 0n));
  const poolGas = num("poolGas", 0);
  const poolDisplay = str("poolDisplay", t("notAvailable"));
  const neoBalance = num("neoBalance", 0);
  const gasBalance = num("gasBalance", 0);
  const neoBalanceDisplay = str("neoBalanceDisplay", t("notAvailable"));
  const gasBalanceDisplay = str("gasBalanceDisplay", t("notAvailable"));

  const isConnected = bool("isConnected");
  const hasActiveLoan = bool("hasActiveLoan");
  const isLoading = bool("isLoading");
  const isRefreshing = bool("isRefreshing");
  const isBorrowing = bool("isBorrowing");
  const isRepaying = bool("isRepaying");
  const isAddingCollateral = bool("isAddingCollateral");
  const isProcessing = bool("isProcessing");
  const hasPendingConfirmation = bool("hasPendingConfirmation");
  const pendingConfirmation = str("pendingConfirmation", "");

  const marketStatus = str("marketStatus", "idle") as LoadStatus;
  const balancesStatus = str("balancesStatus", "idle") as LoadStatus;
  const positionStatus = str("positionStatus", "idle") as LoadStatus;
  const recoveryStatus = str("recoveryStatus", "idle") as LoadStatus;
  const runtimeStatus = str("runtimeStatus", "idle") as LoadStatus;
  const runtimeCompatible = bool("runtimeCompatible");
  const repayRecoveryAvailable = bool("repayRecoveryAvailable");
  const activeNetwork = str("activeNetwork", "");
  const runtimeChecksum = val<number | null>("runtimeChecksum", null);
  const hasPendingOperation = bool("hasPendingOperation");
  const journalReady = bool("journalReady");
  const marketReady = bool("marketReady");
  const borrowDataReady = bool("borrowDataReady");
  const manageDataReady = bool("manageDataReady");
  const readError = str("readError", "");

  const collateralCredit = num("collateralCredit", 0);
  const repayCredit = num("repayCredit", 0);
  const hasCollateralCredit = bool("hasCollateralCredit");
  const hasRepayCredit = bool("hasRepayCredit");
  const collateralCreditDisplay = str("collateralCreditDisplay", `0 ${t("tokenNeo")}`);
  const repayCreditDisplay = str("repayCreditDisplay", `0 ${t("tokenGas")}`);

  const coverageRatioDisplay = str("coverageRatioDisplay", t("notAvailable"));
  const currentLTVDisplay = str("currentLTVDisplay", t("notAvailable"));
  const borrowOkNonce = num("borrowOkNonce", 0);
  const repayOkNonce = num("repayOkNonce", 0);
  const addCollateralOkNonce = num("addCollateralOkNonce", 0);

  const [draftCollateral, setDraftCollateral] = useState(wholeNeoInput(collateralAmount));
  const [manageMode, setManageMode] = useState<ManageMode>("repay");
  const [draftRepay, setDraftRepay] = useState("");
  const [draftAdd, setDraftAdd] = useState("");
  const [review, setReview] = useState<Review | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const successNonce = borrowOkNonce + repayOkNonce + addCollateralOkNonce;
  const previousSuccessNonce = useRef(successNonce);

  const activeDebt = toFiniteNumber(loan?.borrowed, 0);
  const activeCollateral = toFiniteNumber(loan?.collateralLocked, 0);
  const activeLtv = toFiniteNumber(loan?.ltvPercent, 0);

  useEffect(() => setDraftCollateral(wholeNeoInput(collateralAmount)), [collateralAmount]);

  useEffect(() => {
    if (!hasActiveLoan) return;
    setDraftRepay((current) => {
      const amount = toFiniteNumber(current, 0);
      return amount > 0 && amount <= activeDebt ? current : plainAmount(activeDebt);
    });
  }, [activeDebt, hasActiveLoan]);

  useEffect(() => {
    if (successNonce > previousSuccessNonce.current) {
      setCelebrate(true);
      const timer = window.setTimeout(() => setCelebrate(false), 1100);
      previousSuccessNonce.current = successNonce;
      return () => window.clearTimeout(timer);
    }
    previousSuccessNonce.current = successNonce;
  }, [successNonce]);

  const selectedOption = useMemo(
    () => ltvOptions.find((option) => option.tier === selectedTier) ?? ltvOptions[0] ?? DEFAULT_LTV_OPTIONS[0]!,
    [ltvOptions, selectedTier],
  );
  const ltvPercent = selectedLtvFromState || selectedOption.percent;
  const ltvBps = Math.round(ltvPercent * 100);
  const feeBps = toFiniteNumber(platformStats.platformFeeBps, 0);
  const feePercent = feeBps / 100;
  const collateralNumber = /^\d+$/.test(draftCollateral) ? Number(draftCollateral) : 0;
  const quoteVerified = marketStatus === "ready" && marketReady && neoPriceBase > 0n && ltvBps > 0;
  const grossBase = quoteVerified && collateralNumber > 0
    ? BigInt(collateralNumber) * neoPriceBase * BigInt(ltvBps) / 10_000n
    : 0n;
  const feeBase = grossBase * BigInt(feeBps) / 10_000n;
  const disbursedBase = grossBase - feeBase;
  const grossBorrow = Number(grossBase) / 1e8;
  const feeGas = Number(feeBase) / 1e8;
  const netBorrow = Number(disbursedBase) / 1e8;
  const poolIsTight = quoteVerified && disbursedBase > 0n && netBorrow > poolGas;
  const availableNeoForAction = neoBalance + (recoveryStatus === "ready" ? collateralCredit : 0);
  const availableGasForAction = gasBalance + (recoveryStatus === "ready" ? repayCredit : 0);
  const collateralValid = Number.isSafeInteger(collateralNumber) && collateralNumber > 0;
  const repayNumber = toFiniteNumber(draftRepay, 0);
  const addNumber = /^\d+$/.test(draftAdd) ? Number(draftAdd) : 0;
  const busy = isLoading || isRefreshing || isBorrowing || isRepaying || isAddingCollateral || isProcessing || isConfirming;

  const canReviewBorrow = isConnected
    && borrowDataReady
    && quoteVerified
    && collateralValid
    && collateralNumber <= availableNeoForAction
    && !poolIsTight
    && disbursedBase > 0n
    && !busy;
  const canReviewRepay = isConnected
    && manageDataReady
    && hasActiveLoan
    && repayNumber > 0
    && repayNumber <= activeDebt
    && repayNumber <= availableGasForAction
    && !busy;
  const canReviewAdd = isConnected
    && manageDataReady
    && hasActiveLoan
    && Number.isSafeInteger(addNumber)
    && addNumber > 0
    && addNumber <= availableNeoForAction
    && !busy;

  // ── Read phases ───────────────────────────────────────────────────────
  // Every value below used to fall through to a bare "—" whenever its read had
  // not produced data, which collapsed three very different situations into one
  // dead character: the read is in flight, the read needs a wallet we do not
  // have, and the visitor simply has not typed an amount yet. Route each value
  // through resolvePhase/PhaseValue so a shimmer means "coming" and words mean
  // "here is what this needs".
  const phaseOfRead = (status: LoadStatus, hasData: boolean): DataPhase =>
    resolvePhase({
      loading: status === "idle" || status === "loading",
      settled: status === "ready" || status === "error" || status === "awaiting-wallet",
      hasData,
    });
  const marketPhase = (hasData: boolean) => phaseOfRead(marketStatus, hasData);
  const balancesPhase = (hasData: boolean) => phaseOfRead(balancesStatus, hasData);
  /** True when no wallet has named a network yet — the expected first paint. */
  const awaitingWallet = runtimeStatus === "awaiting-wallet";
  const marketReadoutReady = runtimeCompatible && marketStatus === "ready";
  const connectPlaceholder = t("phaseConnect");
  const quotePlaceholder = t("phaseAwaitingQuote");
  const amountPlaceholder = t("phaseEnterAmount");
  /**
   * A borrow quote needs a live market read AND a typed collateral amount.
   * Distinguish the two so the visitor is told which one is missing.
   */
  const quotePhase: DataPhase = quoteVerified && collateralValid
    ? "ready"
    : marketStatus === "idle" || marketStatus === "loading"
      ? "loading"
      : "unavailable";
  const quoteHint = quoteVerified ? amountPlaceholder : quotePlaceholder;

  const riskPercent = hasActiveLoan ? toFiniteNumber(currentLTVDisplay.replace("%", ""), activeLtv) : ltvPercent;
  const riskAvailable = hasActiveLoan
    ? marketStatus === "ready" && neoPrice > 0 && currentLTVDisplay !== t("notAvailable")
    : quoteVerified;
  const riskStyle = {
    "--selfloan-risk-pct": `${Math.max(0, Math.min(100, (riskPercent / 40) * 100))}%`,
  } as CSSProperties;
  const riskTone = riskPercent >= 40 ? "maximum" : riskPercent >= 30 ? "balanced" : "conservative";

  const updateCollateral = (value: string) => {
    const next = wholeNeoInput(value);
    setDraftCollateral(next);
    void dispatch("setCollateralAmount", next);
  };

  const openBorrowReview = () => {
    if (!canReviewBorrow) return;
    setReview({
      kind: "borrow",
      amount: draftCollateral,
      tier: selectedTier,
      ltvBps,
      feeBps,
      priceBase: neoPriceBase,
      priceGas: neoPrice,
      disbursedBase,
      grossGas: grossBorrow,
      feeGas,
      netGas: netBorrow,
      requiresDeposit: collateralNumber > collateralCredit,
    });
  };

  const openManageReview = () => {
    if (manageMode === "repay" && canReviewRepay) {
      setReview({ kind: "repay", amount: draftRepay, requiresDeposit: repayNumber > repayCredit });
    }
    if (manageMode === "add" && canReviewAdd) {
      setReview({ kind: "add", amount: draftAdd, requiresDeposit: addNumber > collateralCredit });
    }
  };

  const confirmReview = async () => {
    if (!review || isConfirming) return;
    setIsConfirming(true);
    try {
      let result: unknown;
      if (review.kind === "borrow") {
        result = await dispatch("borrow", {
          collateralAmount: review.amount,
          ltvTier: review.tier,
          expectedPriceBase: review.priceBase.toString(),
          expectedFeeBps: review.feeBps,
          expectedLtvBps: review.ltvBps,
          expectedDisbursedBase: review.disbursedBase.toString(),
        });
      } else if (review.kind === "repay") {
        result = await dispatch("repay", review.amount);
      } else {
        result = await dispatch("addCollateral", review.amount);
      }
      if (result === "confirmed" || result === "pending" || result === true) setReview(null);
    } finally {
      setIsConfirming(false);
    }
  };

  const userDataError = balancesStatus === "error"
    || positionStatus === "error"
    || recoveryStatus === "error";
  const marketDataError = marketStatus === "error";
  const runtimeDataError = runtimeStatus === "error";
  // "awaiting-wallet" is deliberately absent from every clause above: it is the
  // expected pre-connect state, not a fault, and must never raise the alert.
  const dataErrorVisible = userDataError || marketDataError || runtimeDataError || Boolean(readError);
  // Repayment and collateral recovery must remain available when only the
  // unrelated new-borrow quote is down.
  const blockingDataError = runtimeDataError || userDataError || (!hasActiveLoan && marketDataError);

  const scene = (
    <div className="selfloan-scene" data-state={busy ? "routing" : hasActiveLoan ? "active" : "draft"} data-tone={riskTone}>
      <section className="selfloan-position" aria-label={t("positionSummary")}>
        <header>
          <span className="selfloan-position__icon"><CoinArt size={54} variant="neo" decorative /></span>
          <div>
            <span>{hasActiveLoan ? t("collateralLocked") : t("collateralPlan")}</span>
            <strong>{positionStatus === "error" ? t("notAvailable") : formatAmount(hasActiveLoan ? activeCollateral : collateralNumber, 0)} NEO</strong>
          </div>
          <span className="selfloan-status-pill" data-tone={hasActiveLoan ? "active" : "ready"}>
            <LockKeyhole size={13} /> {hasActiveLoan ? t("positionActive") : t("borrowFlowDraft")}
          </span>
        </header>
        <div className="selfloan-position__route" aria-hidden="true">
          <span><CoinArt size={34} variant="neo" decorative /></span>
          <span className="selfloan-position__line"><ArrowRight size={18} /></span>
          <span><CoinArt size={34} variant="gas" decorative /></span>
        </div>
        <div className="selfloan-position__amounts">
          <article>
            <span>{hasActiveLoan ? t("borrowed") : t("estimatedBorrowNet")}</span>
            <strong>
              {hasActiveLoan ? (
                `${formatAmount(activeDebt, 4)} GAS`
              ) : (
                <PhaseValue
                  phase={quoteVerified ? "ready" : marketPhase(false)}
                  placeholder={quotePlaceholder}
                  skeletonWidth="6em"
                >
                  {`${formatAmount(netBorrow, 4)} GAS`}
                </PhaseValue>
              )}
            </strong>
          </article>
          <article>
            <span>{t("coverageRatio")}</span>
            <strong>
              {hasActiveLoan ? (
                `${coverageRatioDisplay}×`
              ) : (
                <PhaseValue
                  phase={quoteVerified && ltvPercent > 0 ? "ready" : marketPhase(false)}
                  placeholder={quotePlaceholder}
                  skeletonWidth="3.5em"
                >
                  {`${formatAmount(100 / ltvPercent, 2)}×`}
                </PhaseValue>
              )}
            </strong>
          </article>
        </div>
        <footer>
          <span><ShieldCheck size={14} /> {t("noForcedLiquidation")}</span>
          <span><Banknote size={14} /> {t("manualRepayment")}</span>
        </footer>
      </section>

      <section className="selfloan-risk" style={riskStyle} aria-label={t("riskBand")}>
        <div className="selfloan-risk__header">
          <div>
            <span>{t("riskBand")}</span>
            <strong>
              <PhaseValue
                phase={riskAvailable ? "ready" : marketPhase(false)}
                placeholder={quotePlaceholder}
                skeletonWidth="5em"
              >
                {`${formatAmount(riskPercent, 1)}% LTV`}
              </PhaseValue>
            </strong>
          </div>
          <span className="selfloan-risk__source"><CircleGauge size={14} /> {t("configuredQuote")}</span>
        </div>
        <div className="selfloan-risk__track" aria-hidden="true">
          <span className="selfloan-risk__zone selfloan-risk__zone--low" />
          <span className="selfloan-risk__zone selfloan-risk__zone--mid" />
          <span className="selfloan-risk__zone selfloan-risk__zone--high" />
          <i />
        </div>
        <div className="selfloan-risk__labels">
          <span>20%</span><span>30%</span><span>40%</span>
        </div>
        <p><Info size={14} /> {t("riskBandNote")}</p>
      </section>

      <section className="selfloan-market" aria-label={t("marketSnapshot")}>
        <article>
          <span>{t("rateLabel")}</span>
          <strong>
            <PhaseValue
              phase={marketPhase(marketStatus === "ready" && neoPrice > 0)}
              placeholder={connectPlaceholder}
              skeletonWidth="9em"
            >
              {`1 NEO = ${formatAmount(neoPrice, 4)} GAS`}
            </PhaseValue>
          </strong>
          <small>{t("configuredNotOracle")}</small>
        </article>
        <article>
          <span>{t("poolAvailable")}</span>
          <strong>
            <PhaseValue
              phase={marketPhase(marketStatus === "ready")}
              placeholder={connectPlaceholder}
              skeletonWidth="6em"
            >
              {poolDisplay}
            </PhaseValue>
          </strong>
          <small>{t("availablePool")}</small>
        </article>
        <article>
          <span>{t("originationFeeLabel")}</span>
          <strong>
            <PhaseValue
              phase={marketPhase(marketStatus === "ready")}
              placeholder={connectPlaceholder}
              skeletonWidth="3.5em"
            >
              {`${formatAmount(feePercent, 2)}%`}
            </PhaseValue>
          </strong>
          <small>{t("borrowOnlyFee")}</small>
        </article>
      </section>
      {celebrate && <ParticleBurst coins count={8} />}
    </div>
  );

  const recoveryNotice = (hasCollateralCredit || hasRepayCredit) && recoveryStatus === "ready" ? (
    <section className="selfloan-recovery" role="status">
      <div><AlertTriangle size={18} /><span><strong>{t("recoveryReady")}</strong>{t("recoveryReadyCopy")}</span></div>
      <div className="selfloan-recovery__actions">
        {hasCollateralCredit && (
          <button type="button" onClick={() => void dispatch("reclaimCollateral")} disabled={busy || hasPendingOperation}>
            {t("reclaimCollateral")} · {collateralCreditDisplay}
          </button>
        )}
        {hasRepayCredit && (
          <button type="button" onClick={() => void dispatch("reclaimRepayCredit")} disabled={busy || hasPendingOperation || !repayRecoveryAvailable}>
            {repayRecoveryAvailable ? t("reclaimRepayCredit") : t("repayRecoveryUnavailableShort")} · {repayCreditDisplay}
          </button>
        )}
      </div>
    </section>
  ) : null;

  const controls = (
    <div className="selfloan-desk">
      {hasPendingConfirmation && (
        <p className="selfloan-notice" data-tone="pending" role="status">
          <RefreshCw size={16} /> {pendingConfirmation || t("pendingConfirmationLabel")}
        </p>
      )}
      {dataErrorVisible && (
        <div className="selfloan-notice" data-tone="error" role="alert">
          <AlertTriangle size={17} />
          <span><strong>{t("dataUnavailableTitle")}</strong>{t("criticalDataUnavailable")}</span>
          <button type="button" onClick={() => void dispatch("refresh")} disabled={busy}><RefreshCw size={14} /> {t("retry")}</button>
        </div>
      )}
      {!isConnected && (
        <div className="selfloan-notice" data-tone="wallet">
          <WalletCards size={18} />
          <span><strong>{t("connectWalletTitle")}</strong>{t("connectWalletToUse")}</span>
        </div>
      )}
      {marketStatus === "ready" && !marketReady && (
        <p className="selfloan-notice" data-tone="error" role="alert"><AlertTriangle size={16} /> {t("priceNotConfigured")}</p>
      )}
      {poolIsTight && (
        <p className="selfloan-notice" data-tone="warning" role="alert"><AlertTriangle size={16} /> {t("insufficientPool", { pool: formatAmount(poolGas, 4) })}</p>
      )}
      {recoveryNotice}

      {!hasActiveLoan ? (
        <section className="selfloan-composer" aria-label={t("openPosition")}>
          <header>
            <div><span>{t("openPosition")}</span><strong>{t("chooseCollateralAndTier")}</strong></div>
            <span><Layers3 size={15} /> {t("twoWalletSteps")}</span>
          </header>
          <div className="selfloan-asset-input">
            <CoinArt size={48} variant="neo" decorative />
            <label>
              <span>{t("amountToLock")}</span>
              <input
                value={draftCollateral}
                onChange={(event) => updateCollateral(event.target.value)}
                inputMode="numeric"
                placeholder="0"
                disabled={busy}
                aria-label={t("amountToLock")}
              />
            </label>
            <div><strong>NEO</strong><small>
              <PhaseValue
                phase={balancesPhase(balancesStatus === "ready")}
                placeholder={connectPlaceholder}
                skeletonWidth="5em"
              >
                {`${neoBalanceDisplay} ${t("available")}`}
              </PhaseValue>
            </small></div>
          </div>
          <div className="selfloan-quick-row" aria-label={t("quickCollateral")}>
            {[10, 25, 50].map((amount) => (
              <button key={amount} type="button" onClick={() => updateCollateral(String(amount))} disabled={busy}>{amount}</button>
            ))}
            <button type="button" onClick={() => updateCollateral(String(Math.floor(availableNeoForAction)))} disabled={busy || availableNeoForAction <= 0}>{t("maxCollateral")}</button>
          </div>
          <div className="selfloan-tier-grid" role="radiogroup" aria-label={t("ltvTier")}>
            {ltvOptions.map((option) => {
              const active = option.tier === selectedTier;
              return (
                <button
                  key={option.tier}
                  type="button"
                  className={active ? "is-active" : ""}
                  onClick={() => void dispatch("setLtvTier", String(option.tier))}
                  disabled={busy || marketStatus !== "ready"}
                  aria-pressed={active}
                >
                  <span>{option.label}</span>
                  <strong>
                    <PhaseValue
                      phase={option.percent > 0 ? "ready" : marketPhase(false)}
                      placeholder={connectPlaceholder}
                      skeletonWidth="3em"
                    >
                      {`${formatAmount(option.percent, 1)}%`}
                    </PhaseValue>
                  </strong>
                  <small>{option.desc}</small>
                </button>
              );
            })}
          </div>
          <div className="selfloan-quote" data-ready={quoteVerified && collateralValid}>
            <div><span>{t("grossBorrow")}</span><strong>
              <PhaseValue phase={quotePhase} placeholder={quoteHint} skeletonWidth="6em">
                {`${formatAmount(grossBorrow, 4)} GAS`}
              </PhaseValue>
            </strong></div>
            <div><span>{t("originationFeeLabel")}</span><strong>
              <PhaseValue phase={quotePhase} placeholder={quoteHint} skeletonWidth="6em">
                {`−${formatAmount(feeGas, 4)} GAS`}
              </PhaseValue>
            </strong></div>
            <div><span>{t("youReceive")}</span><strong>
              <PhaseValue phase={quotePhase} placeholder={quoteHint} skeletonWidth="6em">
                {`${formatAmount(netBorrow, 4)} GAS`}
              </PhaseValue>
            </strong></div>
          </div>
        </section>
      ) : (
        <section className="selfloan-manage" aria-label={t("managePosition")}>
          <header>
            <div><span>{t("managePosition")}</span><strong>{t("onePositionPerWallet")}</strong></div>
            <span><CheckCircle2 size={15} /> {t("positionActive")}</span>
          </header>
          <div className="selfloan-manage__switch" role="tablist" aria-label={t("managePosition")}>
            <button type="button" className={manageMode === "repay" ? "is-active" : ""} onClick={() => setManageMode("repay")} role="tab" aria-selected={manageMode === "repay"}><Banknote size={15} /> {t("repay")}</button>
            <button type="button" className={manageMode === "add" ? "is-active" : ""} onClick={() => setManageMode("add")} role="tab" aria-selected={manageMode === "add"}><PlusCircle size={15} /> {t("addCollateral")}</button>
          </div>
          {manageMode === "repay" ? (
            <>
              <div className="selfloan-asset-input">
                <CoinArt size={48} variant="gas" decorative />
                <label><span>{t("repayAmount")}</span><input value={draftRepay} onChange={(event) => setDraftRepay(decimalInput(event.target.value))} inputMode="decimal" placeholder="0" disabled={busy} aria-label={t("repayAmount")} /></label>
                <div><strong>GAS</strong><small>
                  <PhaseValue
                    phase={balancesPhase(balancesStatus === "ready")}
                    placeholder={connectPlaceholder}
                    skeletonWidth="5em"
                  >
                    {`${gasBalanceDisplay} ${t("available")}`}
                  </PhaseValue>
                </small></div>
              </div>
              <div className="selfloan-quick-row selfloan-quick-row--three">
                {[0.25, 0.5].map((ratio) => <button key={ratio} type="button" onClick={() => setDraftRepay(plainAmount(activeDebt * ratio))} disabled={busy}>{ratio * 100}%</button>)}
                <button type="button" onClick={() => setDraftRepay(plainAmount(activeDebt))} disabled={busy}>{t("maxRepay")}</button>
              </div>
              <div className="selfloan-effect-preview">
                <span>{t("remainingDebt")}</span>
                <strong>
                  <PhaseValue
                    phase={repayNumber > 0 ? "ready" : "unavailable"}
                    placeholder={t("phaseEnterAmount")}
                    skeletonWidth="6em"
                  >
                    {`${formatAmount(Math.max(0, activeDebt - repayNumber), 4)} GAS`}
                  </PhaseValue>
                </strong>
                <small>{repayNumber >= activeDebt && activeDebt > 0 ? t("fullRepayReleases", { amount: formatAmount(activeCollateral, 0) }) : t("partialRepayKeepsCollateral")}</small>
              </div>
            </>
          ) : (
            <>
              <div className="selfloan-asset-input">
                <CoinArt size={48} variant="neo" decorative />
                <label><span>{t("addCollateralAmount")}</span><input value={draftAdd} onChange={(event) => setDraftAdd(wholeNeoInput(event.target.value))} inputMode="numeric" placeholder="0" disabled={busy} aria-label={t("addCollateralAmount")} /></label>
                <div><strong>NEO</strong><small>
              <PhaseValue
                phase={balancesPhase(balancesStatus === "ready")}
                placeholder={connectPlaceholder}
                skeletonWidth="5em"
              >
                {`${neoBalanceDisplay} ${t("available")}`}
              </PhaseValue>
            </small></div>
              </div>
              <div className="selfloan-quick-row selfloan-quick-row--three">
                {[1, 5].map((amount) => <button key={amount} type="button" onClick={() => setDraftAdd(String(amount))} disabled={busy}>{amount} NEO</button>)}
                <button type="button" onClick={() => setDraftAdd(String(Math.floor(availableNeoForAction)))} disabled={busy || availableNeoForAction <= 0}>{t("maxCollateral")}</button>
              </div>
              <div className="selfloan-effect-preview">
                <span>{t("collateralAfter")}</span>
                <strong>
                  <PhaseValue
                    phase={addNumber > 0 ? "ready" : "unavailable"}
                    placeholder={amountPlaceholder}
                    skeletonWidth="5em"
                  >
                    {`${formatAmount(activeCollateral + addNumber, 0)} NEO`}
                  </PhaseValue>
                </strong>
                <small>{t("debtDoesNotIncrease")}</small>
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );

  const drawer = (
    <div className="selfloan-drawer">
      <section className="selfloan-protocol-facts">
        <article><ShieldCheck size={18} /><div><strong>{t("noForcedLiquidation")}</strong><span>{t("noLiquidationDetail")}</span></div></article>
        <article><CircleGauge size={18} /><div><strong>{t("configuredQuote")}</strong><span>{t("configuredQuoteDetail")}</span></div></article>
        <article><WalletCards size={18} /><div><strong>{t("noAllowance")}</strong><span>{t("noAllowanceDetail")}</span></div></article>
      </section>
      <section className="selfloan-source-grid">
        <article data-status={runtimeStatus}>
          <span>{t("deploymentBinding")}</span>
          <strong>
            <PhaseValue
              phase={phaseOfRead(runtimeStatus, runtimeCompatible)}
              placeholder={connectPlaceholder}
              skeletonWidth="9em"
            >
              {`${activeNetwork || "Neo N3"}${runtimeChecksum === null ? "" : ` · ${runtimeChecksum}`}`}
            </PhaseValue>
          </strong>
          <small>{t("checksumAbiPinned")}</small>
        </article>
        <article data-status={marketStatus}><span>{t("marketSnapshot")}</span><strong>
          <PhaseValue
            phase={marketPhase(marketStatus === "ready")}
            placeholder={connectPlaceholder}
            skeletonWidth="5em"
          >
            {t("verified")}
          </PhaseValue>
        </strong><small>{t("tiersFeePricePool")}</small></article>
        <article data-status={balancesStatus}><span>{t("walletBalances")}</span><strong>
          <PhaseValue
            phase={balancesPhase(balancesStatus === "ready")}
            placeholder={connectPlaceholder}
            skeletonWidth="10em"
          >
            {`${neoBalanceDisplay} NEO · ${gasBalanceDisplay} GAS`}
          </PhaseValue>
        </strong><small>{t("walletBalanceSource")}</small></article>
        <article data-status={positionStatus}><span>{t("positionSource")}</span><strong>
          <PhaseValue
            phase={phaseOfRead(positionStatus, positionStatus === "ready")}
            placeholder={connectPlaceholder}
            skeletonWidth="5em"
          >
            {t("verified")}
          </PhaseValue>
        </strong><small>getLoan(address)</small></article>
        <article data-status={journalReady ? "ready" : "error"}>
          <span>{t("refreshRecovery")}</span>
          <strong>{journalReady ? t("journalReady") : t("notAvailable")}</strong>
          <small>{t("journalReadyDetail")}</small>
        </article>
        <article data-status={repayRecoveryAvailable ? "ready" : "error"}>
          <span>{t("legacyRepayCreditRecovery")}</span>
          <strong>{repayRecoveryAvailable ? t("verified") : t("unavailableOnPublishedAbi")}</strong>
          <small>{t("repayAtomicDetail")}</small>
        </article>
      </section>
    </div>
  );

  let primaryLabel = t("reviewBorrow");
  let primaryDisabled = !canReviewBorrow;
  let primaryClick = openBorrowReview;
  let primaryIcon = <ArrowDownRight size={17} />;
  if (!isConnected) {
    primaryLabel = t("connectWallet");
    primaryDisabled = busy;
    primaryClick = () => void dispatch("connectWallet");
    primaryIcon = <WalletCards size={17} />;
  } else if (hasPendingOperation) {
    primaryLabel = t("recheckPendingTransaction");
    primaryDisabled = busy;
    primaryClick = () => void dispatch("refresh");
    primaryIcon = <RefreshCw size={17} />;
  } else if (blockingDataError) {
    primaryLabel = t("retryData");
    primaryDisabled = busy;
    primaryClick = () => void dispatch("refresh");
    primaryIcon = <RefreshCw size={17} />;
  } else if (hasActiveLoan) {
    primaryLabel = manageMode === "repay" ? t("reviewRepayment") : t("reviewCollateralAdd");
    primaryDisabled = manageMode === "repay" ? !canReviewRepay : !canReviewAdd;
    primaryClick = openManageReview;
    primaryIcon = manageMode === "repay" ? <Banknote size={17} /> : <PlusCircle size={17} />;
  }

  return (
    <div className="self-loan-play-area mx2 mx2-cat-defi">
      <PlayStage
        category="defi"
        stage={{
          eyebrow: t("borrowFlowKicker"),
          title: hasActiveLoan ? t("yourLoan") : t("borrowNow"),
          subtitle: t("note"),
          // The badge used to fall to a warning tone for every non-ready state,
          // so a visitor with no wallet was greeted by an amber "Checking live
          // data" that never resolved. Pre-connect is neutral, not a warning.
          badges: (
            <span
              className="mx2-badge"
              data-tone={
                marketReadoutReady ? "accent" : awaitingWallet ? undefined : "warning"
              }
            >
              <span className="mx2-badge__dot" />{" "}
              {marketReadoutReady
                ? `${t("available")}: ${poolDisplay}`
                : awaitingWallet
                  ? t("phaseAwaitingPool")
                  : t("dataChecking")}
            </span>
          ),
        }}
        scene={<>{scene}{controls}</>}
        score={[
          {
            label: t("collateral"),
            // Collateral is the one readout the visitor drives entirely from the
            // input above, so its zero-state asks for an amount rather than a
            // wallet — nothing is loading and nothing has failed.
            value: (
              <PhaseValue
                phase={hasActiveLoan || collateralValid ? "ready" : "unavailable"}
                placeholder={amountPlaceholder}
                skeletonWidth="5em"
              >
                {`${formatAmount(hasActiveLoan ? activeCollateral : collateralNumber, 0)} NEO`}
              </PhaseValue>
            ),
            accent: true,
          },
          {
            label: hasActiveLoan ? t("borrowed") : t("youReceive"),
            value: hasActiveLoan ? (
              `${formatAmount(activeDebt, 4)} GAS`
            ) : (
              <PhaseValue phase={quotePhase} placeholder={quoteHint} skeletonWidth="6em">
                {`${formatAmount(netBorrow, 4)} GAS`}
              </PhaseValue>
            ),
          },
          {
            label: t("selectedLTV"),
            value: (
              <PhaseValue
                phase={ltvPercent > 0 ? "ready" : marketPhase(false)}
                placeholder={quotePlaceholder}
                skeletonWidth="3.5em"
              >
                {`${formatAmount(ltvPercent, 1)}%`}
              </PhaseValue>
            ),
          },
        ]}
        actions={{
          primary: {
            label: busy ? t("processing") : primaryLabel,
            icon: primaryIcon,
            onClick: primaryClick,
            disabled: primaryDisabled,
            loading: busy,
          },
          secondary: [],
        }}
        drawerToggleLabel={t("protocolDetails")}
        drawer={{ title: t("protocolDetails"), children: drawer }}
      />

      {review && (
        <div className="selfloan-review-backdrop" role="presentation">
          <section className="selfloan-review" role="dialog" aria-modal="true" aria-labelledby="selfloan-review-title">
            <header>
              <div><span>{t("transactionPreview")}</span><h3 id="selfloan-review-title">{review.kind === "borrow" ? t("reviewBorrow") : review.kind === "repay" ? t("reviewRepayment") : t("reviewCollateralAdd")}</h3></div>
              <button type="button" onClick={() => setReview(null)} disabled={isConfirming} aria-label={t("close")}><X size={18} /></button>
            </header>
            {review.kind === "borrow" ? (
              <div className="selfloan-review__summary">
                <article><CoinArt size={38} variant="neo" decorative /><span>{t("youLock")}</span><strong>{review.amount} NEO</strong></article>
                <ArrowRight size={19} />
                <article><CoinArt size={38} variant="gas" decorative /><span>{t("youReceive")}</span><strong>{formatAmount(review.netGas, 4)} GAS</strong></article>
              </div>
            ) : (
              <div className="selfloan-review__summary selfloan-review__summary--single">
                <article><CoinArt size={38} variant={review.kind === "repay" ? "gas" : "neo"} decorative /><span>{review.kind === "repay" ? t("repayAmount") : t("addCollateralAmount")}</span><strong>{review.amount} {review.kind === "repay" ? "GAS" : "NEO"}</strong></article>
              </div>
            )}
            <ol className="selfloan-review__steps">
              {review.kind === "repay" ? (
                <li><span>1</span><div><strong>{t("atomicRepayment")}</strong><small>{t("atomicRepaymentDetail")}</small></div></li>
              ) : (
                <>
                  {review.requiresDeposit && (
                    <li><span>1</span><div><strong>{t("depositNeoCredit")}</strong><small>{t("walletConfirmation")}</small></div></li>
                  )}
                  <li><span>{review.requiresDeposit ? 2 : 1}</span><div><strong>{review.kind === "borrow" ? t("openLoanOnChain") : t("applyCollateralOnChain")}</strong><small>{review.requiresDeposit ? t("walletConfirmation") : t("existingCreditCovers")}</small></div></li>
                </>
              )}
            </ol>
            {review.kind === "borrow" && (
              <dl className="selfloan-review__terms">
                <div><dt>{t("grossBorrow")}</dt><dd>{formatAmount(review.grossGas, 4)} GAS</dd></div>
                <div><dt>{t("originationFeeLabel")}</dt><dd>−{formatAmount(review.feeGas, 4)} GAS</dd></div>
                <div><dt>{t("configuredQuote")}</dt><dd>1 NEO = {formatAmount(review.priceGas, 4)} GAS</dd></div>
                <div><dt>{t("selectedLTV")}</dt><dd>{formatAmount(review.ltvBps / 100, 1)}%</dd></div>
              </dl>
            )}
            <p className="selfloan-review__warning"><Info size={15} /> {t("reviewFreshnessNote")}</p>
            <footer>
              <button type="button" onClick={() => setReview(null)} disabled={isConfirming}>{t("cancel")}</button>
              <button type="button" className="selfloan-review__confirm" onClick={() => void confirmReview()} disabled={isConfirming}>{isConfirming ? t("processing") : t("confirmInWallet")}</button>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}
