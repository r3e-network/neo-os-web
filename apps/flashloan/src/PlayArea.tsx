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
import { CoinArt, ParticleBurst } from "@shared/art";
import { OpenUiNotice, OpenUiPanel, OpenUiProvider, OpenUiTextField, PlayStage } from "@shared/components-react/v2";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
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
  maxLoan: number;
  feeBasisPoints: number;
  cooldownMs: number;
  maxDailyLoans: number;
  providerFeeShare: number;
}
interface ProviderStats {
  currentBalance: number;
  totalDeposited: number;
  totalFeesEarned: number;
}

const FEE_BPS = 9;
const CALLBACK_METHOD = "onFlashLoan";
const FLASH_DESK_IMAGE = "./flashloan-desk.webp";
const AMOUNT_PRESETS = [
  { value: "1", labelKey: "loanPackageProbe" },
  { value: "10", labelKey: "loanPackageRoute" },
  { value: "100", labelKey: "loanPackageScale" },
] as const;

type DrawerMode = "setup" | "liquidity" | "lookup" | "history" | "params";

function estimateFee(amount: string, bps: number): string {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return "0.00";
  return ((n * bps) / 10000).toFixed(4);
}
function estimateRepayment(amount: string, bps: number): string {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return "0.00";
  return (n + (n * bps) / 10000).toFixed(4);
}
function compactTxid(value: string) {
  return value.length > 18 ? `${value.slice(0, 10)}…${value.slice(-8)}` : value;
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
  const { str, bool, num, val } = useStateBindings(state);

  const isLoading = bool("isLoading");
  const address = str("address");
  const poolBalance = num("poolBalance");
  const validationError = str("validationError");
  const serviceNotice = str("serviceNotice");
  const loanDetails = val<LoanDetails | null>("loanDetails", null);
  const recentLoans = val<ExecutedLoan[]>("recentLoans", []) ?? [];
  const lastRequest = val<LastRequest | null>("lastRequest", null);
  const contractStats = val<ContractStats>("contractStats", {
    minLoan: 1, maxLoan: 100000, feeBasisPoints: FEE_BPS,
    cooldownMs: 300000, maxDailyLoans: 10, providerFeeShare: 80,
  })!;
  const providerStats = val<ProviderStats>("providerStats", {
    currentBalance: 0, totalDeposited: 0, totalFeesEarned: 0,
  })!;

  const feeBps = contractStats.feeBasisPoints || FEE_BPS;
  const providerFeeShare = contractStats.providerFeeShare ?? 80;
  const protocolFeeShare = Math.max(0, 100 - providerFeeShare);
  const isMainnet = launchContext?.network === "mainnet";

  const [loanAmount, setLoanAmount] = useState("10");
  const [callbackContract, setCallbackContract] = useState("");
  const [lookupId, setLookupId] = useState("");
  const [liquidityAmount, setLiquidityAmount] = useState("");
  const [depositReceiptId, setDepositReceiptId] = useState("");
  const [requestPreview, setRequestPreview] = useState(false);
  const [customAmountOpen, setCustomAmountOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>("setup");

  useEffect(() => {
    const launchedAmount = getLaunchParam(launchContext, ["amount", "borrow", "borrowAmount", "loanAmount"]);
    const launchedCallback = getLaunchParam(launchContext, ["callbackContract", "callback", "contract", "targetContract"]);
    const launchedLoanId = getLaunchParam(launchContext, ["loanId", "id"]);
    if (launchedAmount) setLoanAmount(launchedAmount);
    if (launchedCallback) setCallbackContract(launchedCallback);
    if (launchedLoanId) setLookupId(launchedLoanId);
  }, [launchContext]);

  const amountReady = loanAmount.trim() !== "";
  const callbackReady = callbackContract.trim() !== "";
  const canRequest = amountReady && callbackReady;
  const feePreview = useMemo(() => estimateFee(loanAmount, feeBps), [loanAmount, feeBps]);
  const repaymentPreview = useMemo(() => estimateRepayment(loanAmount, feeBps), [loanAmount, feeBps]);
  const cooldownMinutes = Math.round((contractStats.cooldownMs || 0) / 60000);
  const canDeposit = liquidityAmount.trim() !== "" && (!isMainnet || depositReceiptId.trim() !== "");
  const canWithdraw = liquidityAmount.trim() !== "";
  const displayLoanAmount = loanAmount.trim() || "0";
  const requestAnimating = isLoading || requestPreview;
  const selectedPreset = AMOUNT_PRESETS.find((preset) => preset.value === loanAmount.trim());
  const callbackTargetLabel = callbackReady
    ? compactTxid(callbackContract.trim())
    : t("callbackSocketOpen");
  const callbackSocketState = callbackReady ? t("callbackSocketReady") : t("callbackSocketOpen");
  const drawerTabs = [
    {
      mode: "setup" as const,
      label: t("executionSetup"),
      meta: callbackReady ? t("callbackSocketReady") : t("callbackSocketOpen"),
      icon: <Zap size={15} />,
    },
    {
      mode: "liquidity" as const,
      label: t("liquidityTitle"),
      meta: `${providerStats.currentBalance.toFixed(2)} GAS`,
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
        callbackMethod: CALLBACK_METHOD,
      });
    } finally {
      setRequestPreview(false);
    }
  };
  const handleLookup = async () => {
    if (!lookupId.trim()) return;
    await dispatch("lookupLoan", lookupId.trim());
  };
  const handleDeposit = async () => {
    if (!canDeposit) return;
    await dispatch("provideLiquidity", {
      amount: liquidityAmount.trim(),
      receiptId: isMainnet ? depositReceiptId.trim() : undefined,
    });
    setLiquidityAmount("");
    setDepositReceiptId("");
  };
  const handleWithdraw = async () => {
    if (!canWithdraw) return;
    await dispatch("withdrawLiquidity", { amount: liquidityAmount.trim() });
    setLiquidityAmount("");
  };

  const flowSteps = [
    {
      key: "pool",
      label: t("poolBalance"),
      detail: `${poolBalance.toFixed(2)} GAS`,
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
      detail: CALLBACK_METHOD,
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
          <OpenUiTextField
            className="flash-drawer__field flash-drawer__field--callback"
            label={t("callbackContract")}
            value={callbackContract}
            onChange={(e) => setCallbackContract(e.target.value)}
            placeholder={t("callbackContractPlaceholder")}
            hint={t("callbackPrerequisite")}
            spellCheck={false}
            mono
          />
          <OpenUiNotice className="flash-drawer__notice flash-drawer__notice--callback" icon={<ShieldCheck size={16} aria-hidden="true" />} title={t("callbackMethod")}>
            {t("callbackMethodFixed")}
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
            <div><dt>{t("yourLiquidity")}</dt><dd>{providerStats.currentBalance.toFixed(4)} GAS</dd></div>
            <div><dt>{t("feesEarned")}</dt><dd>{providerStats.totalFeesEarned.toFixed(4)} GAS</dd></div>
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
            />
            {isMainnet && (
              <OpenUiTextField
                className="flash-drawer__field"
                label={t("receiptIdLabel")}
                value={depositReceiptId}
                onChange={(e) => setDepositReceiptId(e.target.value)}
                placeholder={t("receiptIdPlaceholder")}
              />
            )}
          </div>
          <div className="flash-drawer__lp-actions">
            <button type="button" className="mx2-btn mx2-btn--ghost" onClick={() => void handleDeposit()} disabled={!canDeposit}>
              {t("deposit")}
            </button>
            <button type="button" className="mx2-btn mx2-btn--ghost" onClick={() => void handleWithdraw()} disabled={!canWithdraw}>
              {t("withdraw")}
            </button>
          </div>
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
            <button type="button" className="mx2-btn mx2-btn--ghost" onClick={() => void handleLookup()} disabled={!lookupId.trim()}>
              {t("checkStatus")}
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
                  <span className="mx2-history__result">{loan.status}</span>
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
        subtitle={t("callbackMethodFixed")}
      >
        <dl className="flash-drawer__params-grid">
          <div><dt>{t("minLoan")}</dt><dd>{contractStats.minLoan} GAS</dd></div>
          <div><dt>{t("maxLoan")}</dt><dd>{contractStats.maxLoan} GAS</dd></div>
          <div><dt>{t("cooldown")}</dt><dd>{cooldownMinutes}{t("minutes")}</dd></div>
          <div><dt>{t("dailyLimit")}</dt><dd>{contractStats.maxDailyLoans}</dd></div>
        </dl>
        <OpenUiNotice className="flash-drawer__notice flash-drawer__notice--callback" icon={<Zap size={16} aria-hidden="true" />} title={t("callbackContract")}>
          {t("callbackPrerequisite")}
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
              />
            </label>
          )}

          <div className="flash-callback-socket" data-ready={callbackReady ? "true" : undefined}>
            <span className="flash-callback-socket__port" aria-hidden="true">
              <Zap size={18} />
            </span>
            <span className="flash-callback-socket__copy">
              <span className="flash-callback-socket__label">{t("callbackSocketLabel")}</span>
              <strong>{callbackSocketState}</strong>
              <small>{callbackReady ? callbackTargetLabel : t("callbackSocketHint")}</small>
            </span>
            <span className="flash-callback-socket__row">
              <span className="flash-callback-socket__rail-dot" aria-hidden="true" />
              <span className="flash-callback-socket__target">
                {callbackReady ? callbackTargetLabel : t("executionSetupHint")}
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
          <strong>{poolBalance.toFixed(2)} GAS</strong>
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

        <section className="flash-readiness" aria-label={t("callbackPrerequisite")}>
          <div className="flash-readiness__item" data-ready={address ? "true" : undefined}>
            <Wallet size={17} aria-hidden="true" />
            <span>{t("readinessWallet")}</span>
            <strong>{address ? t("readinessWalletReady") : t("readinessWalletAction")}</strong>
          </div>
          <div className="flash-readiness__item" data-ready={callbackReady ? "true" : undefined}>
            <Zap size={17} aria-hidden="true" />
            <span>{t("readinessCallback")}</span>
            <strong>{callbackTargetLabel}</strong>
          </div>
          <div className="flash-readiness__item" data-ready="true">
            <ShieldCheck size={17} aria-hidden="true" />
            <span>{t("readinessRepayment")}</span>
            <strong>{t("readinessRepaymentGuard")}</strong>
          </div>
        </section>
      </div>
      {lastRequest && requestAnimating && <ParticleBurst coins count={8} />}
      <p className="flash-scene__status" aria-live="polite">
        {requestAnimating ? t("requesting") : lastRequest ? t("loanRequested") : serviceNotice || t("flowNote")}
      </p>
      {validationError && <p className="flash-scene__error" role="alert">{validationError}</p>}
    </div>
  );

  return (
    <div className="flashloan-play-area mx2 mx2-cat-defi">
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
              <span className="mx2-badge">{feeBps / 100}% {t("protocolFee")}</span>
            </>
          ),
        }}
        scene={scene}
        score={[
          { label: t("poolBalance"), value: `${poolBalance.toFixed(2)} GAS`, accent: true },
          { label: t("estimatedFee"), value: `${feePreview} GAS` },
          { label: t("totalRepayment"), value: `${repaymentPreview} GAS` },
        ]}
        actions={{
          primary: {
            label: address ? (requestAnimating ? t("requesting") : t("signRequestFlashLoan")) : t("connectAndSign"),
            onClick: () => void (address ? handleRequestLoan() : dispatch("connectWallet")),
            disabled: address ? (requestAnimating || !canRequest) : false,
            loading: requestAnimating,
            hint: t("requestLoan"),
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
