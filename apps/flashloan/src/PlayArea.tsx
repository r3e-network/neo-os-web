/**
 * PlayArea.tsx -- Flash Loan execution desk.
 *
 * The loan ticket is the product surface: choose capital, inspect the atomic
 * route, set the callback target, then sign. Liquidity tools, lookup, history,
 * and contract parameters stay tucked into the drawer.
 */
import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownRight,
  CheckCircle2,
  History,
  Layers3,
  Search,
  ShieldCheck,
  Wallet,
  Zap,
} from "lucide-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import type { StatusType } from "@shared/react";
import type { MiniAppLaunchContext } from "@shared/utils/launch-params";
import { addressToScriptHash } from "@shared/utils/neo";
import { CoinArt, ParticleBurst } from "@shared/art";
import { OpenUiNotice, OpenUiPanel, OpenUiProvider, OpenUiTextField, PlayStage } from "@shared/components-react/v2";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<unknown>;
  launchContext?: MiniAppLaunchContext;
  setStatus?: (message: string, kind: StatusType) => void;
}

interface LoanDetails {
  id?: number | string;
  amount?: number | string;
  fee?: number | string;
  status?: string;
  borrower?: string;
}
interface ExecutedLoan {
  id?: number | string;
  amount?: number | string;
  fee?: number | string;
  status?: string;
}
interface LastRequest {
  loanId?: number | string;
  amount?: number | string;
  fee?: number | string;
  txid?: string;
}
interface ContractStats {
  minLoan: number;
  minLoanFixed8?: string;
  maxLoan: number;
  maxLoanFixed8?: string;
  feeBasisPoints: number;
  cooldownMs: number;
  maxDailyLoans: number;
  providerFeeShare: number;
}
interface ProviderStats {
  currentBalance: number;
  currentBalanceFixed8?: string;
  totalDeposited: number;
  totalDepositedFixed8?: string;
  totalFeesEarned: number;
  totalFeesEarnedFixed8?: string;
}
interface DepositCapability {
  status: "checking" | "ready" | "unavailable";
  reason: "" | "payment-hub-unavailable" | "chain-unavailable";
}
interface WriteCapability {
  status: "checking" | "ready" | "blocked";
  reason: "" | "wallet-disconnected" | "chain-context-mismatch" | "chain-unavailable";
}
interface ContractHealth {
  status: "checking" | "ready" | "paused" | "unavailable";
  checkedAt: number;
}
interface BorrowerEligibility {
  verified: boolean;
  canBorrow: boolean;
  maxAvailableLoan: number;
  maxAvailableLoanFixed8: string;
  cooldownRemaining: number;
  dailyLoansRemaining: number;
}

const FEE_BPS = 9;
const TESTNET_CALLBACK_METHOD = "execute";
const TESTNET_CALLBACK_HARNESS = "0x7aa01290d33f6b2313a7efd6acde58f3e64b636f";
const FLASH_DESK_IMAGE = "./flashloan-desk.webp";
const AMOUNT_PRESETS = [
  { value: "1", labelKey: "loanPackageProbe" },
  { value: "10", labelKey: "loanPackageRoute" },
  { value: "100", labelKey: "loanPackageScale" },
] as const;

type DrawerMode = "setup" | "liquidity" | "lookup" | "history" | "params";

function parseFixed8Input(value: string): bigint | null {
  const match = value.trim().match(/^(?:0|[1-9]\d*)(?:\.(\d{1,8}))?$/);
  if (!match) return null;
  const [whole = "0", fraction = ""] = value.trim().split(".");
  const raw = BigInt(whole) * 100_000_000n + BigInt(fraction.padEnd(8, "0") || "0");
  return raw > 0n ? raw : null;
}

function formatFixed8(value: bigint, decimals = 4): string {
  const whole = value / 100_000_000n;
  const fraction = (value % 100_000_000n)
    .toString()
    .padStart(8, "0")
    .slice(0, decimals)
    .replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : `${whole}.00`;
}

function estimateFee(amount: string, bps: number): string {
  const raw = parseFixed8Input(amount);
  if (!raw || !Number.isSafeInteger(bps) || bps <= 0) return "0.00";
  return formatFixed8((raw * BigInt(bps)) / 10_000n);
}
function estimateRepayment(amount: string, bps: number): string {
  const raw = parseFixed8Input(amount);
  if (!raw || !Number.isSafeInteger(bps) || bps <= 0) return "0.00";
  return formatFixed8(raw + (raw * BigInt(bps)) / 10_000n);
}
function compactTxid(value: string) {
  return value.length > 18 ? `${value.slice(0, 10)}…${value.slice(-8)}` : value;
}
function normalizeCallbackTarget(value: string): string {
  const trimmed = value.trim();
  const hex = trimmed.replace(/^0x/i, "");
  if (/^[0-9a-fA-F]{40}$/.test(hex)) {
    return /^0{40}$/.test(hex) ? "" : `0x${hex.toLowerCase()}`;
  }
  const parsed = addressToScriptHash(trimmed);
  return /^0x[0-9a-f]{40}$/i.test(parsed) && !/^0x0{40}$/i.test(parsed) ? parsed : "";
}

function validLoanAmount(value: string, minFixed8: string, maxFixed8: string): boolean {
  const raw = parseFixed8Input(value);
  if (!raw || !/^\d+$/.test(minFixed8) || !/^\d+$/.test(maxFixed8)) return false;
  return raw >= BigInt(minFixed8) && raw <= BigInt(maxFixed8);
}

function validPositiveGasAmount(value: string): boolean {
  return parseFixed8Input(value) !== null;
}
function validCallbackMethod(value: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(value.trim());
}
function getLaunchParam(context: MiniAppLaunchContext | undefined, keys: string[]): string {
  if (!context?.params) return "";
  for (const k of keys) {
    const v = (context.params as Record<string, unknown>)[k];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return "";
}

export default function PlayArea({ t, state, dispatch, launchContext, setStatus }: PlayAreaProps) {
  const { str, bool, val } = useStateBindings(state);

  const isLoading = bool("isLoading");
  const isLookupLoading = bool("isLookupLoading");
  const writeOperation = str("writeOperation");
  const address = str("address");
  const poolBalanceFixed8 = str("poolBalanceFixed8");
  const validationError = str("validationError");
  const serviceNotice = str("serviceNotice");
  const pendingRequestTxid = str("pendingRequestTxid");
  const pendingLiquidityTxid = str("pendingLiquidityTxid");
  const loanDetails = val<LoanDetails | null>("loanDetails", null);
  const recentLoans = val<ExecutedLoan[]>("recentLoans", []) ?? [];
  const lastRequest = val<LastRequest | null>("lastRequest", null);
  const contractStats = val<ContractStats>("contractStats", {
    minLoan: 1, maxLoan: 100000, feeBasisPoints: FEE_BPS,
    cooldownMs: 300000, maxDailyLoans: 10, providerFeeShare: 80,
  })!;
  const providerStats = val<ProviderStats>("providerStats", {
    currentBalance: 0,
    currentBalanceFixed8: "0",
    totalDeposited: 0,
    totalDepositedFixed8: "0",
    totalFeesEarned: 0,
    totalFeesEarnedFixed8: "0",
  })!;
  const depositCapability = val<DepositCapability>("depositCapability", {
    status: "checking",
    reason: "",
  })!;
  const writeCapability = val<WriteCapability>("writeCapability", {
    status: "checking",
    reason: "wallet-disconnected",
  })!;
  const contractHealth = val<ContractHealth>("contractHealth", {
    status: "checking", checkedAt: 0,
  })!;
  const borrowerEligibility = val<BorrowerEligibility>("borrowerEligibility", {
    verified: false,
    canBorrow: false,
    maxAvailableLoan: 0,
    maxAvailableLoanFixed8: "0",
    cooldownRemaining: 0,
    dailyLoansRemaining: 0,
  })!;
  const pendingLiquidityStage = str("pendingLiquidityStage");
  const pendingLiquidityAmount = str("pendingLiquidityAmount");

  const feeBps = contractStats.feeBasisPoints || FEE_BPS;
  const providerFeeShare = contractStats.providerFeeShare ?? 80;
  const protocolFeeShare = Math.max(0, 100 - providerFeeShare);
  const effectiveNetwork = launchContext?.network === "testnet" ? "testnet" : "mainnet";
  const isMainnet = effectiveNetwork === "mainnet";

  const [loanAmount, setLoanAmount] = useState("1");
  const [callbackContract, setCallbackContract] = useState("");
  const [callbackMethod, setCallbackMethod] = useState(
    effectiveNetwork === "testnet" ? TESTNET_CALLBACK_METHOD : "",
  );
  const [lookupId, setLookupId] = useState("");
  const [liquidityAmount, setLiquidityAmount] = useState("");
  const [depositReceiptId, setDepositReceiptId] = useState("");
  const [requestPreview, setRequestPreview] = useState(false);
  const [customAmountOpen, setCustomAmountOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>("setup");

  useEffect(() => {
    const launchedAmount = getLaunchParam(launchContext, ["amount", "borrow", "borrowAmount", "loanAmount"]);
    const launchedCallback = getLaunchParam(launchContext, ["callbackContract", "callback", "contract", "targetContract"]);
    const launchedCallbackMethod = getLaunchParam(launchContext, ["callbackMethod", "method"]);
    const launchedLoanId = getLaunchParam(launchContext, ["loanId", "id"]);
    if (launchedAmount) setLoanAmount(launchedAmount);
    if (launchedCallback) setCallbackContract(launchedCallback);
    if (launchedCallbackMethod) setCallbackMethod(launchedCallbackMethod);
    else setCallbackMethod(effectiveNetwork === "testnet" ? TESTNET_CALLBACK_METHOD : "");
    if (launchedLoanId) setLookupId(launchedLoanId);
  }, [effectiveNetwork, launchContext]);

  const minLoanFixed8 = /^\d+$/.test(contractStats.minLoanFixed8 ?? "")
    ? contractStats.minLoanFixed8!
    : (parseFixed8Input(String(contractStats.minLoan)) ?? 0n).toString();
  const maxLoanFixed8 = /^\d+$/.test(contractStats.maxLoanFixed8 ?? "")
    ? contractStats.maxLoanFixed8!
    : (parseFixed8Input(String(contractStats.maxLoan)) ?? 0n).toString();
  const amountReady = validLoanAmount(loanAmount, minLoanFixed8, maxLoanFixed8);
  const amountFixed8 = parseFixed8Input(loanAmount);
  const callbackHasValue = callbackContract.trim() !== "";
  const callbackAddressReady = Boolean(normalizeCallbackTarget(callbackContract));
  const callbackMethodReady = validCallbackMethod(callbackMethod);
  const callbackReady = callbackAddressReady && callbackMethodReady;
  const contractReady = contractHealth.status === "ready";
  const writeReady = !address || writeCapability.status === "ready";
  const poolReady = amountFixed8 !== null
    && /^\d+$/.test(poolBalanceFixed8)
    && amountFixed8 <= BigInt(poolBalanceFixed8);
  const eligibilityReady = !address || (
    borrowerEligibility.verified
    && borrowerEligibility.canBorrow
    && borrowerEligibility.cooldownRemaining <= 0
    && borrowerEligibility.dailyLoansRemaining > 0
    && amountFixed8 !== null
    && /^\d+$/.test(borrowerEligibility.maxAvailableLoanFixed8 || "")
    && amountFixed8 <= BigInt(borrowerEligibility.maxAvailableLoanFixed8)
  );
  const canRequest = amountReady && callbackReady && contractReady && writeReady && poolReady && eligibilityReady;
  const presetCovered = (value: string) => {
    const raw = parseFixed8Input(value);
    return !contractReady
      || (raw !== null && /^\d+$/.test(poolBalanceFixed8) && raw <= BigInt(poolBalanceFixed8));
  };
  const feePreview = useMemo(() => estimateFee(loanAmount, feeBps), [loanAmount, feeBps]);
  const repaymentPreview = useMemo(() => estimateRepayment(loanAmount, feeBps), [loanAmount, feeBps]);
  const cooldownMinutes = Math.round((contractStats.cooldownMs || 0) / 60000);
  const liquidityLocked = isLoading || Boolean(pendingLiquidityTxid) || Boolean(pendingRequestTxid);
  const liquidityAmountReady = validPositiveGasAmount(liquidityAmount);
  const liquidityAmountFixed8 = parseFixed8Input(liquidityAmount);
  const providerBalanceFixed8 = /^\d+$/.test(providerStats.currentBalanceFixed8 ?? "")
    ? BigInt(providerStats.currentBalanceFixed8!)
    : parseFixed8Input(String(providerStats.currentBalance)) ?? 0n;
  const poolBalanceDisplay = /^\d+$/.test(poolBalanceFixed8)
    ? formatFixed8(BigInt(poolBalanceFixed8), 4)
    : t("notAvailable");
  const providerBalanceDisplay = formatFixed8(providerBalanceFixed8, 4);
  const providerFeesDisplay = /^\d+$/.test(providerStats.totalFeesEarnedFixed8 ?? "")
    ? formatFixed8(BigInt(providerStats.totalFeesEarnedFixed8!), 4)
    : formatFixed8(parseFixed8Input(String(providerStats.totalFeesEarned)) ?? 0n, 4);
  const canDeposit = !liquidityLocked
    && liquidityAmountReady
    && contractReady
    && writeReady
    && depositCapability.status === "ready"
    && (!isMainnet || /^[1-9]\d*$/.test(depositReceiptId.trim()));
  const canWithdraw = !liquidityLocked
    && liquidityAmountReady
    && contractReady
    && writeReady
    && liquidityAmountFixed8 !== null
    && liquidityAmountFixed8 <= providerBalanceFixed8;
  const displayLoanAmount = loanAmount.trim() || "0";
  const requestAnimating = requestPreview || writeOperation === "request";
  const requestLocked = isLoading
    || requestPreview
    || Boolean(pendingRequestTxid)
    || Boolean(pendingLiquidityTxid);
  const lookupLocked = isLookupLoading || isLoading;
  const selectedPreset = AMOUNT_PRESETS.find((preset) => preset.value === loanAmount.trim());
  const callbackTargetLabel = callbackAddressReady
    ? compactTxid(callbackContract.trim())
    : callbackHasValue
      ? t("invalidCallbackContract")
      : t("callbackSocketOpen");
  const callbackSocketState = callbackReady
    ? t("callbackFormatReady")
    : callbackHasValue && !callbackAddressReady
      ? t("invalidCallbackContract")
      : !callbackMethodReady
        ? t("callbackMethodRequired")
        : t("callbackSocketOpen");
  const simulationReady = Boolean(address) && canRequest;
  const simulationStatus = !contractReady
    ? t("contractUnavailable")
    : address && !writeReady
      ? t("chainContextMismatch")
      : !poolReady
        ? t("poolInsufficient")
        : !callbackReady
          ? t("callbackSetupRequired")
          : !address
            ? t("readinessWalletAction")
            : !eligibilityReady
              ? t("eligibilityBlocked")
              : t("simulationReady");
  const drawerTabs = [
    {
      mode: "setup" as const,
      label: t("executionSetup"),
      meta: callbackReady ? t("callbackFormatReady") : t("callbackSocketOpen"),
      icon: <Zap size={15} />,
    },
    {
      mode: "liquidity" as const,
      label: t("liquidityTitle"),
      meta: `${providerBalanceDisplay} GAS`,
      icon: <Layers3 size={15} />,
    },
    {
      mode: "lookup" as const,
      label: t("statusLookup"),
      meta: lookupId.trim() ? `#${lookupId.trim()}` : t("loanId"),
      icon: <Search size={15} />,
    },
    {
      mode: "history" as const,
      label: t("recentLoans"),
      meta: `${recentLoans.length}`,
      icon: <History size={15} />,
    },
    {
      mode: "params" as const,
      label: t("contractInfo"),
      meta: t("callbackMethodFixed"),
      icon: <ShieldCheck size={15} />,
    },
  ];

  const handleRequestLoan = async () => {
    if (!canRequest) {
      setStatus?.(t("flashloanFormIncomplete"), "error");
      return;
    }
    setRequestPreview(true);
    try {
      await dispatch("requestLoan", {
        amount: loanAmount.trim(),
        callbackContract: callbackContract.trim(),
        callbackMethod: callbackMethod.trim(),
      });
    } finally {
      setRequestPreview(false);
    }
  };
  const handleLookup = async () => {
    if (!lookupId.trim() || lookupLocked) return;
    await dispatch("lookupLoan", lookupId.trim());
  };
  const handleDeposit = async () => {
    if (!canDeposit) return;
    const succeeded = await dispatch("provideLiquidity", {
      amount: liquidityAmount.trim(),
      receiptId: isMainnet ? depositReceiptId.trim() : undefined,
    });
    if (succeeded !== true) return;
    setLiquidityAmount("");
    setDepositReceiptId("");
  };
  const handleWithdraw = async () => {
    if (!canWithdraw) return;
    const succeeded = await dispatch("withdrawLiquidity", { amount: liquidityAmount.trim() });
    if (succeeded !== true) return;
    setLiquidityAmount("");
  };
  const handleResumeLiquidity = async () => {
    await dispatch("resumePendingLiquidity");
  };

  const flowSteps = [
    {
      key: "pool",
      label: t("poolBalance"),
      detail: `${poolBalanceDisplay} GAS`,
      icon: <Layers3 size={20} />,
    },
    {
      key: "borrow",
      label: t("borrow"),
      detail: `${displayLoanAmount} GAS`,
      icon: <ArrowDownRight size={20} />,
    },
    {
      key: "execute",
      label: t("execute"),
      detail: callbackMethod.trim() || t("notConfigured"),
      icon: <Zap size={20} />,
    },
    {
      key: "repay",
      label: t("repay"),
      detail: `${repaymentPreview} GAS`,
      icon: <CheckCircle2 size={20} />,
    },
  ];

  const drawerPanel = (() => {
    if (drawerMode === "setup") {
      return (
        <OpenUiPanel
          className="flash-drawer__panel flash-drawer__panel--wide flash-drawer__panel--setup"
          icon={<Zap size={18} strokeWidth={2.35} aria-hidden="true" />}
          title={t("executionSetup")}
          subtitle={t("executionSetupHint")}
        >
          <dl className="flash-setup-summary">
            <div><dt>{t("loanAmount")}</dt><dd>{displayLoanAmount} GAS</dd></div>
            <div><dt>{t("estimatedFee")}</dt><dd>{feePreview} GAS</dd></div>
            <div><dt>{t("totalRepayment")}</dt><dd>{repaymentPreview} GAS</dd></div>
          </dl>
          {!isMainnet && (
            <button
              type="button"
              className="flash-harness-card"
              onClick={() => {
                setCallbackContract(TESTNET_CALLBACK_HARNESS);
                setCallbackMethod(TESTNET_CALLBACK_METHOD);
              }}
              disabled={requestLocked}
            >
              <span className="flash-harness-card__icon"><ShieldCheck size={19} aria-hidden="true" /></span>
              <span className="flash-harness-card__copy">
                <strong>{t("verifiedHarnessTitle")}</strong>
                <small>{t("verifiedHarnessHint")}</small>
              </span>
              <span className="flash-harness-card__action">{t("useVerifiedHarness")}</span>
            </button>
          )}
          <OpenUiTextField
            className="flash-drawer__field flash-drawer__field--callback"
            label={t("callbackContract")}
            value={callbackContract}
            onChange={(e) => setCallbackContract(e.target.value)}
            placeholder={t("callbackContractPlaceholder")}
            hint={t("callbackPrerequisite")}
            disabled={requestLocked}
            spellCheck={false}
            mono
          />
          <OpenUiTextField
            className="flash-drawer__field flash-drawer__field--callback-method"
            label={t("callbackMethod")}
            value={callbackMethod}
            onChange={(e) => setCallbackMethod(e.target.value)}
            placeholder={t("callbackMethodPlaceholder")}
            hint={t("callbackMethodSignature")}
            disabled={requestLocked}
            spellCheck={false}
            mono
          />
          <OpenUiNotice className="flash-drawer__notice flash-drawer__notice--callback" icon={<ShieldCheck size={16} aria-hidden="true" />} title={t("callbackRiskTitle")}>
            {t(isMainnet ? "callbackRiskMainnet" : "callbackRiskTestnet")}
          </OpenUiNotice>
        </OpenUiPanel>
      );
    }

    if (drawerMode === "liquidity") {
      return (
        <OpenUiPanel
          className="flash-drawer__panel flash-drawer__panel--wide flash-drawer__panel--liquidity"
          icon={<Layers3 size={18} strokeWidth={2.35} aria-hidden="true" />}
          title={t("liquidityTitle")}
          subtitle={t("liquidityInfo")}
        >
          <dl className="flash-drawer__lp-stats">
            <div><dt>{t("yourLiquidity")}</dt><dd>{providerBalanceDisplay} GAS</dd></div>
            <div><dt>{t("feesEarned")}</dt><dd>{providerFeesDisplay} GAS</dd></div>
            <div><dt>{t("providerShare")}</dt><dd>{providerFeeShare}%</dd></div>
            <div><dt>{t("protocolShare")}</dt><dd>{protocolFeeShare}%</dd></div>
          </dl>
          <div className="flash-drawer__field-row">
            <OpenUiTextField
              className="flash-drawer__field"
              label={t("liquidityAmount")}
              value={liquidityAmount}
              onChange={(e) => setLiquidityAmount(e.target.value)}
              placeholder={t("liquidityAmountPlaceholder")}
              inputMode="decimal"
              disabled={liquidityLocked}
            />
            {isMainnet && depositCapability.status === "ready" && (
              <OpenUiTextField
                className="flash-drawer__field"
                label={t("receiptIdLabel")}
                value={depositReceiptId}
                onChange={(e) => setDepositReceiptId(e.target.value)}
                placeholder={t("receiptIdPlaceholder")}
                disabled={liquidityLocked}
              />
            )}
          </div>
          {depositCapability.status === "unavailable" && (
            <OpenUiNotice
              className="flash-drawer__notice flash-drawer__notice--blocked"
              icon={<ShieldCheck size={16} aria-hidden="true" />}
              title={t("depositUnavailableTitle")}
            >
              {t(depositCapability.reason === "payment-hub-unavailable"
                ? "paymentHubUnavailable"
                : "statsUnavailable")}
            </OpenUiNotice>
          )}
          {pendingRequestTxid && (
            <OpenUiNotice
              className="flash-drawer__notice flash-drawer__notice--blocked"
              icon={<ShieldCheck size={16} aria-hidden="true" />}
              title={t("otherActionPendingShort")}
            >
              <span>{t("otherFinancialActionPending")}</span>
              <code className="flash-txid" title={pendingRequestTxid}>
                {t("transactionIdLabel")}: {compactTxid(pendingRequestTxid)}
              </code>
            </OpenUiNotice>
          )}
          <div className="flash-drawer__lp-actions">
            <button type="button" className="mx2-btn mx2-btn--ghost" onClick={() => void handleDeposit()} disabled={!canDeposit}>
              {t("deposit")}
            </button>
            <button type="button" className="mx2-btn mx2-btn--ghost" onClick={() => void handleWithdraw()} disabled={!canWithdraw}>
              {t("withdraw")}
            </button>
          </div>
          {pendingLiquidityTxid && (
            <OpenUiNotice
              className="flash-drawer__notice"
              icon={<ShieldCheck size={16} aria-hidden="true" />}
              title={pendingLiquidityStage === "resume"
                ? t("resumeLiquidityTitle")
                : pendingLiquidityStage === "payment-pending"
                  ? t("paymentConfirmationTitle")
                  : t("confirmingOnChain")}
            >
              <span>{pendingLiquidityStage === "resume"
                  ? t("liquidityResumeRequired", { amount: pendingLiquidityAmount || t("notAvailable") })
                  : pendingLiquidityStage === "payment-pending"
                    ? t("liquidityPaymentPending")
                  : pendingLiquidityStage === "manual-review"
                    ? t("liquidityConfirmationReview")
                    : t("liquidityConfirmationPending")}</span>
              <code className="flash-txid" title={pendingLiquidityTxid}>
                {t("transactionIdLabel")}: {compactTxid(pendingLiquidityTxid)}
              </code>
            </OpenUiNotice>
          )}
          {pendingLiquidityStage === "resume" && (
            <button
              type="button"
              className="mx2-btn mx2-btn--ghost flash-drawer__resume"
              onClick={() => void handleResumeLiquidity()}
              disabled={isLoading}
            >
              {t("resumeLiquidityDeposit")}
            </button>
          )}
          <p className="flash-drawer__hint">{t("liquidityFeeShareNote", { share: providerFeeShare, protocol: protocolFeeShare })}</p>
        </OpenUiPanel>
      );
    }

    if (drawerMode === "lookup") {
      return (
        <OpenUiPanel
          className="flash-drawer__panel flash-drawer__panel--lookup"
          icon={<Search size={18} strokeWidth={2.35} aria-hidden="true" />}
          title={t("statusLookup")}
          subtitle={t("statusHint")}
        >
          <div className="flash-drawer__lookup">
            <OpenUiTextField
              className="flash-drawer__field flash-drawer__field--lookup"
              label={t("loanId")}
              value={lookupId}
              onChange={(e) => setLookupId(e.target.value)}
              placeholder={t("loanIdPlaceholder")}
            />
            <button type="button" className="mx2-btn mx2-btn--ghost" onClick={() => void handleLookup()} disabled={!lookupId.trim() || lookupLocked}>
              {isLookupLoading ? t("checkingOnChain") : t("checkStatus")}
            </button>
          </div>
          {loanDetails ? (
            <dl className="flash-drawer__loan-detail">
              <div><dt>{t("loanId")}</dt><dd>#{loanDetails.id}</dd></div>
              <div><dt>{t("amount")}</dt><dd>{loanDetails.amount} GAS</dd></div>
              <div><dt>{t("statusLabel")}</dt><dd>{t(`status${loanDetails.status ? loanDetails.status.charAt(0).toUpperCase() + loanDetails.status.slice(1) : "Pending"}`)}</dd></div>
            </dl>
          ) : (
            <OpenUiNotice className="flash-drawer__notice" icon={<Search size={16} aria-hidden="true" />} title={t("statusLookupEyebrow")}>
              {t("statusHint")}
            </OpenUiNotice>
          )}
        </OpenUiPanel>
      );
    }

    if (drawerMode === "history") {
      return (
        <OpenUiPanel
          className="flash-drawer__panel flash-drawer__panel--history"
          icon={<History size={18} strokeWidth={2.35} aria-hidden="true" />}
          title={t("recentLoans")}
          subtitle={t("sidebarRecentLoans")}
        >
          {recentLoans.length > 0 ? (
            <ul className="mx2-history">
              {recentLoans.slice(0, 5).map((loan) => (
                <li key={loan.id ?? loan.amount} className="mx2-history__item" data-outcome={loan.status === "success" ? "won" : undefined}>
                  <span className="mx2-history__face">#{loan.id}</span>
                  <span className="mx2-history__stake">{loan.amount} GAS</span>
                  <span className="mx2-history__result">{t(`status${loan.status ? `${loan.status.charAt(0).toUpperCase()}${loan.status.slice(1)}` : "Pending"}`)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <OpenUiNotice className="flash-drawer__notice" icon={<History size={16} aria-hidden="true" />} title={t("recentLoansEyebrow")}>
              {t("noHistory")}
            </OpenUiNotice>
          )}
        </OpenUiPanel>
      );
    }

    return (
      <OpenUiPanel
        className="flash-drawer__panel flash-drawer__panel--wide flash-drawer__panel--params"
        icon={<ShieldCheck size={18} strokeWidth={2.35} aria-hidden="true" />}
        title={t("contractInfo")}
        subtitle={t("contractParametersVerified")}
      >
        <dl className="flash-drawer__params-grid">
          <div><dt>{t("minLoan")}</dt><dd>{contractStats.minLoan} GAS</dd></div>
          <div><dt>{t("maxLoan")}</dt><dd>{contractStats.maxLoan} GAS</dd></div>
          <div><dt>{t("cooldown")}</dt><dd>{cooldownMinutes}{t("minutes")}</dd></div>
          <div><dt>{t("dailyLimit")}</dt><dd>{contractStats.maxDailyLoans}</dd></div>
        </dl>
        <OpenUiNotice className="flash-drawer__notice flash-drawer__notice--callback" icon={<Zap size={16} aria-hidden="true" />} title={t("callbackContract")}>
          {t("callbackMethodSignature")}
        </OpenUiNotice>
      </OpenUiPanel>
    );
  })();

  const drawer = (
    <OpenUiProvider>
      <div className="flash-drawer">
        <div className="flash-drawer__tabs" role="tablist" aria-label={t("toolsDockTitle")}>
          {drawerTabs.map((tab) => (
            <button
              key={tab.mode}
              type="button"
              role="tab"
              aria-selected={drawerMode === tab.mode}
              className={drawerMode === tab.mode ? "is-active" : ""}
              onClick={() => setDrawerMode(tab.mode)}
            >
              <span className="flash-drawer__tab-icon">{tab.icon}</span>
              <strong>{tab.label}</strong>
              <small>{tab.meta}</small>
            </button>
          ))}
        </div>
        <div className="flash-drawer__active" data-mode={drawerMode}>
          {drawerPanel}
        </div>
      </div>
    </OpenUiProvider>
  );

  const scene = (
    <div className="flash-scene" data-state={requestAnimating ? "executing" : "ready"}>
      <div className="flash-scene__workspace">
        <section className="flash-ticket" aria-label={t("requestTicketTitle")}>
          <div className="flash-ticket__head">
            <div>
              <p>{t("requestTicketEyebrow")}</p>
              <h3>{t("requestTicketTitle")}</h3>
            </div>
            <div className="flash-ticket__amount">
              <CoinArt size={38} variant="gas" />
              <span>{t("loanAmount")}</span>
              <strong>{displayLoanAmount} GAS</strong>
            </div>
          </div>

          <div className="flash-ticket__preset-grid" aria-label={t("amountPresets")}>
            {AMOUNT_PRESETS.map((preset) => (
              <button
                key={preset.value}
                type="button"
                className="flash-ticket__preset"
                data-selected={loanAmount.trim() === preset.value ? "true" : undefined}
                disabled={requestLocked || !presetCovered(preset.value)}
                title={!presetCovered(preset.value) ? t("presetExceedsPool") : undefined}
                onClick={() => {
                  setLoanAmount(preset.value);
                  setCustomAmountOpen(false);
                }}
              >
                <span>{t(preset.labelKey)}</span>
                <strong>{preset.value} GAS</strong>
              </button>
            ))}
            <button
              type="button"
              className="flash-ticket__preset flash-ticket__preset--custom"
              data-selected={!selectedPreset || customAmountOpen ? "true" : undefined}
              disabled={requestLocked}
              onClick={() => setCustomAmountOpen((value) => !value)}
            >
              <span>{t("customAmount")}</span>
              <strong>{selectedPreset ? t("exactAmount") : `${displayLoanAmount} GAS`}</strong>
            </button>
          </div>

          {(customAmountOpen || !selectedPreset) && (
            <label className="flash-ticket__field">
              <span>{t("exactAmount")}</span>
              <input
                className="flash-input"
                value={loanAmount}
                onChange={(e) => setLoanAmount(e.target.value)}
                placeholder={t("amountPlaceholder")}
                inputMode="decimal"
                disabled={requestLocked}
              />
            </label>
          )}

          <div
            className="flash-callback-socket"
            data-ready={callbackReady ? "true" : undefined}
            data-invalid={(callbackHasValue && !callbackAddressReady) || (callbackHasValue && !callbackMethodReady) ? "true" : undefined}
          >
            <span className="flash-callback-socket__port" aria-hidden="true">
              <Zap size={18} />
            </span>
            <span className="flash-callback-socket__copy">
              <span className="flash-callback-socket__label">{t("callbackSocketLabel")}</span>
              <strong>{callbackSocketState}</strong>
              <small>{callbackReady ? `${callbackMethod.trim()} · ${callbackTargetLabel}` : t("callbackSocketHint")}</small>
            </span>
            <span className="flash-callback-socket__row">
              <span className="flash-callback-socket__rail-dot" aria-hidden="true" />
              <span className="flash-callback-socket__target">
                {callbackReady ? t("callbackInvocationSummary", { method: callbackMethod.trim() }) : t("executionSetupHint")}
              </span>
            </span>
          </div>

          <div className="flash-ticket__repayment">
            <span>{t("estimatedFee")}: <strong>{feePreview} GAS</strong></span>
            <span>{t("totalRepayment")}: <strong>{repaymentPreview} GAS</strong></span>
          </div>
        </section>

        <section className="flash-pool" aria-label={t("poolBalance")}>
          <span className="flash-pool__asset"><CoinArt size={42} variant="gas" /></span>
          <span className="flash-pool__kicker">{t("poolReservoir")}</span>
          <strong>{poolBalanceDisplay} GAS</strong>
          <span>{t("poolBalanceNote")}</span>
        </section>

        <section className="flash-route" aria-label={t("capitalRouteTitle")}>
          <div className="flash-route__head">
            <div>
              <p>{t("capitalRouteTitle")}</p>
              <span>{t("capitalRouteHint")}</span>
            </div>
            <ShieldCheck size={22} aria-hidden="true" />
          </div>
          <figure className="flash-route__visual">
            <img
              src={FLASH_DESK_IMAGE}
              alt={t("flashloanHeroImageAlt")}
              loading="eager"
              decoding="async"
              draggable={false}
            />
          </figure>
          <div className="flash-route__steps">
            {flowSteps.map((step) => (
              <div key={step.key} className="flash-route__step" data-active={requestAnimating ? "true" : undefined}>
                <span className="flash-route__icon">{step.icon}</span>
                <span>
                  <strong>{step.label}</strong>
                  <small>{step.detail}</small>
                </span>
              </div>
            ))}
          </div>
        </section>

        <section
          className="flash-simulation"
          data-ready={simulationReady ? "true" : undefined}
          aria-label={t("simulationTitle")}
        >
          <header className="flash-simulation__head">
            <span className="flash-simulation__tokens" aria-hidden="true">
              <CoinArt size={28} variant="neo" />
              <CoinArt size={28} variant="gas" />
            </span>
            <span>
              <small>{t("simulationEyebrow")}</small>
              <strong>{t("simulationTitle")}</strong>
            </span>
            <b>{simulationStatus}</b>
          </header>
          <dl className="flash-simulation__ledger">
            <div>
              <dt>{t("simulationPrincipal")}</dt>
              <dd>{displayLoanAmount} GAS</dd>
            </div>
            <div>
              <dt>{t("simulationCallback")}</dt>
              <dd>{callbackReady ? callbackMethod.trim() : t("notConfigured")}</dd>
            </div>
            <div>
              <dt>{t("simulationRepayment")}</dt>
              <dd>{repaymentPreview} GAS</dd>
            </div>
          </dl>
          <div className="flash-simulation__risk">
            <ShieldCheck size={17} aria-hidden="true" />
            <span>
              <strong>{t("atomicRevertRiskTitle")}</strong>
              <small>{t("atomicRevertRisk", { fee: feeBps / 100 })}</small>
            </span>
            <em>{t("simulationDisclaimer")}</em>
          </div>
        </section>

        <section className="flash-readiness" aria-label={t("callbackPrerequisite")}>
          <div className="flash-readiness__item" data-ready={address && eligibilityReady ? "true" : undefined}>
            <Wallet size={17} aria-hidden="true" />
            <span>{t("readinessWallet")}</span>
            <strong>{address
              ? borrowerEligibility.verified
                ? borrowerEligibility.canBorrow && borrowerEligibility.cooldownRemaining <= 0
                  ? t("eligibilityReady", { remaining: borrowerEligibility.dailyLoansRemaining })
                  : t("eligibilityBlocked")
                : t("eligibilityChecking")
              : t("readinessWalletAction")}</strong>
          </div>
          <div className="flash-readiness__item" data-ready={callbackReady ? "true" : undefined}>
            <Zap size={17} aria-hidden="true" />
            <span>{t("readinessCallback")}</span>
            <strong>{callbackReady ? `${callbackMethod.trim()} · ${callbackTargetLabel}` : callbackSocketState}</strong>
          </div>
          <div className="flash-readiness__item" data-ready={contractReady && writeReady && poolReady ? "true" : undefined}>
            <ShieldCheck size={17} aria-hidden="true" />
            <span>{t("readinessContract")}</span>
            <strong>{contractHealth.status === "paused"
              ? t("contractPaused")
              : !contractReady
                ? t("contractUnavailable")
                : !writeReady
                  ? t("chainContextMismatch")
                : poolReady
                  ? t("readinessRepaymentGuard")
                  : t("poolInsufficient")}</strong>
          </div>
        </section>
      </div>
      {lastRequest && requestAnimating && <ParticleBurst coins count={8} />}
      <div className="flash-scene__status" aria-live="polite">
        <span>{requestAnimating ? t("requesting") : serviceNotice || (lastRequest ? t("loanRequested") : t("flowNote"))}</span>
        {(pendingRequestTxid || lastRequest?.txid) && (
          <code className="flash-txid" title={pendingRequestTxid || lastRequest?.txid}>
            {t("transactionIdLabel")}: {compactTxid(pendingRequestTxid || lastRequest?.txid || "")}
          </code>
        )}
      </div>
      {validationError && <p className="flash-scene__error" role="alert">{validationError}</p>}
    </div>
  );

  return (
    <div className="flashloan-play-area mx2 mx2-cat-defi" aria-busy={isLoading || isLookupLoading}>
      <PlayStage
        category="defi"
        stage={{
          eyebrow: t("eyebrow"),
          title: t("requestLoanTitle"),
          subtitle: t("flowNote"),
          badges: (
            <>
              <span className="mx2-badge" data-tone="accent">
                <span className="mx2-badge__dot" /> {address ? t("walletConnected") : t("walletRequired")}
              </span>
              <span className="mx2-badge" data-tone={contractReady ? "success" : undefined}>
                <span className="flash-network-assets" aria-hidden="true">
                  <CoinArt size={18} variant="neo" />
                  <CoinArt size={18} variant="gas" />
                </span>
                {t(effectiveNetwork === "testnet" ? "testnet" : "mainnet")} · {t(`contractStatus${contractHealth.status.charAt(0).toUpperCase()}${contractHealth.status.slice(1)}`)}
              </span>
              <span className="mx2-badge">{feeBps / 100}% {t("protocolFee")}</span>
            </>
          ),
        }}
        scene={scene}
        score={[
          { label: t("poolBalance"), value: `${poolBalanceDisplay} GAS`, accent: true },
          { label: t("estimatedFee"), value: `${feePreview} GAS` },
          { label: t("totalRepayment"), value: `${repaymentPreview} GAS` },
        ]}
        actions={{
          primary: {
            label: !address
              ? pendingRequestTxid || pendingLiquidityTxid
                ? t("connectToRecover")
                : t("connectAndSign")
              : pendingRequestTxid
                ? t("confirmingOnChain")
                : pendingLiquidityTxid
                  ? t("otherActionPendingShort")
                : requestAnimating
                  ? t("requesting")
                  : writeOperation
                    ? t("actionInProgressShort")
                  : t("signRequestFlashLoan"),
            onClick: () => void (address ? handleRequestLoan() : dispatch("connectWallet")),
            disabled: address ? (requestLocked || !canRequest) : false,
            loading: requestAnimating,
            hint: pendingLiquidityTxid
              ? t("otherFinancialActionPending")
              : writeOperation && writeOperation !== "request"
              ? t("actionInProgress")
              : !contractReady
                ? t("contractUnavailable")
              : address && !writeReady
                ? t("chainContextMismatch")
              : !poolReady
                ? t("poolInsufficient")
                : !callbackReady
                  ? t("callbackSetupRequired")
                  : t("atomicExecutionHint"),
          },
        }}
        drawerToggleLabel={t("toolsDockTitle")}
        drawer={{
          title: t("toolsDockTitle"),
          children: drawer,
        }}
      />
    </div>
  );
}
