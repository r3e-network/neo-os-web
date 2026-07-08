/**
 * PlayArea.tsx - Self Loan (DeFi position desk)
 *
 * The primary surface is the collateral position itself: a bright vault, live
 * LTV meter, borrow preview, and route summary. Detailed recovery/repay context
 * stays in the drawer, while the primary action carries the exact borrow form
 * payload expected by the runtime action.
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  ArrowDownRight,
  Banknote,
  LockKeyhole,
  Minus,
  Plus,
  PlusCircle,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import { CoinArt, ParticleBurst } from "@shared/art";
import { PlayStage } from "@shared/components-react/v2";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { ObservableState } from "@shared/react/context";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, p?: Record<string, string | number>) => string;
  state: ObservableState;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

interface Loan {
  borrowed?: number;
  collateralLocked?: number;
  ltvPercent?: number;
  active?: boolean;
  status?: string;
  [key: string]: unknown;
}

interface LtvOption {
  tier: number;
  percent: number;
  label: string;
  desc: string;
}

interface PlatformStats {
  platformFeeBps?: number;
  [key: string]: unknown;
}

const DEFAULT_LTV_OPTIONS: LtvOption[] = [
  { tier: 1, percent: 20, label: "Conservative", desc: "20% LTV" },
  { tier: 2, percent: 30, label: "Balanced", desc: "30% LTV" },
  { tier: 3, percent: 40, label: "Aggressive", desc: "40% LTV" },
];

function toFiniteNumber(value: unknown, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function formatAmount(value: number, maximumFractionDigits = 2) {
  if (!Number.isFinite(value)) return "0";
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits,
    minimumFractionDigits: value > 0 && value < 1 ? 2 : 0,
  }).format(value);
}

function withUnit(value: string, unit: string) {
  const text = String(value || "0").trim() || "0";
  return new RegExp(`\\b${unit}\\b`, "i").test(text) ? text : `${text} ${unit}`;
}

function normalizeWholeNeoAmount(value: string) {
  const whole = value.split(/[.,]/)[0] ?? "";
  return whole.replace(/[^\d]/g, "").replace(/^0+(?=\d)/, "");
}

function isPositiveWholeNeoAmount(value: string) {
  return /^[1-9]\d*$/.test(value.trim());
}

function boundedWholeNeo(value: number, max: number) {
  const cap = Number.isFinite(max) && max > 0 ? Math.floor(max) : Number.POSITIVE_INFINITY;
  return String(Math.max(0, Math.min(cap, Math.floor(value))));
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool, num, val } = useStateBindings(state);
  const loan = val<Loan | null>("loan", null);
  const ltvOptions = val<LtvOption[]>("ltvOptions", DEFAULT_LTV_OPTIONS) ?? DEFAULT_LTV_OPTIONS;
  const platformStats = val<PlatformStats>("platformStats", {}) ?? {};
  const collateralAmount = str("collateralAmount", "");
  const selectedTier = num("selectedLtv", 1);
  const selectedLtvPercentFromState = num("selectedLtvPercent", 0);
  const neoBalance = str("neoBalance", "0");
  const neoBalanceDisplay = str("neoBalanceDisplay", neoBalance || "0");
  const neoPrice = num("neoPrice", 0);
  const neoPriceDisplay = str("neoPriceDisplay", "");
  const poolGas = num("poolGas", 0);
  const poolDisplay = str("poolDisplay", "0");
  const hasActiveLoan = bool("hasActiveLoan");
  const isLoading = bool("isLoading");
  const isBorrowing = bool("isBorrowing");
  const isRepaying = bool("isRepaying");
  const isAddingCollateral = bool("isAddingCollateral");
  const hasPendingConfirmation = bool("hasPendingConfirmation");
  const pendingConfirmation = str("pendingConfirmation", "");
  const hasCollateralCredit = bool("hasCollateralCredit");
  const hasRepayCredit = bool("hasRepayCredit");
  const collateralCreditDisplay = str("collateralCreditDisplay", "0");
  const repayCreditDisplay = str("repayCreditDisplay", "0");
  const healthMetricLabel = str("healthMetricLabel", t("collateralRatio"));
  const healthFactorDisplay = str("healthFactorDisplay", t("notAvailable"));
  const currentLTVDisplay = str("currentLTVDisplay", t("notAvailable"));
  const poolLabel = withUnit(poolDisplay, "GAS");
  const collateralCreditLabel = withUnit(collateralCreditDisplay, "NEO");
  const repayCreditLabel = withUnit(repayCreditDisplay, "GAS");

  const [draftCollateral, setDraftCollateral] = useState(collateralAmount);
  const [borrowPreview, setBorrowPreview] = useState(false);
  const borrowPreviewTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setDraftCollateral(normalizeWholeNeoAmount(collateralAmount));
  }, [collateralAmount]);

  useEffect(() => () => {
    if (borrowPreviewTimeout.current) clearTimeout(borrowPreviewTimeout.current);
  }, []);

  const selectedOption = useMemo<LtvOption>(() => {
    return ltvOptions.find((option) => option.tier === selectedTier)
      ?? ltvOptions[0]
      ?? DEFAULT_LTV_OPTIONS[0]!;
  }, [ltvOptions, selectedTier]);

  const ltvPercent = selectedLtvPercentFromState || selectedOption.percent;
  const feeBps = toFiniteNumber(platformStats.platformFeeBps, 50);
  const feePercent = feeBps / 100;
  const walletNeo = toFiniteNumber(neoBalance, 0);
  const collateralReady = isPositiveWholeNeoAmount(draftCollateral);
  const collateralNum = collateralReady ? toFiniteNumber(draftCollateral, 0) : 0;
  const collateralValueGas = collateralNum * (neoPrice > 0 ? neoPrice : 1);
  const grossBorrow = collateralValueGas * (ltvPercent / 100);
  const netBorrow = Math.max(0, grossBorrow - (grossBorrow * feeBps) / 10000);
  const activeBorrowed = toFiniteNumber(loan?.borrowed, 0);
  const activeCollateral = toFiniteNumber(loan?.collateralLocked, 0);
  const busy = isLoading || isBorrowing || isRepaying || isAddingCollateral || borrowPreview;
  const canBorrow = !hasActiveLoan && collateralReady && !busy;
  const poolIsTight = poolGas > 0 && netBorrow > poolGas;
  const displayedBorrow = hasActiveLoan ? activeBorrowed : netBorrow;
  const displayedCollateral = hasActiveLoan ? activeCollateral : collateralNum;
  const vaultState = isBorrowing || borrowPreview
    ? t("borrowFlowBorrowing")
    : hasActiveLoan
      ? t("positionActive")
      : draftCollateral.trim()
        ? t("borrowFlowReady")
        : t("borrowFlowDraft");

  const ltvTone = ltvPercent >= 40 ? "warm" : ltvPercent >= 30 ? "balanced" : "safe";
  const meterStyle = {
    "--selfloan-ltv-pct": `${Math.max(0, Math.min(100, ltvPercent))}%`,
  } as CSSProperties;

  const updateCollateral = (value: string) => {
    const next = normalizeWholeNeoAmount(value);
    setDraftCollateral(next);
    void dispatch("setCollateralAmount", next);
  };

  const selectTier = (tier: number) => {
    void dispatch("setLtvTier", String(tier));
  };

  const startBorrowPreview = () => {
    if (borrowPreviewTimeout.current) clearTimeout(borrowPreviewTimeout.current);
    setBorrowPreview(true);
    borrowPreviewTimeout.current = setTimeout(() => {
      setBorrowPreview(false);
      borrowPreviewTimeout.current = null;
    }, 1100);
  };

  const handleBorrow = () => {
    if (!canBorrow) return;
    startBorrowPreview();
    void dispatch("borrow", { collateralAmount: draftCollateral.trim(), ltvTier: selectedTier });
  };

  const handleAddCollateral = () => {
    if (!collateralReady || busy) return;
    void dispatch("addCollateral", draftCollateral.trim());
  };

  const handleRepay = () => {
    if (!hasActiveLoan || isRepaying) return;
    void dispatch("repay", activeBorrowed > 0 ? String(activeBorrowed) : "");
  };

  const adjustCollateral = (delta: number) => {
    const nextBase = isPositiveWholeNeoAmount(draftCollateral) ? Number(draftCollateral) : 0;
    updateCollateral(boundedWholeNeo(nextBase + delta, walletNeo));
  };

  const useMaxCollateral = () => {
    if (walletNeo <= 0) return;
    updateCollateral(boundedWholeNeo(walletNeo, walletNeo));
  };

  const quickAmounts = ["10", "25", "50"];

  const scene = (
    <div className="selfloan-scene" data-state={busy ? "routing" : hasActiveLoan ? "active" : "draft"} data-tone={ltvTone}>
      <section className="selfloan-scene__position" aria-label={t("loanStatus")}>
        <div className="selfloan-scene__asset-row" aria-hidden="true">
          <CoinArt size={58} variant="neo" className="selfloan-scene__asset selfloan-scene__asset--primary" decorative />
          <CoinArt size={42} variant="neo" className="selfloan-scene__asset selfloan-scene__asset--secondary" decorative />
          <span className="selfloan-scene__lock-badge"><LockKeyhole size={18} /></span>
        </div>
        <span className="selfloan-scene__eyebrow"><LockKeyhole size={14} /> {t("custodyTitle")}</span>
        <div className="selfloan-token-value">
          <strong>{formatAmount(displayedCollateral, 0)}</strong>
          <span>NEO</span>
        </div>
        <p>{vaultState}</p>
        <div className="selfloan-scene__chips">
          <span><ShieldCheck size={14} /> {t("custodyBadge")}</span>
          <span><RefreshCw size={14} /> {t("feature2Name")}</span>
        </div>
      </section>
      <section className="selfloan-scene__meter" style={meterStyle} aria-label={t("selectedLTV")}>
        <div className="selfloan-scene__meter-ring">
          <span>{formatAmount(ltvPercent, 1)}%</span>
          <small>{t("ltvLabel")}</small>
        </div>
        <div className="selfloan-scene__meter-copy">
          <CoinArt size={34} variant="gas" className="selfloan-scene__borrow-token" decorative />
          <span>{t("estimatedBorrowNet")}</span>
          <strong>{formatAmount(displayedBorrow, 2)} GAS</strong>
          <small>{t("originationFee", { percent: formatAmount(feePercent, 2) })}</small>
        </div>
      </section>
      <div className="selfloan-scene__route" aria-label={t("borrowFlowBoard")}>
        <span><CoinArt size={22} variant="neo" decorative /> {t("flowNodeCollateral")}</span>
        <span><TrendingUp size={16} /> {t("flowNodeLtv")}</span>
        <span><CoinArt size={22} variant="gas" decorative /> {t("flowNodeBorrow")}</span>
      </div>
      {(isBorrowing || borrowPreview) && <ParticleBurst coins count={7} />}
    </div>
  );

  const controls = (
    <div className="selfloan-desk">
      {hasPendingConfirmation && (
        <p className="selfloan-desk__notice" data-tone="pending" role="status">{pendingConfirmation || t("pendingConfirmationLabel")}</p>
      )}
      {poolIsTight && (
        <p className="selfloan-desk__notice" data-tone="warning" role="alert">{t("insufficientPool", { pool: poolDisplay })}</p>
      )}
      <section className="selfloan-card selfloan-card--amount">
        <div className="selfloan-card__header">
          <span>{t("collateralPlan")}</span>
          <strong><CoinArt size={18} variant="neo" decorative /> {neoBalanceDisplay} NEO</strong>
        </div>
        <div className="selfloan-vault-picker" aria-label={t("amountToLock")}>
          <div className="selfloan-vault-picker__vault" aria-hidden="true">
            <CoinArt size={34} variant="neo" decorative />
            <CoinArt size={26} variant="neo" decorative />
            <span><LockKeyhole size={15} /></span>
          </div>
          <div className="selfloan-vault-picker__amount">
            <span><WalletCards size={15} /> {t("amountToLock")}</span>
            <label className="selfloan-vault-picker__field">
              <span className="selfloan-vault-picker__sr">{t("amountToLock")}</span>
              <input
                className="selfloan-amount-input"
                value={draftCollateral}
                onChange={(event) => updateCollateral(event.target.value)}
                placeholder="10"
                inputMode="numeric"
                disabled={busy || hasActiveLoan}
              />
              <strong>NEO</strong>
            </label>
            <small>{t("collateralAssetHint")}</small>
          </div>
          <div className="selfloan-vault-picker__steppers" aria-label={t("collateralStepper")}>
            <button type="button" onClick={() => adjustCollateral(-1)} disabled={busy || hasActiveLoan || collateralNum <= 0} aria-label={t("decreaseCollateral")}>
              <Minus size={15} />
            </button>
            <button type="button" onClick={() => adjustCollateral(1)} disabled={busy || hasActiveLoan || (walletNeo > 0 && collateralNum >= walletNeo)} aria-label={t("increaseCollateral")}>
              <Plus size={15} />
            </button>
          </div>
        </div>
        <div className="selfloan-quick-row" aria-label={t("quickCollateral")}>
          {quickAmounts.map((amount) => (
            <button key={amount} type="button" onClick={() => updateCollateral(amount)} disabled={busy || hasActiveLoan}>
              <CoinArt size={16} variant="neo" decorative /> {amount} NEO
            </button>
          ))}
          <button type="button" className="selfloan-quick-row__max" onClick={useMaxCollateral} disabled={busy || hasActiveLoan || walletNeo <= 0}>
            {t("maxCollateral")}
          </button>
        </div>
      </section>

      <section className="selfloan-card">
        <div className="selfloan-card__header">
          <span>{t("riskRoute")}</span>
          <strong>{t("selectedLTV")}</strong>
        </div>
        <div className="selfloan-tier-grid" role="radiogroup" aria-label={t("ltvTier")}>
          {ltvOptions.map((option) => {
            const active = option.tier === selectedTier;
            return (
              <button
                key={option.tier}
                type="button"
                className={active ? "selfloan-tier-card is-active" : "selfloan-tier-card"}
                onClick={() => selectTier(option.tier)}
                disabled={busy || hasActiveLoan}
                aria-pressed={active}
              >
                <span>{option.label}</span>
                <strong>{formatAmount(option.percent, 1)}%</strong>
                <small>{option.desc}</small>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );

  const drawer = (
    <div className="selfloan-drawer">
      <section className="selfloan-drawer__grid">
        <article>
          <span>{t("availableBalance")}</span>
          <strong>{neoBalanceDisplay} NEO</strong>
          <small>{t("yourBalance")}</small>
        </article>
        <article>
          <span>{t("poolAvailable")}</span>
          <strong>{poolLabel}</strong>
          <small>{t("availablePool")}</small>
        </article>
        <article>
          <span>{t("rateLabel")}</span>
          <strong>{neoPriceDisplay || t("notAvailable")}</strong>
          <small>{t("rateFeeNote")}</small>
        </article>
      </section>
      <section className="selfloan-drawer__section">
        <h4>{t("safetyPreview")}</h4>
        <dl className="selfloan-terms">
          <div><dt>{t("collateral")}</dt><dd>{formatAmount(displayedCollateral, 0)} NEO</dd></div>
          <div><dt>{t("estimatedBorrowNet")}</dt><dd>{formatAmount(displayedBorrow, 2)} GAS</dd></div>
          <div><dt>{healthMetricLabel}</dt><dd>{healthFactorDisplay}</dd></div>
          <div><dt>{t("currentLTV")}</dt><dd>{currentLTVDisplay}</dd></div>
        </dl>
      </section>
      <section className="selfloan-drawer__section">
        <h4>{t("reclaimTools")}</h4>
        <div className="selfloan-reclaim-row">
          <button type="button" onClick={() => void dispatch("reclaimCollateral")} disabled={!hasCollateralCredit || busy}>
            {t("reclaimCollateral")} · {collateralCreditLabel}
          </button>
          <button type="button" onClick={() => void dispatch("reclaimRepayCredit")} disabled={!hasRepayCredit || busy}>
            {t("reclaimRepayCredit")} · {repayCreditLabel}
          </button>
        </div>
      </section>
    </div>
  );

  return (
    <div className="self-loan-play-area mx2 mx2-cat-defi">
      <PlayStage
        category="defi"
        stage={{
          eyebrow: t("borrowFlowKicker"),
          title: hasActiveLoan ? t("yourLoan") : t("borrowNow"),
          subtitle: t("note"),
          badges: <span className="mx2-badge" data-tone="accent"><span className="mx2-badge__dot" /> {t("available")}: {poolLabel}</span>,
        }}
        scene={<>{scene}{controls}</>}
        score={[
          { label: t("collateral"), value: `${formatAmount(displayedCollateral, 0)} NEO`, accent: true },
          { label: t("estimatedBorrow"), value: `${formatAmount(displayedBorrow, 2)} GAS` },
          { label: t("selectedLTV"), value: `${formatAmount(ltvPercent, 1)}%` },
        ]}
        actions={{
          primary: {
            label: hasActiveLoan ? t("loanStatus") : (busy ? t("borrowFlowBorrowing") : t("borrow")),
            icon: <ArrowDownRight size={17} />,
            onClick: handleBorrow,
            disabled: hasActiveLoan || !canBorrow,
            loading: isBorrowing || borrowPreview,
          },
          secondary: [
            ...(hasActiveLoan ? [{
              label: t("repay"),
              icon: <Banknote size={15} />,
              onClick: handleRepay,
              loading: isRepaying,
            }] : []),
            ...(hasActiveLoan ? [{
              label: t("addCollateral"),
              icon: <PlusCircle size={15} />,
              onClick: handleAddCollateral,
              disabled: !collateralReady,
              loading: isAddingCollateral,
            }] : []),
          ],
        }}
        drawerToggleLabel={t("borrowFlowBoard")}
        drawer={{ title: t("borrowFlowBoard"), children: drawer }}
      />
    </div>
  );
}
