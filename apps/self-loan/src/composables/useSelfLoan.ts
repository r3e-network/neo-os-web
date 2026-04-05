/**
 * useSelfLoan — Domain logic for the Self-Loan miniapp (OS Services Pattern)
 *
 * Migrated to OS service proxies. All contract interaction is delegated to
 * OS services (PaymentProxy, EscrowProxy, StorageProxy, BadgeProxy) via
 * edge functions, so this file contains zero contract hashes, parameter
 * encoding, or event parsing logic.
 *
 * Migration from direct chain calls to OS services:
 *
 *   BEFORE (chain):
 *     chain.read("balanceOf", [...], { scriptHash: NEO_HASH })
 *     chain.read("GetPlatformStats")
 *     chain.read("GetLoanDetails", [...])
 *     chain.read("GetUserLoanCount", [...])
 *     chain.read("GetUserLoans", [...])
 *     chain.invoke("transfer", [...], { scriptHash: NEO_HASH })
 *     chain.invoke("CreateLoan", [...])
 *     chain.listAllEvents("LoanCreated" | "LoanRepaid" | "LoanClosed")
 *
 *   AFTER (OS proxy):
 *     paymentService.getBalance()            — NEO balance
 *     paymentService.deposit(amount, memo)   — lock collateral
 *     storageService.get("platform-stats")   — platform config
 *     storageService.get("loan:active")      — current loan position
 *     storageService.list("loan:")           — loan history & stats
 *     escrowService.create(params)           — create loan escrow
 *     escrowService.get(escrowId)            — loan position details
 *     escrowService.refund(escrowId)         — release collateral on repayment
 *     badgeService.award(badgeId, user)      — achievement milestones
 *
 * The composable still owns:
 *   - Reactive state (refs + computed) for manifest bindings
 *   - LTV tier selection and terms calculation
 *   - Health factor / LTV gauge computeds
 *   - Validation (pure frontend checks)
 *   - Loading UI flags
 *   - Formatted display values
 */

import { ref, computed } from "vue";
import type { PaymentProxy } from "@shared/services/os/PaymentProxy";
import type { EscrowProxy } from "@shared/services/os/EscrowProxy";
import type { StorageProxy } from "@shared/services/os/StorageProxy";
import type { BadgeProxy } from "@shared/services/os/BadgeProxy";
import { formatNumber, toFixedDecimals, toSafeNumber } from "@shared/utils/format";

// ============================================================================
// Types
// ============================================================================

export type Terms = { ltvPercent: number; minDurationHours: number };
export type Loan = {
  borrowed: number;
  collateralLocked: number;
  active: boolean;
  id?: number | null;
  ltvPercent?: number;
};
export type LtvOption = { tier: number; percent: number; label: string; desc?: string };
export type PlatformStats = {
  ltvTier1Bps: number;
  ltvTier2Bps: number;
  ltvTier3Bps: number;
  minLoanDurationSeconds: number;
  platformFeeBps: number;
};

export interface LoanHistoryEntry {
  icon: string;
  label: string;
  amount: number;
  timestamp: string;
}

export interface LoanStats {
  totalLoans: number;
  totalBorrowed: number;
  totalRepaid: number;
}

export interface UseSelfLoanOptions {
  /** OS PaymentProxy instance from ctx.os.payment */
  paymentService: PaymentProxy;
  /** OS EscrowProxy instance from ctx.os.escrow */
  escrowService: EscrowProxy;
  /** OS StorageProxy instance from ctx.os.storage */
  storageService: StorageProxy;
  /** OS BadgeProxy instance from ctx.os.badge */
  badgeService: BadgeProxy;
  /** Translation function */
  t: (key: string, params?: Record<string, string | number>) => string;
}

// ============================================================================
// Composable
// ============================================================================

export function useSelfLoan({
  paymentService,
  escrowService,
  storageService,
  badgeService,
  t,
}: UseSelfLoanOptions) {
  // ── Helpers ──────────────────────────────────────────────────────────
  const fmt = (n: number, d = 2) => formatNumber(n, d);
  const toNumber = toSafeNumber;

  // ── Core State ──────────────────────────────────────────────────────
  const isLoading = ref(false);
  const neoBalance = ref(0);
  const platformStats = ref<PlatformStats>({
    ltvTier1Bps: 2000,
    ltvTier2Bps: 3000,
    ltvTier3Bps: 4000,
    minLoanDurationSeconds: 86400,
    platformFeeBps: 50,
  });
  const selectedTier = ref(1);
  const loan = ref<Loan>({ borrowed: 0, collateralLocked: 0, active: false });
  const collateralAmount = ref<string>("");

  // ── History State ───────────────────────────────────────────────────
  const stats = ref<LoanStats>({ totalLoans: 0, totalBorrowed: 0, totalRepaid: 0 });
  const loanHistory = ref<LoanHistoryEntry[]>([]);

  // ── Computed: LTV Options ───────────────────────────────────────────
  const ltvOptions = computed<LtvOption[]>(() => [
    {
      tier: 1,
      percent: Number((platformStats.value.ltvTier1Bps / 100).toFixed(1)),
      label: t("ltvTierConservative"),
      desc: t("ltvTierConservativeDesc"),
    },
    {
      tier: 2,
      percent: Number((platformStats.value.ltvTier2Bps / 100).toFixed(1)),
      label: t("ltvTierBalanced"),
      desc: t("ltvTierBalancedDesc"),
    },
    {
      tier: 3,
      percent: Number((platformStats.value.ltvTier3Bps / 100).toFixed(1)),
      label: t("ltvTierAggressive"),
      desc: t("ltvTierAggressiveDesc"),
    },
  ]);

  const selectedLtvPercent = computed(() => {
    const option = ltvOptions.value.find((entry) => entry.tier === selectedTier.value);
    return option?.percent ?? 20;
  });

  const minDurationHours = computed(() =>
    Math.max(1, Math.round(platformStats.value.minLoanDurationSeconds / 3600)),
  );
  const platformFeeBps = computed(() => platformStats.value.platformFeeBps);

  const borrowTerms = computed<Terms>(() => ({
    ltvPercent: selectedLtvPercent.value,
    minDurationHours: minDurationHours.value,
  }));

  const positionTerms = computed<Terms>(() => ({
    ltvPercent: loan.value.ltvPercent ?? selectedLtvPercent.value,
    minDurationHours: minDurationHours.value,
  }));

  // ── Computed: Position Metrics ──────────────────────────────────────
  const healthFactor = computed(() => {
    if (loan.value.borrowed === 0) return 999;
    return loan.value.collateralLocked / loan.value.borrowed;
  });

  const currentLTV = computed(() => {
    if (loan.value.collateralLocked === 0) return 0;
    return Math.round((loan.value.borrowed / loan.value.collateralLocked) * 100);
  });

  const collateralUtilization = computed(() => {
    const total = loan.value.collateralLocked + neoBalance.value;
    if (total === 0) return 0;
    return Math.round((loan.value.collateralLocked / total) * 100);
  });

  // ── Computed: Display Values ────────────────────────────────────────
  const isConnected = ref(false);
  const collateralDisplay = computed(() => fmt(loan.value.collateralLocked));
  const borrowedDisplay = computed(() => fmt(loan.value.borrowed));

  const healthFactorDisplay = computed(() => {
    const hf = healthFactor.value;
    if (hf >= 999) return t("notAvailable");
    return fmt(hf, 2);
  });

  const currentLTVDisplay = computed(() => {
    const ltv = currentLTV.value;
    if (ltv === 0 && !loan.value.active) return t("notAvailable");
    return `${ltv}%`;
  });

  const hasLoanDisplay = computed(() =>
    loan.value.active ? t("yes") : t("no"),
  );

  const neoBalanceDisplay = computed(() => fmt(neoBalance.value, 0));
  const totalLoans = computed(() => stats.value.totalLoans);
  const totalBorrowedDisplay = computed(() => fmt(stats.value.totalBorrowed));
  const totalRepaidDisplay = computed(() => fmt(stats.value.totalRepaid));

  // ── Computed: Health Gauge ──────────────────────────────────────────
  const healthColor = computed(() => {
    const hf = healthFactor.value;
    if (!hf || hf >= 999) return "rgba(255,255,255,0.2)";
    if (hf >= 1.5) return "var(--checkbook-success, #34d399)";
    if (hf >= 1.2) return "var(--checkbook-warning, #fbbf24)";
    return "var(--checkbook-danger, #f87171)";
  });

  const healthArc = computed(() => {
    const hf = healthFactor.value;
    if (!hf || hf >= 999) return 0;
    return Math.min(hf / 2, 1) * 327;
  });

  // ── Validation ──────────────────────────────────────────────────────
  const validateCollateral = (amount: string, balance: number): string | null => {
    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) return t("enterValidAmount");
    if (!Number.isInteger(num)) return t("neoMustBeInteger");
    if (num > balance) return t("insufficientNeo");
    return null;
  };

  // ── Data Loading (via OS services) ──────────────────────────────────

  /**
   * Load NEO balance via PaymentProxy.
   * The edge function handles the NEP-17 balanceOf call.
   */
  const loadBalance = async () => {
    try {
      const balanceStr = await paymentService.getBalance();
      neoBalance.value = toNumber(balanceStr);
    } catch (e) {
      console.warn("[useSelfLoan] loadBalance failed:", e instanceof Error ? e.message : String(e));
    }
  };

  /**
   * Load platform configuration via StorageProxy.
   * The edge function reads the contract's GetPlatformStats or
   * returns cached platform config.
   */
  const loadPlatformStats = async () => {
    try {
      const raw = await storageService.get("platform-stats");
      if (raw && typeof raw === "object" && !Array.isArray(raw)) {
        const data = raw as Record<string, unknown>;
        const feeBps = toNumber(data.platformFeeBps);
        platformStats.value = {
          ltvTier1Bps: toNumber(data.ltvTier1Bps) || platformStats.value.ltvTier1Bps,
          ltvTier2Bps: toNumber(data.ltvTier2Bps) || platformStats.value.ltvTier2Bps,
          ltvTier3Bps: toNumber(data.ltvTier3Bps) || platformStats.value.ltvTier3Bps,
          minLoanDurationSeconds:
            toNumber(data.minLoanDurationSeconds) || platformStats.value.minLoanDurationSeconds,
          platformFeeBps: feeBps > 0 ? feeBps : platformStats.value.platformFeeBps,
        };
      }
    } catch (e) {
      console.warn("[useSelfLoan] loadPlatformStats failed:", e instanceof Error ? e.message : String(e));
    }
  };

  /**
   * Load the active loan position via EscrowProxy.
   * The edge function translates the escrow state to loan position data.
   */
  const loadLoanPosition = async (loanId: string) => {
    try {
      const raw = await escrowService.get(loanId);
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        loan.value = { borrowed: 0, collateralLocked: 0, active: false };
        return;
      }
      const data = raw as Record<string, unknown>;
      const collateral = toNumber(data.collateral);
      const debt = toNumber(data.debt);
      const active = Boolean(data.active);
      const ltvBps = toNumber(data.ltvBps);
      const ltvPercent = ltvBps ? ltvBps / 100 : selectedLtvPercent.value;
      loan.value = {
        borrowed: active ? debt : 0,
        collateralLocked: active ? collateral : 0,
        active,
        id: toNumber(data.id) || null,
        ltvPercent,
      };
    } catch (e) {
      console.warn("[useSelfLoan] loadLoanPosition failed:", e instanceof Error ? e.message : String(e));
      loan.value = { borrowed: 0, collateralLocked: 0, active: false };
    }
  };

  /**
   * Load loan history and stats via StorageProxy.
   * The edge function aggregates loan events and contract state
   * into a normalized list of history entries and summary stats.
   */
  const loadHistory = async () => {
    try {
      const raw = await storageService.list("loan:");
      if (!raw || typeof raw !== "object") {
        stats.value = { totalLoans: 0, totalBorrowed: 0, totalRepaid: 0 };
        loanHistory.value = [];
        return;
      }

      const data = raw as Record<string, unknown>;
      const entries = Object.entries(data)
        .map(([key, value]) => {
          if (!value || typeof value !== "object") return null;
          const entry = value as Record<string, unknown>;
          return {
            id: toNumber(entry.id),
            netBorrow: toNumber(entry.netBorrow),
            repaid: toNumber(entry.repaid),
            active: Boolean(entry.active),
            collateral: toNumber(entry.collateral),
            createdTime: toNumber(entry.createdTime),
          };
        })
        .filter((entry): entry is {
          id: number;
          netBorrow: number;
          repaid: number;
          active: boolean;
          collateral: number;
          createdTime: number;
        } => entry !== null && entry.id > 0);

      stats.value = {
        totalLoans: entries.length,
        totalBorrowed: entries.reduce((sum, entry) => sum + entry.netBorrow, 0),
        totalRepaid: entries.reduce((sum, entry) => sum + entry.repaid, 0),
      };

      const history = entries
        .flatMap((entry) => {
          const createdLabel = {
            icon: "\uD83D\uDCB0",
            label: t("borrowedLabel"),
            amount: entry.netBorrow,
            timestampRaw: entry.createdTime * 1000,
          };
          const repaidLabel =
            entry.repaid > 0
              ? {
                  icon: "\u21A9\uFE0F",
                  label: t("repaidLabel"),
                  amount: entry.repaid,
                  timestampRaw: entry.createdTime * 1000,
                }
              : null;
          const closedLabel = entry.active
            ? null
            : {
                icon: "\u2705",
                label: t("closedLabel"),
                amount: 0,
                timestampRaw: entry.createdTime * 1000,
              };
          return [createdLabel, repaidLabel, closedLabel].filter(
            (x): x is { icon: string; label: string; amount: number; timestampRaw: number } => x !== null,
          );
        })
        .sort((a, b) => Number(b.timestampRaw || 0) - Number(a.timestampRaw || 0));

      loanHistory.value = history.slice(0, 20).map((item) => ({
        icon: item.icon,
        label: item.label,
        amount: item.amount,
        timestamp: new Intl.DateTimeFormat(undefined).format(
          new Date(item.timestampRaw || Date.now()),
        ),
      }));

      // Load the latest active loan position
      const activeLoan = entries.find((e) => e.active);
      if (activeLoan) {
        await loadLoanPosition(String(activeLoan.id));
      }
    } catch (e) {
      console.warn("[useSelfLoan] loadHistory failed:", e instanceof Error ? e.message : String(e));
      stats.value = { totalLoans: 0, totalBorrowed: 0, totalRepaid: 0 };
      loanHistory.value = [];
    }
  };

  // ── Actions (via OS services) ───────────────────────────────────────

  /**
   * Take a self-loan via PaymentProxy (deposit collateral) + EscrowProxy
   * (create loan escrow).
   *
   * The OS payment service handles wallet connection and NEO transfer.
   * The OS escrow service handles the CreateLoan contract call and
   * locks collateral until repayment.
   */
  const takeLoan = async () => {
    if (isLoading.value) return;

    const validation = validateCollateral(collateralAmount.value, neoBalance.value);
    if (validation) {
      throw new Error(validation);
    }

    const collateral = Number(toFixedDecimals(collateralAmount.value, 0));
    const ltvPercent = selectedLtvPercent.value;
    const feeBps = platformFeeBps.value;
    const grossBorrow = (collateral * ltvPercent) / 100;
    const feeAmount = (grossBorrow * feeBps) / 10000;
    const netBorrow = Math.max(grossBorrow - feeAmount, 0);

    try {
      isLoading.value = true;

      // Step 1: Deposit NEO collateral via PaymentProxy
      await paymentService.deposit(
        String(collateral),
        `self-loan:collateral:tier${selectedTier.value}`,
      );

      // Step 2: Create loan escrow via EscrowProxy
      // The edge function handles the CreateLoan contract call,
      // locks collateral, and disburses borrowed GAS.
      await escrowService.create({
        beneficiary: "self",
        amount: String(collateral),
        milestones: [
          { name: "collateral-locked", amount: String(collateral) },
          { name: "gas-disbursed", amount: String(netBorrow) },
        ],
      });

      // Step 3: Award first-loan badge if applicable
      try {
        if (stats.value.totalLoans === 0) {
          await badgeService.award("first-loan", "self");
        }
      } catch (_badgeErr) {
        // Badge award is non-critical; don't block the loan flow
      }

      collateralAmount.value = "";
      await loadAll();
    } catch (e) {
      throw e;
    } finally {
      isLoading.value = false;
    }
  };

  // ── Lifecycle ───────────────────────────────────────────────────────

  /**
   * Load all data. Called by defineMiniApp on mount and wallet reconnect.
   */
  const loadAll = async () => {
    await loadPlatformStats();
    await loadBalance();
    await loadHistory();
  };

  // ── Public API ──────────────────────────────────────────────────────

  return {
    // Core refs
    isLoading,
    neoBalance,
    loan,
    collateralAmount,
    selectedTier,
    ltvOptions,
    selectedLtvPercent,
    minDurationHours,
    platformFeeBps,
    borrowTerms,
    positionTerms,
    healthFactor,
    currentLTV,
    collateralUtilization,
    validateCollateral,

    // History
    stats,
    loanHistory,
    loadHistory,

    // Display computeds
    isConnected,
    collateralDisplay,
    borrowedDisplay,
    healthFactorDisplay,
    currentLTVDisplay,
    hasLoanDisplay,
    neoBalanceDisplay,
    totalLoans,
    totalBorrowedDisplay,
    totalRepaidDisplay,

    // Gauge computeds
    healthColor,
    healthArc,

    // Actions
    takeLoan,

    // Lifecycle
    loadAll,
    fmt,
    t,
  };
}

export type UseSelfLoanReturn = ReturnType<typeof useSelfLoan>;
