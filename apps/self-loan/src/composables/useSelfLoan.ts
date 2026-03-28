/**
 * useSelfLoan — Unified domain composable for the Self-Loan miniapp
 *
 * Replaces the legacy 3-file pattern:
 *   useSelfLoanCore.ts + useSelfLoanHistory.ts + useSelfLoan.ts (orchestrator)
 *
 * Uses PlatformServices (ChainService + EventBus) instead of:
 *   - useContractInteraction(hash) -> chain.read() / chain.invoke()
 *   - useStatusMessage() -> eventBus.emit()
 *   - useEvents() -> chain.listEvents() / chain.listAllEvents()
 *   - useWalletBalanceReader() -> chain.read() on NEO_HASH
 */

import { ref, computed } from "vue";
import type { ChainService, EventBus } from "@shared/services";
import { formatNumber, parseGas, toFixedDecimals } from "@shared/utils/format";
import { parseStackItem } from "@shared/utils/neo";
import { BLOCKCHAIN_CONSTANTS } from "@shared/constants";

// ============================================================================
// Constants
// ============================================================================

const APP_ID = "miniapp-self-loan";

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

export interface ContractLoanEntry {
  id: number;
  createdTime: number;
  netBorrow: number;
  repaid: number;
  active: boolean;
  collateral: number;
}

export interface UseSelfLoanOptions {
  chain: ChainService;
  eventBus: EventBus;
  t: (key: string, params?: Record<string, string | number>) => string;
}

// ============================================================================
// Composable
// ============================================================================

export function useSelfLoan({ chain, eventBus, t }: UseSelfLoanOptions) {
  // ── Helpers ──────────────────────────────────────────────────────────
  const fmt = (n: number, d = 2) => formatNumber(n, d);
  const toNumber = (value: unknown) => {
    const num = Number(value ?? 0);
    return Number.isFinite(num) ? num : 0;
  };

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
  const isConnected = computed(() => Boolean(chain.address.value));
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

  // ── Data Loading ────────────────────────────────────────────────────

  const readNeoBalance = async (): Promise<number> => {
    if (!chain.address.value) return 0;
    const raw = await chain.read(
      "balanceOf",
      [{ type: "Hash160", value: chain.address.value }],
      { scriptHash: BLOCKCHAIN_CONSTANTS.NEO_HASH },
    );
    return Number(raw ?? 0);
  };

  const loadBalance = async () => {
    if (!chain.address.value) return;
    try {
      neoBalance.value = await readNeoBalance();
    } catch (e) {
      console.warn("[useSelfLoan] loadBalance failed:", e instanceof Error ? e.message : String(e));
    }
  };

  const loadLoanPosition = async (loanId: number) => {
    try {
      const parsed = await chain.read("GetLoanDetails", [
        { type: "Integer", value: String(loanId) },
      ]);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        loan.value = { borrowed: 0, collateralLocked: 0, active: false };
        return;
      }
      const data = parsed as Record<string, unknown>;
      const collateral = toNumber(data.collateral);
      const debt = parseGas(data.debt);
      const active = Boolean(data.active);
      const ltvBps = toNumber(data.ltvBps);
      const ltvPercent = ltvBps ? ltvBps / 100 : selectedLtvPercent.value;
      loan.value = {
        borrowed: active ? debt : 0,
        collateralLocked: active ? collateral : 0,
        active,
        id: loanId,
        ltvPercent,
      };
    } catch (e) {
      console.warn("[useSelfLoan] loadLoanPosition failed:", e instanceof Error ? e.message : String(e));
      loan.value = { borrowed: 0, collateralLocked: 0, active: false };
    }
  };

  const loadPlatformStats = async () => {
    try {
      const parsed = await chain.read("GetPlatformStats");
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const data = parsed as Record<string, unknown>;
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

  // ── History Loading ─────────────────────────────────────────────────

  const ownerMatches = (value: unknown, currentAddress: string) => {
    return String(value || "") === currentAddress;
  };

  const loadHistoryFromContract = async () => {
    if (!chain.address.value) return;

    try {
      const countResult = await chain.read("GetUserLoanCount", [
        { type: "Hash160", value: chain.address.value },
      ]);
      const count = Number(countResult || 0);
      if (!count) {
        stats.value = { totalLoans: 0, totalBorrowed: 0, totalRepaid: 0 };
        loanHistory.value = [];
        return;
      }

      const limit = Math.min(count, 50);
      const idsResult = await chain.read("GetUserLoans", [
        { type: "Hash160", value: chain.address.value },
        { type: "Integer", value: "0" },
        { type: "Integer", value: String(limit) },
      ]);
      const idsRaw = idsResult;
      const idsList = Array.isArray(idsRaw) ? idsRaw : idsRaw != null ? [idsRaw] : [];
      const ids = idsList.map((id) => Number(id)).filter((id) => id > 0);

      const entries = await Promise.all(
        ids.map(async (loanId) => {
          try {
            const parsed = await chain.read("GetLoanDetails", [
              { type: "Integer", value: String(loanId) },
            ]);
            if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
            const data = parsed as Record<string, unknown>;
            return {
              id: loanId,
              createdTime: Number(data.createdTime || 0),
              netBorrow: parseGas(data.originalDebt),
              repaid: parseGas(data.totalRepaid),
              active: Boolean(data.active),
              collateral: toNumber(data.collateral),
            } as ContractLoanEntry;
          } catch (_e) {
            return null;
          }
        }),
      );

      const validEntries = entries.filter((entry): entry is ContractLoanEntry => Boolean(entry));
      stats.value = {
        totalLoans: validEntries.length,
        totalBorrowed: validEntries.reduce((sum, entry) => sum + entry.netBorrow, 0),
        totalRepaid: validEntries.reduce((sum, entry) => sum + entry.repaid, 0),
      };

      const history = validEntries
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
          return [createdLabel, repaidLabel, closedLabel].filter(Boolean);
        })
        .sort((a, b) => Number(b?.timestampRaw || 0) - Number(a?.timestampRaw || 0));

      loanHistory.value = history.slice(0, 20).map((item: Record<string, unknown>) => ({
        icon: item.icon as string,
        label: item.label as string,
        amount: item.amount as number,
        timestamp: new Intl.DateTimeFormat(undefined).format(
          new Date((item.timestampRaw as number) || Date.now()),
        ),
      }));

      const latest = validEntries.reduce((max, entry) => (entry.id > max ? entry.id : max), 0);
      if (latest > 0) {
        await loadLoanPosition(latest);
      }
    } catch (e) {
      console.warn("[useSelfLoan] loadHistoryFromContract failed:", e instanceof Error ? e.message : String(e));
      stats.value = { totalLoans: 0, totalBorrowed: 0, totalRepaid: 0 };
      loanHistory.value = [];
    }
  };

  const loadHistory = async () => {
    if (!chain.address.value) return;

    try {
      const [createdEvents, repaidEvents, closedEvents] = await Promise.all([
        chain.listAllEvents("LoanCreated"),
        chain.listAllEvents("LoanRepaid"),
        chain.listAllEvents("LoanClosed"),
      ]);

      type EventRecord = { state?: unknown[]; created_at?: string; tx_hash?: string };

      const created = (createdEvents as EventRecord[])
        .map((evt) => {
          const values = Array.isArray(evt?.state) ? evt.state.map(parseStackItem) : [];
          return {
            id: Number(values[0] || 0),
            borrower: values[1],
            collateral: toNumber(values[2]),
            borrowed: parseGas(values[3]),
            timestamp: evt.created_at,
            tx: evt.tx_hash,
          };
        })
        .filter((entry) => entry.id > 0 && ownerMatches(entry.borrower, chain.address.value as string));

      const loanIds = new Set(created.map((entry) => entry.id));

      const repaid = (repaidEvents as EventRecord[])
        .map((evt) => {
          const values = Array.isArray(evt?.state) ? evt.state.map(parseStackItem) : [];
          return {
            id: Number(values[0] || 0),
            repaid: parseGas(values[1]),
            timestamp: evt.created_at,
            tx: evt.tx_hash,
          };
        })
        .filter((entry) => loanIds.has(entry.id));

      const closed = (closedEvents as EventRecord[])
        .map((evt) => {
          const values = Array.isArray(evt?.state) ? evt.state.map(parseStackItem) : [];
          return {
            id: Number(values[0] || 0),
            borrower: values[1],
            timestamp: evt.created_at,
            tx: evt.tx_hash,
          };
        })
        .filter(
          (entry) =>
            loanIds.has(entry.id) || ownerMatches(entry.borrower, chain.address.value as string),
        );

      if (created.length === 0) {
        await loadHistoryFromContract();
        return;
      }

      stats.value = {
        totalLoans: created.length,
        totalBorrowed: created.reduce((sum, entry) => sum + entry.borrowed, 0),
        totalRepaid: repaid.reduce((sum, entry) => sum + entry.repaid, 0),
      };

      const history = [
        ...created.map((entry) => ({
          icon: "\uD83D\uDCB0",
          label: t("borrowedLabel"),
          amount: entry.borrowed,
          timestampRaw: entry.timestamp,
        })),
        ...repaid.map((entry) => ({
          icon: "\u21A9\uFE0F",
          label: t("repaidLabel"),
          amount: entry.repaid,
          timestampRaw: entry.timestamp,
        })),
        ...closed.map((entry) => ({
          icon: "\u2705",
          label: t("closedLabel"),
          amount: 0,
          timestampRaw: entry.timestamp,
        })),
      ].sort(
        (a, b) =>
          new Date(b.timestampRaw || 0).getTime() - new Date(a.timestampRaw || 0).getTime(),
      );

      loanHistory.value = history.slice(0, 20).map((item) => ({
        icon: item.icon,
        label: item.label,
        amount: item.amount,
        timestamp: new Intl.DateTimeFormat(undefined).format(
          new Date(item.timestampRaw || Date.now()),
        ),
      }));

      if (created.length > 0) {
        const latest = created.reduce((max, entry) => (entry.id > max ? entry.id : max), 0);
        await loadLoanPosition(latest);
      }
    } catch (e) {
      console.warn("[useSelfLoan] loadHistory failed:", e instanceof Error ? e.message : String(e));
      await loadHistoryFromContract();
    }
  };

  // ── Actions ─────────────────────────────────────────────────────────

  const takeLoan = async () => {
    if (isLoading.value) return;

    const validation = validateCollateral(collateralAmount.value, neoBalance.value);
    if (validation) {
      eventBus.emit("loan:error", { message: validation });
      throw new Error(validation);
    }

    const collateral = Number(toFixedDecimals(collateralAmount.value, 0));
    const ltvPercent = selectedLtvPercent.value;
    const feeBps = platformFeeBps.value;
    const grossBorrow = (collateral * ltvPercent) / 100;
    const feeAmount = (grossBorrow * feeBps) / 10000;
    const netBorrow = Math.max(grossBorrow - feeAmount, 0);

    isLoading.value = true;
    try {
      await chain.ensureWallet();
      if (!chain.address.value) throw new Error(t("connectWallet"));

      // Step 1: Transfer NEO collateral to the contract
      await chain.invoke(
        "transfer",
        [
          { type: "Hash160", value: chain.address.value },
          { type: "Hash160", value: chain.contractAddress.value as string },
          { type: "Integer", value: collateral },
          { type: "String", value: `${APP_ID}:collateral` },
        ],
        { scriptHash: BLOCKCHAIN_CONSTANTS.NEO_HASH },
      );

      await new Promise((resolve) => setTimeout(resolve, 4000));

      // Step 2: Create the loan
      await chain.invoke("CreateLoan", [
        { type: "Hash160", value: chain.address.value },
        { type: "Integer", value: collateral },
        { type: "Integer", value: selectedTier.value },
      ]);

      eventBus.emit("loan:created", {
        action: t("loanApproved", { amount: fmt(netBorrow, 2), tokenGas: t("tokenGas") }),
      });
      collateralAmount.value = "";
      await loadAll();
    } catch (e) {
      eventBus.emit("loan:error", {
        message: e instanceof Error ? e.message : t("error"),
      });
      throw e;
    } finally {
      isLoading.value = false;
    }
  };

  // ── Lifecycle ───────────────────────────────────────────────────────

  const loadAll = async () => {
    await loadPlatformStats();
    await loadBalance();
    await loadHistory();
  };

  const connect = async () => {
    await chain.ensureWallet();
  };

  // ── Public API ──────────────────────────────────────────────────────

  return {
    // Core refs
    address: chain.address,
    connect,
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
    APP_ID,
  };
}

export type UseSelfLoanReturn = ReturnType<typeof useSelfLoan>;
