/**
 * useSelfLoan — Orchestrating composable for the Self-Loan miniapp
 *
 * Combines useSelfLoanCore (domain logic) and useSelfLoanHistory (events/stats)
 * with display-level computed values (health color, gauge arc, formatted strings).
 *
 * All computation lives here; PlayArea.vue stays presentation-only.
 */

import { computed } from "vue";
import { useSelfLoanCore } from "./useSelfLoanCore";
import { useSelfLoanHistory } from "./useSelfLoanHistory";

interface SelfLoanDeps {
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function useSelfLoan(deps: SelfLoanDeps) {
  const core = useSelfLoanCore();
  const history = useSelfLoanHistory({
    address: core.address,
    ensureContractAddress: core.ensureContractAddress,
    loadLoanPosition: core.loadLoanPosition,
  });

  const t = deps.t;

  // ── Display-formatted values ─────────────────────────────────────────

  const collateralDisplay = computed(() => core.fmt(core.loan.value.collateralLocked));
  const borrowedDisplay = computed(() => core.fmt(core.loan.value.borrowed));

  const healthFactorDisplay = computed(() => {
    const hf = core.healthFactor.value;
    if (hf >= 999) return t("notAvailable");
    return core.fmt(hf, 2);
  });

  const currentLTVDisplay = computed(() => {
    const ltv = core.currentLTV.value;
    if (ltv === 0 && !core.loan.value.active) return t("notAvailable");
    return `${ltv}%`;
  });

  const isConnected = computed(() => Boolean(core.address.value));

  const hasLoanDisplay = computed(() =>
    core.loan.value.active ? t("yes") : t("no"),
  );

  const neoBalanceDisplay = computed(() => core.fmt(core.neoBalance.value, 0));

  const totalLoans = computed(() => history.stats.value.totalLoans);
  const totalBorrowedDisplay = computed(() => core.fmt(history.stats.value.totalBorrowed));
  const totalRepaidDisplay = computed(() => core.fmt(history.stats.value.totalRepaid));

  // ── Health gauge computations (extracted from PlayArea.vue) ──────────

  const healthColor = computed(() => {
    const hf = core.healthFactor.value;
    if (!hf || hf >= 999) return "rgba(255,255,255,0.2)";
    if (hf >= 1.5) return "var(--checkbook-success, #34d399)";
    if (hf >= 1.2) return "var(--checkbook-warning, #fbbf24)";
    return "var(--checkbook-danger, #f87171)";
  });

  const healthArc = computed(() => {
    const hf = core.healthFactor.value;
    if (!hf || hf >= 999) return 0;
    return Math.min(hf / 2, 1) * 327;
  });

  // ── Data loading ─────────────────────────────────────────────────────

  const loadAll = async () => {
    await core.loadPlatformStats();
    await core.loadBalance();
    await history.loadHistory();
  };

  // ── Public API ───────────────────────────────────────────────────────

  return {
    // Core refs
    ...core,

    // History
    stats: history.stats,
    loanHistory: history.loanHistory,
    loadHistory: history.loadHistory,

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

    // Gauge computeds (extracted from PlayArea)
    healthColor,
    healthArc,

    // Lifecycle
    loadAll,
  };
}
