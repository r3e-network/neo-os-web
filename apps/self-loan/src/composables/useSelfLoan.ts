/**
 * useSelfLoan — Domain logic for the Self-Loan miniapp.
 *
 * Talks DIRECTLY to the app's standalone on-chain contract (MiniAppSelfLoan) via
 * ctx.services.chain. The earlier path delegated the collateral lock, the GAS
 * disbursement, the debt and the repayment to OS PaymentProxy/EscrowProxy/
 * StorageProxy/BadgeProxy edge functions that no contract enforced — the synchronous
 * escrow id never materialized, so the loan position degraded to a local record and
 * the locked NEO had no contract-backed release path (a latent strand). This
 * composable drives the dedicated contract, where the lock, disbursement, debt and
 * repayment are all authoritative on-chain.
 *
 * MODEL (verified against MiniAppSelfLoan.cs / ABI):
 *   * COLLATERAL is NEO (integer token). DEBT is GAS (base units). The owner funds
 *     a GAS lending pool and sets a configured NEO price (GAS base units per 1 NEO)
 *     — NOT a live oracle, matching the app's static council price.
 *   * BORROW (deposit-then-act): a NEO transfer to the contract with memo
 *     "selfloan:collateral" credits the sender's collateral (CollateralCredited);
 *     then borrow(borrower, tier) locks ALL credited collateral, sets the debt to
 *     gross = collateralValue × tierLtvBps / 10000, and disburses (gross − 0.5% fee)
 *     GAS from the pool (LoanTaken).
 *   * ADD COLLATERAL (deposit-then-act): another NEO transfer with the same memo,
 *     then addCollateral(borrower) moves the freshly-credited NEO into the active
 *     loan (CollateralAdded).
 *   * REPAY (deposit-then-act): a GAS transfer with memo "selfloan:repay" credits
 *     repay balance (RepayCredited); then repay(borrower) applies it (capped at the
 *     debt, excess auto-refunded), and on full repayment closes the loan and
 *     releases the NEO collateral (Repaid / LoanClosed).
 *   * RECLAIM: withdraw(account) reclaims NEO collateral-credit never borrowed
 *     against; withdrawRepayCredit(account) reclaims GAS repay-credit never applied.
 *     These are the recovery paths the deposit-then-act model needs.
 *
 *   READS (chain.read, default app contract script hash):
 *     neoPrice()                 -> Integer (GAS base units per 1 NEO; 0 = unset)
 *     pool()                     -> Integer (GAS base units)
 *     collateralCreditOf(user)   -> Integer (WHOLE NEO — never scaled)
 *     repayCreditOf(user)        -> Integer (GAS base units)
 *     getLoan(user)              -> Map{collateral:int NEO, borrowed:int GASbase,
 *                                       ltvBps:int, active:bool}
 *     ltvTierBps(tier)           -> Integer (2000 | 3000 | 4000)
 *     feeBps()                   -> Integer (50)
 *     totalLoans()               -> Integer
 *     totalBorrowed()            -> Integer (GAS base units)
 *     totalRepaid()              -> Integer (GAS base units)
 *     balanceOf(user)            -> Integer (NEP-17; NEO balance is WHOLE NEO)
 *
 * ASSET CONVENTION (the #1 correctness risk — kept strictly separate end-to-end):
 *   * NEO is an INTEGER token (no decimals): 1 NEO = 1 unit. Collateral, neoBalance,
 *     collateralCredit, loan.collateral are WHOLE NEO and are NEVER multiplied by 1e8.
 *     `neoToInteger` rejects fractional NEO before any chain call.
 *   * GAS uses BASE UNITS (×1e8). Debt (loan.borrowed), pool, repayCredit, neoPrice,
 *     totals and disbursements are GAS base units on-chain; the UI scales once on
 *     input with `gasToBaseUnits` (no floats) and divides by 1e8 (`gasFromBaseUnits`)
 *     for display.
 *   * neoPrice is GAS BASE UNITS per 1 NEO, so collateralValueGasBase =
 *     collateralNeoInteger × neoPrice (no extra scaling); divide by 1e8 to display.
 *
 * The composable owns:
 *   - Reactive state (observables + derived) for manifest / PlayArea bindings
 *   - LTV tier selection and the borrow-terms preview against the on-chain tier bps
 *   - Health factor / LTV computeds (value-normalized via neoPrice when set)
 *   - Validation (pure frontend checks — integer NEO, repay cap)
 *   - Loading / processing UI flags (double-submit guards)
 *   - Reclaim affordances for the deposit-then-act recovery paths
 */

import { createObservable, createDerived } from "@shared/react/context";
import type { Observable } from "@shared/react/context";
import type { ChainService } from "@shared/services/ChainService";
import { gasToBaseUnits, neoToInteger } from "@shared/utils/amounts";
import { formatNumber } from "@shared/utils/format";
import { addressToScriptHash } from "@shared/utils/neo";
import { combineBusy } from "@shared/utils/observables";
import { parseBigInt, parseBool } from "@shared/utils/parsers";
import { BLOCKCHAIN_CONSTANTS } from "@shared/constants";

// ============================================================================
// Constants
// ============================================================================

/** Memo the contract requires on the NEO collateral transfer (borrow / add). */
const COLLATERAL_MEMO = "selfloan:collateral";
/** Memo the contract requires on the GAS repay transfer. */
const REPAY_MEMO = "selfloan:repay";

/** NEO is an integer token; its script hash drives collateral transfers. */
const NEO_HASH = BLOCKCHAIN_CONSTANTS.NEO_HASH;
/** GAS script hash drives repay transfers + the GAS pool. */
const GAS_HASH = BLOCKCHAIN_CONSTANTS.GAS_HASH;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error ?? "");
}

function isContractContextPending(error: unknown): boolean {
  const message = errorMessage(error).toLowerCase();
  return message.includes("contract address not configured") || message.includes("contract not configured");
}

function warnLoadFailure(scope: string, error: unknown): void {
  if (isContractContextPending(error)) return;
  console.warn(`[useSelfLoan] ${scope} failed:`, errorMessage(error));
}

// ============================================================================
// Amount helpers (NEO integer vs GAS base units kept strictly separate)
// ============================================================================
// gasToBaseUnits / neoToInteger come from @shared/utils/amounts — the SINGLE
// GAS scaling point (the contract scales nothing); NEO is never ×1e8.

/** Convert a GAS base-unit Integer to whole GAS as a number (÷ 1e8). */
const gasFromBaseUnits = (base: bigint): number => Number(base) / 1e8;

// ============================================================================
// Types
// ============================================================================

export type Terms = { ltvPercent: number; minDurationHours: number };
export type Loan = {
  /** Outstanding GAS debt in WHOLE GAS (display units, ÷1e8). */
  borrowed: number;
  /** Locked collateral in WHOLE NEO (integer). */
  collateralLocked: number;
  active: boolean;
  ltvPercent?: number;
};
export type LtvOption = { tier: number; percent: number; label: string; desc?: string };
export type PlatformStats = {
  ltvTier1Bps: number;
  ltvTier2Bps: number;
  ltvTier3Bps: number;
  platformFeeBps: number;
};

export interface LoanStats {
  totalLoans: number;
  /** Total borrowed in WHOLE GAS (display units, ÷1e8). */
  totalBorrowed: number;
  /** Total repaid in WHOLE GAS (display units, ÷1e8). */
  totalRepaid: number;
}

export interface UseSelfLoanOptions {
  /** Shared chain service from ctx.services.chain. */
  chain: ChainService;
  /** Translation function. */
  t: (key: string, params?: Record<string, string | number>) => string;
}

// ============================================================================
// Composable
// ============================================================================

export function useSelfLoan({ chain, t }: UseSelfLoanOptions) {
  // ── Helpers ──────────────────────────────────────────────────────────
  const fmt = (n: number, d = 2) => formatNumber(n, d);

  // ── Core state ───────────────────────────────────────────────────────
  const isLoading = createObservable(false);
  const isBorrowing = createObservable(false);
  const isRepaying = createObservable(false);
  const isAddingCollateral = createObservable(false);
  const isProcessing = createObservable(false);

  /** Connected wallet's NEO balance — WHOLE NEO (integer, never ÷1e8). */
  const neoBalance = createObservable(0);
  /** Configured NEO price as GAS base units per 1 NEO (0 = unset). */
  const neoPriceBase = createObservable(0n);
  /** NEO price expressed in WHOLE GAS per NEO (for value-normalized metrics). */
  const neoPrice = createObservable(0);
  /** Lending pool liquidity available to disburse — WHOLE GAS (÷1e8). */
  const poolGas = createObservable(0);

  // Monotonic per-action success nonces. They increment ONLY when the action
  // resolves successfully, so the PlayArea can clear its local inputs on a real
  // success and preserve them after a swallowed failure (notify.guard resolves
  // to undefined on error, so the caller cannot otherwise distinguish the two).
  const borrowOkNonce = createObservable(0);
  const repayOkNonce = createObservable(0);
  const addCollateralOkNonce = createObservable(0);

  // A relayed-but-unconfirmed notice: the action's transaction was broadcast but
  // its confirming event was never observed (chain.invoke returns verified=false
  // on a waitForEvent timeout/FAULT). Empty when there is nothing pending. The
  // UI surfaces this as "pending confirmation" rather than a definitive success
  // so the user neither double-submits nor assumes the position already moved.
  const pendingConfirmation = createObservable("");

  const platformStats = createObservable<PlatformStats>({
    ltvTier1Bps: 2000,
    ltvTier2Bps: 3000,
    ltvTier3Bps: 4000,
    platformFeeBps: 50,
  });
  const selectedTier = createObservable(1);
  const loan = createObservable<Loan>({ borrowed: 0, collateralLocked: 0, active: false });
  const collateralAmount = createObservable<string>("");

  /** Reclaimable NEO collateral-credit (deposited, never borrowed) — WHOLE NEO. */
  const collateralCredit = createObservable(0);
  /** Reclaimable GAS repay-credit (deposited, never applied) — WHOLE GAS (÷1e8). */
  const repayCredit = createObservable(0);

  const stats = createObservable<LoanStats>({ totalLoans: 0, totalBorrowed: 0, totalRepaid: 0 });

  const isConnected = createObservable(false);
  const address = createObservable("");

  let isMounted = true;

  const isBusy: Observable<boolean> = combineBusy(isProcessing, isLoading);

  const setAddress = (addr: string) => {
    address.set(addr ?? "");
    isConnected.set(Boolean(addr));
  };

  const myHash = (): string | null => {
    const addr = address.get();
    if (!addr) return null;
    return addressToScriptHash(addr) || null;
  };

  // ── Computed: LTV options (from on-chain tier bps) ───────────────────
  const ltvOptions = createDerived<LtvOption[]>(() => [
    {
      tier: 1,
      percent: Number((platformStats.get().ltvTier1Bps / 100).toFixed(1)),
      label: t("ltvTierConservative"),
      desc: t("ltvTierConservativeDesc"),
    },
    {
      tier: 2,
      percent: Number((platformStats.get().ltvTier2Bps / 100).toFixed(1)),
      label: t("ltvTierBalanced"),
      desc: t("ltvTierBalancedDesc"),
    },
    {
      tier: 3,
      percent: Number((platformStats.get().ltvTier3Bps / 100).toFixed(1)),
      label: t("ltvTierAggressive"),
      desc: t("ltvTierAggressiveDesc"),
    },
  ], [platformStats]);

  const selectedLtvPercent = createDerived(() => {
    const option = ltvOptions.get().find((entry) => entry.tier === selectedTier.get());
    return option?.percent ?? 20;
  }, [ltvOptions, selectedTier]);

  const platformFeeBps = createDerived(() => platformStats.get().platformFeeBps, [platformStats]);

  const borrowTerms = createDerived<Terms>(() => ({
    ltvPercent: selectedLtvPercent.get(),
    minDurationHours: 0,
  }), [selectedLtvPercent]);

  const positionTerms = createDerived<Terms>(() => ({
    ltvPercent: loan.get().ltvPercent ?? selectedLtvPercent.get(),
    minDurationHours: 0,
  }), [loan, selectedLtvPercent]);

  // ── Computed: position metrics ───────────────────────────────────────
  // Collateral is NEO (integer) while debt is GAS (whole-GAS display units). A
  // health-factor / LTV ratio is only meaningful when both legs are valued in the
  // same unit, so the NEO collateral is converted to its GAS-equivalent value via
  // neoPrice (WHOLE GAS per NEO) when a price is configured. With no price
  // (neoPrice === 0) each NEO counts as 1 unit of collateral value (a raw
  // collateralization ratio) and the UI relabels the metric to "Collateral Ratio".
  const collateralValueGas = createDerived(() => {
    const collateral = loan.get().collateralLocked;
    const price = neoPrice.get();
    return price > 0 ? collateral * price : collateral;
  }, [loan, neoPrice]);

  /** True when a NEO price is configured and the ratio is value-normalized. */
  const isPriceNormalized = createDerived(() => neoPrice.get() > 0, [neoPrice]);

  const healthFactor = createDerived(() => {
    if (loan.get().borrowed === 0) return 999;
    return collateralValueGas.get() / loan.get().borrowed;
  }, [loan, neoPrice]);

  const currentLTV = createDerived(() => {
    const collateralValue = collateralValueGas.get();
    if (collateralValue === 0) return 0;
    return Math.round((loan.get().borrowed / collateralValue) * 100);
  }, [loan, neoPrice]);

  const collateralUtilization = createDerived(() => {
    const total = loan.get().collateralLocked + neoBalance.get();
    if (total === 0) return 0;
    return Math.round((loan.get().collateralLocked / total) * 100);
  }, [loan, neoBalance]);

  // ── Computed: display values ─────────────────────────────────────────
  const collateralDisplay = createDerived(() => fmt(loan.get().collateralLocked, 0), [loan]);
  const borrowedDisplay = createDerived(() => fmt(loan.get().borrowed), [loan]);

  const healthFactorDisplay = createDerived(() => {
    const hf = healthFactor.get();
    if (hf >= 999) return t("notAvailable");
    return fmt(hf, 2);
  }, [loan, neoPrice]);

  const currentLTVDisplay = createDerived(() => {
    const ltv = currentLTV.get();
    if (ltv === 0 && !loan.get().active) return t("notAvailable");
    return `${ltv}%`;
  }, [loan, neoPrice]);

  /**
   * Caption for the health metric: a configured price makes the ratio a
   * value-normalized "Health Factor"; otherwise it is a same-unit collateral ratio,
   * surfaced with a distinct label so the number is not misread.
   */
  const healthMetricLabel = createDerived(
    () => (isPriceNormalized.get() ? t("healthFactor") : t("collateralRatio")),
    [neoPrice],
  );

  const hasLoanDisplay = createDerived(() =>
    loan.get().active ? t("yes") : t("no"),
  [loan]);

  const neoBalanceDisplay = createDerived(() => fmt(neoBalance.get(), 0), [neoBalance]);

  /** True when the connected wallet already holds an active loan. */
  const hasActiveLoan = createDerived(() => loan.get().active, [loan]);

  /**
   * The configured NEO price as "1 NEO = X GAS". Empty when no price is set so
   * the UI can hide the rate row rather than show a misleading 0.
   */
  const neoPriceDisplay = createDerived(() => {
    const price = neoPrice.get();
    return price > 0 ? `${fmt(price, 4)} ${t("tokenGas")}` : "";
  }, [neoPrice]);

  /** Pool liquidity available to disburse, formatted as WHOLE GAS. */
  const poolDisplay = createDerived(
    () => `${fmt(poolGas.get())} ${t("tokenGas")}`,
    [poolGas],
  );

  const totalLoans = createDerived(() => stats.get().totalLoans, [stats]);
  const totalBorrowedDisplay = createDerived(() => fmt(stats.get().totalBorrowed), [stats]);
  const totalRepaidDisplay = createDerived(() => fmt(stats.get().totalRepaid), [stats]);
  // Collateral simply sits in the contract and is returned on repayment — there
  // is no voting/ProfitAnchor path on-chain, so this surfaces the real disposition.
  const custodyValue = createObservable(t("custodyValue"));

  // ── Pending-confirmation affordance ──────────────────────────────────
  /** True while a relayed-but-unconfirmed action notice is showing. */
  const hasPendingConfirmation = createDerived(
    () => pendingConfirmation.get().length > 0,
    [pendingConfirmation],
  );

  // ── Reclaim affordances ──────────────────────────────────────────────
  const hasCollateralCredit = createDerived(() => collateralCredit.get() > 0, [collateralCredit]);
  const hasRepayCredit = createDerived(() => repayCredit.get() > 0, [repayCredit]);
  const collateralCreditDisplay = createDerived(
    () => `${fmt(collateralCredit.get(), 0)} ${t("tokenNeo")}`,
    [collateralCredit],
  );
  const repayCreditDisplay = createDerived(
    () => `${fmt(repayCredit.get(), 4)} ${t("tokenGas")}`,
    [repayCredit],
  );

  // ── Validation ───────────────────────────────────────────────────────
  const validateCollateral = (amount: string, balance: number): string | null => {
    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) return t("enterValidAmount");
    // NEO is indivisible — reject fractional collateral with a clear message.
    if (!Number.isInteger(num)) return t("neoMustBeInteger");
    if (num > balance) return t("insufficientNeo");
    return null;
  };

  // ── Data loading (direct chain reads) ────────────────────────────────

  /** Load the configured platform parameters: tier LTV bps + origination fee bps. */
  const loadPlatformStats = async () => {
    try {
      const [t1, t2, t3, fee] = await Promise.all([
        chain.read("ltvTierBps", [{ type: "Integer", value: "1" }]),
        chain.read("ltvTierBps", [{ type: "Integer", value: "2" }]),
        chain.read("ltvTierBps", [{ type: "Integer", value: "3" }]),
        chain.read("feeBps", []),
      ]);
      const prev = platformStats.get();
      platformStats.set({
        ltvTier1Bps: Number(parseBigInt(t1)) || prev.ltvTier1Bps,
        ltvTier2Bps: Number(parseBigInt(t2)) || prev.ltvTier2Bps,
        ltvTier3Bps: Number(parseBigInt(t3)) || prev.ltvTier3Bps,
        // 0 is a legitimate fee, so distinguish a real 0 from a failed read by
        // only overriding when the read parsed to a non-negative finite value.
        platformFeeBps: Number(parseBigInt(fee)) >= 0 ? Number(parseBigInt(fee)) : prev.platformFeeBps,
      });
    } catch (e) {
      warnLoadFailure("loadPlatformStats", e);
    }
  };

  /**
   * Load the configured NEO price. The contract returns GAS BASE UNITS per 1 NEO;
   * keep both the base-unit form (for borrow math parity) and the whole-GAS form
   * (for the value-normalized metrics). 0 means "no price → can't value-normalize",
   * the same graceful degrade the app already has.
   */
  const loadNeoPrice = async () => {
    try {
      const raw = await chain.read("neoPrice", []);
      const base = parseBigInt(raw);
      neoPriceBase.set(base > 0n ? base : 0n);
      neoPrice.set(base > 0n ? gasFromBaseUnits(base) : 0);
    } catch (e) {
      warnLoadFailure("loadNeoPrice", e);
      neoPriceBase.set(0n);
      neoPrice.set(0);
    }
  };

  /**
   * Load the owner-funded GAS lending pool. The contract returns GAS BASE UNITS;
   * divide by 1e8 for display. Pool exhaustion is what makes a borrow revert
   * post-deposit, so surfacing it lets the UI pre-flight the disbursement.
   */
  const loadPool = async () => {
    try {
      const raw = await chain.read("pool", []);
      poolGas.set(Math.max(0, gasFromBaseUnits(parseBigInt(raw))));
    } catch (e) {
      warnLoadFailure("loadPool", e);
      poolGas.set(0);
    }
  };

  /** Load the connected wallet's NEO balance — WHOLE NEO (NEP-17 balanceOf, never ÷1e8). */
  const loadBalance = async () => {
    const hash = myHash();
    if (!hash) {
      neoBalance.set(0);
      return;
    }
    try {
      const raw = await chain.read(
        "balanceOf",
        [{ type: "Hash160", value: hash }],
        { scriptHash: NEO_HASH },
      );
      neoBalance.set(Math.max(0, Number(parseBigInt(raw))));
    } catch (e) {
      warnLoadFailure("loadBalance", e);
    }
  };

  /**
   * Load the connected wallet's active loan position via getLoan. collateral is
   * WHOLE NEO; borrowed is GAS base units → ÷1e8 for display; ltvBps → percent.
   */
  const loadLoanPosition = async () => {
    const hash = myHash();
    if (!hash) {
      loan.set({ borrowed: 0, collateralLocked: 0, active: false });
      return;
    }
    try {
      const raw = await chain.read("getLoan", [{ type: "Hash160", value: hash }]);
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        loan.set({ borrowed: 0, collateralLocked: 0, active: false });
        return;
      }
      const data = raw as Record<string, unknown>;
      const active = parseBool(data.active);
      // collateral is WHOLE NEO — never ÷1e8.
      const collateralNeo = Number(parseBigInt(data.collateral));
      // borrowed is GAS base units — ÷1e8 for display.
      const borrowedGas = gasFromBaseUnits(parseBigInt(data.borrowed));
      const ltvBps = Number(parseBigInt(data.ltvBps));
      loan.set({
        borrowed: active ? borrowedGas : 0,
        collateralLocked: active ? collateralNeo : 0,
        active,
        ltvPercent: ltvBps ? ltvBps / 100 : selectedLtvPercent.get(),
      });
    } catch (e) {
      warnLoadFailure("loadLoanPosition", e);
      loan.set({ borrowed: 0, collateralLocked: 0, active: false });
    }
  };

  /**
   * Load the reclaimable deposit-then-act credits: NEO collateral credited but never
   * borrowed (WHOLE NEO) and GAS repay-credit deposited but never applied (÷1e8).
   */
  const loadReclaimable = async () => {
    const hash = myHash();
    if (!hash) {
      collateralCredit.set(0);
      repayCredit.set(0);
      return;
    }
    try {
      const [collRaw, repayRaw] = await Promise.all([
        chain.read("collateralCreditOf", [{ type: "Hash160", value: hash }]),
        chain.read("repayCreditOf", [{ type: "Hash160", value: hash }]),
      ]);
      // collateralCredit is WHOLE NEO — never ÷1e8.
      collateralCredit.set(Math.max(0, Number(parseBigInt(collRaw))));
      // repayCredit is GAS base units — ÷1e8 for display.
      repayCredit.set(gasFromBaseUnits(parseBigInt(repayRaw)));
    } catch (e) {
      warnLoadFailure("loadReclaimable", e);
      collateralCredit.set(0);
      repayCredit.set(0);
    }
  };

  /** Load the platform-wide loan totals. borrowed/repaid are GAS base units → ÷1e8. */
  const loadStats = async () => {
    try {
      const [loansRaw, borrowedRaw, repaidRaw] = await Promise.all([
        chain.read("totalLoans", []),
        chain.read("totalBorrowed", []),
        chain.read("totalRepaid", []),
      ]);
      stats.set({
        totalLoans: Math.max(0, Number(parseBigInt(loansRaw))),
        totalBorrowed: gasFromBaseUnits(parseBigInt(borrowedRaw)),
        totalRepaid: gasFromBaseUnits(parseBigInt(repaidRaw)),
      });
    } catch (e) {
      warnLoadFailure("loadStats", e);
    }
  };

  // ── Actions (direct on-chain, deposit-then-act) ──────────────────────

  /**
   * Take a self-loan (deposit-then-act). Two signed steps, both by the borrower:
   *   1. DEPOSIT — a NEO transfer to the contract with the "selfloan:collateral"
   *      memo, amount = the WHOLE NEO integer (NO ×1e8 — NEO is indivisible) so
   *      OnNEP17Payment credits the borrower's collateral.
   *   2. borrow(borrower, tier) — locks ALL credited collateral, sets the debt to
   *      the tier LTV of the collateral's configured value, and disburses
   *      (gross − fee) GAS from the pool. Settles on the LoanTaken event.
   *
   * If step 1 lands but step 2 reverts, the NEO credit persists on the contract as
   * reclaimable collateral credit (withdraw) — no NEO is lost; the UI surfaces the
   * "Reclaim collateral" affordance for exactly that case.
   */
  const takeLoan = async () => {
    if (isBusy.get()) return;
    pendingConfirmation.set("");

    // One loan per address: the contract asserts "loan already active" only in
    // step 2 — AFTER the NEO deposit lands — so block up front to keep the NEO
    // out of the credit-reclaim detour for a failure the UI can foresee.
    if (loan.get().active) throw new Error(t("loanAlreadyActiveHint"));

    const validation = validateCollateral(collateralAmount.get(), neoBalance.get());
    if (validation) throw new Error(validation);

    const neoInt = neoToInteger(collateralAmount.get());
    if (neoInt <= 0n) throw new Error(t("neoMustBeInteger"));

    // Pre-flight the pool: the contract disburses (gross − fee) GAS from pool()
    // and reverts post-deposit when it is short. Block here when a price is
    // configured (so the expected disbursement is known) and the pool cannot
    // cover it, sparing the user the credit-held detour.
    const price = neoPrice.get();
    const pool = poolGas.get();
    if (price > 0) {
      const grossGas = Number(neoInt) * price * (selectedLtvPercent.get() / 100);
      const netGas = grossGas - (grossGas * platformStats.get().platformFeeBps) / 10000;
      if (netGas > pool) {
        throw new Error(t("insufficientPool", { pool: fmt(pool) }));
      }
    }

    const addr = address.get() || (await chain.ensureWallet());
    const hash = addr ? addressToScriptHash(addr) : null;
    if (!addr || !hash) throw new Error(t("walletStatusIdle"));
    setAddress(addr);

    const contractHash = chain.contractAddress.get();
    if (!contractHash) throw new Error(t("missingContract"));

    isLoading.set(true);
    let depositSettled = false;
    try {
      // Step 1: DEPOSIT — the contract's borrow locks ALL credited collateral
      // and sizes the debt on it, so the locked total must equal the typed
      // amount for the previewed terms to hold (credit may persist from a
      // prior aborted borrow).
      let credit = 0n;
      try {
        credit = parseBigInt(
          await chain.read("collateralCreditOf", [{ type: "Hash160", value: hash }]),
        );
      } catch {
        credit = 0n;
      }

      // Residual credit larger than the typed amount would lock — and borrow
      // against — more NEO than the user consented to. Block until the credit
      // is reclaimed or the typed amount covers it.
      if (credit > neoInt) {
        throw new Error(
          t("collateralCreditExceedsAmount", {
            credit: credit.toString(),
            amount: neoInt.toString(),
          }),
        );
      }

      // Top up only the SHORTFALL — existing credit plus this transfer is
      // exactly what borrow locks. NEO transfer carries the WHOLE integer —
      // no scaling.
      const shortfall = neoInt - credit;
      if (shortfall > 0n) {
        await chain.invoke(
          "transfer",
          [
            { type: "Hash160", value: hash },
            { type: "Hash160", value: contractHash },
            { type: "Integer", value: shortfall.toString() },
            { type: "String", value: COLLATERAL_MEMO },
          ],
          { scriptHash: NEO_HASH, waitForEvent: "CollateralCredited" },
        );
        depositSettled = true;
      }

      // Step 2: borrow — locks the credited NEO + disburses GAS. If the deposit
      // landed but this reverts, the NEO credit persists as reclaimable collateral
      // credit (withdraw); surface that distinctly so the user knows to reclaim.
      let borrowResult: { verified?: boolean };
      try {
        borrowResult = await chain.invoke(
          "borrow",
          [
            { type: "Hash160", value: hash },
            { type: "Integer", value: String(selectedTier.get()) },
          ],
          { waitForEvent: "LoanTaken" },
        );
      } catch (borrowErr) {
        if (depositSettled) throw new Error(t("collateralCreditHeld"));
        throw new Error(errorMessage(borrowErr) || t("error"));
      }

      // The borrow tx was broadcast (success) but its LoanTaken event was never
      // observed (verified=false on a wait timeout/FAULT). Treat that as PENDING,
      // not a definitive success: surface the notice and skip the success-nonce
      // bump so the PlayArea does not clear the form as if the loan opened. The
      // reload still runs — the position hydrates if the tx actually landed.
      if (borrowResult.verified !== true) {
        pendingConfirmation.set(t("loanPendingConfirmation"));
        await loadAll();
        return;
      }

      collateralAmount.set("");
      borrowOkNonce.set(borrowOkNonce.get() + 1);
      await loadAll();
    } finally {
      isLoading.set(false);
    }
  };

  /**
   * Borrow from manifest form data: { collateralAmount }. Sets the amount then runs
   * the deposit-then-borrow flow under the isBorrowing flag.
   */
  const borrow = async (formData: Record<string, unknown>) => {
    const nextCollateral = String(formData.collateralAmount ?? "").trim();
    if (nextCollateral) collateralAmount.set(nextCollateral);

    if (isBorrowing.get()) return;
    try {
      isBorrowing.set(true);
      await takeLoan();
    } finally {
      isBorrowing.set(false);
    }
  };

  /**
   * Add collateral to the active loan (deposit-then-act): a NEO transfer with the
   * "selfloan:collateral" memo (WHOLE integer, no scaling), then addCollateral
   * moves the freshly-credited NEO into the loan. Settles on CollateralAdded.
   */
  const addCollateral = async (amount: string) => {
    if (isAddingCollateral.get()) return;
    const validation = validateCollateral(amount, neoBalance.get());
    if (validation) throw new Error(validation);

    const neoInt = neoToInteger(amount);
    if (neoInt <= 0n) throw new Error(t("neoMustBeInteger"));

    const addr = address.get() || (await chain.ensureWallet());
    const hash = addr ? addressToScriptHash(addr) : null;
    if (!addr || !hash) throw new Error(t("walletStatusIdle"));
    setAddress(addr);

    const contractHash = chain.contractAddress.get();
    if (!contractHash) throw new Error(t("missingContract"));

    isAddingCollateral.set(true);
    let depositSettled = false;
    try {
      let credit = 0n;
      try {
        credit = parseBigInt(
          await chain.read("collateralCreditOf", [{ type: "Hash160", value: hash }]),
        );
      } catch {
        credit = 0n;
      }

      // addCollateral moves ALL freshly-credited NEO into the loan, so excess
      // residual credit would lock more than the typed amount — block until
      // the credit is reclaimed or the typed amount covers it.
      if (credit > neoInt) {
        throw new Error(
          t("collateralCreditExceedsAmount", {
            credit: credit.toString(),
            amount: neoInt.toString(),
          }),
        );
      }

      // Top up only the SHORTFALL — existing credit plus this transfer is
      // exactly what addCollateral moves into the loan.
      const shortfall = neoInt - credit;
      if (shortfall > 0n) {
        await chain.invoke(
          "transfer",
          [
            { type: "Hash160", value: hash },
            { type: "Hash160", value: contractHash },
            { type: "Integer", value: shortfall.toString() },
            { type: "String", value: COLLATERAL_MEMO },
          ],
          { scriptHash: NEO_HASH, waitForEvent: "CollateralCredited" },
        );
        depositSettled = true;
      }

      try {
        await chain.invoke(
          "addCollateral",
          [{ type: "Hash160", value: hash }],
          { waitForEvent: "CollateralAdded" },
        );
      } catch (addErr) {
        if (depositSettled) throw new Error(t("collateralCreditHeld"));
        throw new Error(errorMessage(addErr) || t("error"));
      }

      addCollateralOkNonce.set(addCollateralOkNonce.get() + 1);
      await loadAll();
    } finally {
      isAddingCollateral.set(false);
    }
  };

  /**
   * Repay the loan (deposit-then-act): a GAS transfer with the "selfloan:repay" memo
   * (amount scaled to base units, no floats), then repay applies it. The contract
   * caps at the debt and refunds any excess, and on full repayment closes the loan
   * and releases the NEO collateral in the same call. Settles on Repaid.
   *
   * The repayment is still capped client-side at the outstanding debt for good UX —
   * a user should not be prompted to over-deposit even though the contract refunds.
   */
  const repay = async (amount: string) => {
    if (isRepaying.get()) return;
    pendingConfirmation.set("");
    const value = String(amount || "").trim();
    // Strict decimal validation: reject NaN, scientific/hex/whitespace and
    // non-positive amounts before any chain call.
    if (!/^\d+(\.\d{1,8})?$/.test(value)) throw new Error(t("enterValidAmount"));
    const baseAmount = gasToBaseUnits(value);
    if (baseAmount <= 0n) throw new Error(t("enterValidAmount"));

    const outstanding = loan.get().borrowed;
    // Reject when there is no active loan: depositing GAS as a "repay" against zero
    // debt would strand it behind the repay-credit path with no debt to apply.
    if (!loan.get().active || outstanding <= 0) {
      throw new Error(t("repayNoActiveLoan"));
    }
    // Cap the repayment at the outstanding debt (client-side, good UX). The contract
    // refunds any excess, but a typo should not move more GAS than owed.
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > outstanding) {
      throw new Error(t("repayExceedsDebt", { amount: fmt(outstanding) }));
    }

    const addr = address.get() || (await chain.ensureWallet());
    const hash = addr ? addressToScriptHash(addr) : null;
    if (!addr || !hash) throw new Error(t("walletStatusIdle"));
    setAddress(addr);

    const contractHash = chain.contractAddress.get();
    if (!contractHash) throw new Error(t("missingContract"));

    isRepaying.set(true);
    let depositSettled = false;
    try {
      // Step 1: DEPOSIT GAS repay-credit — only top up when existing repay credit
      // can't cover the amount (credit may persist from a prior aborted repay).
      let credit = 0n;
      try {
        credit = parseBigInt(
          await chain.read("repayCreditOf", [{ type: "Hash160", value: hash }]),
        );
      } catch {
        credit = 0n;
      }

      if (credit < baseAmount) {
        await chain.invoke(
          "transfer",
          [
            { type: "Hash160", value: hash },
            { type: "Hash160", value: contractHash },
            { type: "Integer", value: baseAmount.toString() },
            { type: "String", value: REPAY_MEMO },
          ],
          { scriptHash: GAS_HASH, waitForEvent: "RepayCredited" },
        );
        depositSettled = true;
      }

      // Step 2: repay — applies the credit (capped at the debt, excess refunded),
      // releasing collateral on full repayment. If the deposit landed but this
      // reverts, the GAS credit persists as reclaimable repay credit
      // (withdrawRepayCredit); surface that distinctly.
      let repayResult: { verified?: boolean };
      try {
        repayResult = await chain.invoke(
          "repay",
          [{ type: "Hash160", value: hash }],
          { waitForEvent: "Repaid" },
        );
      } catch (repayErr) {
        if (depositSettled) throw new Error(t("repayCreditHeld"));
        throw new Error(errorMessage(repayErr) || t("error"));
      }

      // Broadcast but Repaid event unobserved → PENDING, not a definitive close.
      // Skip the success-nonce bump and reload so the position re-hydrates if the
      // tx actually landed.
      if (repayResult.verified !== true) {
        pendingConfirmation.set(t("repayPendingConfirmation"));
        await loadAll();
        return;
      }

      repayOkNonce.set(repayOkNonce.get() + 1);
      await loadAll();
    } finally {
      isRepaying.set(false);
    }
  };

  /**
   * Reclaim NEO collateral-credit deposited but never borrowed against, via
   * withdraw(account). Returns the credited NEO to the wallet (CollateralWithdrawn).
   */
  const reclaimCollateral = async () => {
    if (isProcessing.get()) return;
    if (collateralCredit.get() <= 0) throw new Error(t("noCollateralCredit"));

    const addr = address.get() || (await chain.ensureWallet());
    const hash = addr ? addressToScriptHash(addr) : null;
    if (!addr || !hash) throw new Error(t("walletStatusIdle"));
    setAddress(addr);

    isProcessing.set(true);
    try {
      await chain.invoke(
        "withdraw",
        [{ type: "Hash160", value: hash }],
        { waitForEvent: "CollateralWithdrawn" },
      );
      await loadAll();
    } finally {
      isProcessing.set(false);
    }
  };

  /**
   * Reclaim GAS repay-credit deposited but never applied, via
   * withdrawRepayCredit(account). Returns the GAS to the wallet (CollateralWithdrawn).
   */
  const reclaimRepayCredit = async () => {
    if (isProcessing.get()) return;
    if (repayCredit.get() <= 0) throw new Error(t("noRepayCredit"));

    const addr = address.get() || (await chain.ensureWallet());
    const hash = addr ? addressToScriptHash(addr) : null;
    if (!addr || !hash) throw new Error(t("walletStatusIdle"));
    setAddress(addr);

    isProcessing.set(true);
    try {
      await chain.invoke(
        "withdrawRepayCredit",
        [{ type: "Hash160", value: hash }],
        { waitForEvent: "CollateralWithdrawn" },
      );
      await loadAll();
    } finally {
      isProcessing.set(false);
    }
  };

  // ── Lifecycle ────────────────────────────────────────────────────────

  /** Load all data. Called by defineMiniApp on mount and on wallet reconnect. */
  const loadAll = async () => {
    if (!isMounted) return;
    isConnected.set(Boolean(address.get()));
    await Promise.all([
      loadPlatformStats(),
      loadNeoPrice(),
      loadPool(),
      loadBalance(),
      loadLoanPosition(),
      loadReclaimable(),
      loadStats(),
    ]);
  };

  // ── Public API ───────────────────────────────────────────────────────

  return {
    // Core refs
    isLoading,
    isBorrowing,
    isRepaying,
    isAddingCollateral,
    isProcessing,
    isBusy,
    neoBalance,
    neoPrice,
    neoPriceBase,
    neoPriceDisplay,
    poolGas,
    poolDisplay,
    hasActiveLoan,
    borrowOkNonce,
    repayOkNonce,
    addCollateralOkNonce,
    platformStats,
    loan,
    collateralAmount,
    selectedTier,
    selectedLtv: selectedTier,
    ltvOptions,
    selectedLtvPercent,
    platformFeeBps,
    borrowTerms,
    positionTerms,
    healthFactor,
    currentLTV,
    collateralValueGas,
    isPriceNormalized,
    collateralUtilization,
    validateCollateral,
    address,

    // Pending confirmation (relayed-but-unconfirmed)
    pendingConfirmation,
    hasPendingConfirmation,

    // Reclaim
    collateralCredit,
    repayCredit,
    hasCollateralCredit,
    hasRepayCredit,
    collateralCreditDisplay,
    repayCreditDisplay,

    // History / stats
    stats,

    // Display computeds
    isConnected,
    collateralDisplay,
    borrowedDisplay,
    healthFactorDisplay,
    currentLTVDisplay,
    healthMetricLabel,
    hasLoanDisplay,
    neoBalanceDisplay,
    totalLoans,
    totalBorrowedDisplay,
    totalRepaidDisplay,
    custodyValue,

    // Actions
    takeLoan,
    borrow,
    repay,
    addCollateral,
    reclaimCollateral,
    reclaimRepayCredit,

    // Lifecycle
    loadAll,
    setAddress,
    fmt,
    t,
    dispose: () => {
      isMounted = false;
    },
  };
}

export type UseSelfLoanReturn = ReturnType<typeof useSelfLoan>;
