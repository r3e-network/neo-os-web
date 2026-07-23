/**
 * useSelfLoan — Domain logic for the Self-Loan miniapp.
 *
 * Uses one fail-closed domain model over either the reviewed standalone
 * MiniAppSelfLoan contract or the PlatformDeFi SelfLoan tenant profile. The
 * PlatformDeFi path is enabled only when the host supplies that surface, the exact
 * contract generation passes RPC attestation, and the registered tenant reports
 * profile 1. The earlier path delegated collateral, disbursement, debt and repayment
 * to edge functions that no contract enforced; both supported paths here keep those
 * transitions authoritative on-chain.
 *
 * MODEL (verified against MiniAppSelfLoan and PlatformDeFi SelfLoan-profile ABIs):
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
 *   * REPAY: one atomic multi-script transaction transfers any GAS shortfall with
 *     memo "selfloan:repay", then calls repay(borrower). The call applies all
 *     credit (capped at debt, excess auto-refunded) and full repayment releases
 *     the NEO collateral (Repaid / LoanClosed).
 *   * RECLAIM: withdraw(account) reclaims NEO collateral-credit never borrowed
 *     against; withdrawRepayCredit(account) reclaims GAS repay-credit never applied.
 *     These are the recovery paths the deposit-then-act model needs.
 *
 *   READS (standalone names shown first; PlatformDeFi uses the tenant-scoped
 *   getLending* / getSingleLoanPosition / direct-credit equivalents):
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
 *     `app.amount.parseNeoToUnits` rejects fractional NEO (to null) before any
 *     chain call.
 *   * GAS uses BASE UNITS (×1e8). Debt (loan.borrowed), pool, repayCredit, neoPrice,
 *     totals and disbursements are GAS base units on-chain; the UI scales once on
 *     input with `app.amount.parseGasToFixed8` (no floats) and divides by 1e8
 *     (`gasFromBaseUnits`) for display.
 *   * neoPrice is GAS BASE UNITS per 1 NEO, so collateralValueGasBase =
 *     collateralNeoInteger × neoPrice (no extra scaling); divide by 1e8 to display.
 *
 * The composable owns:
 *   - Reactive state (observables + derived) for manifest / PlayArea bindings
 *   - LTV tier selection and the borrow-terms preview against the on-chain tier bps
 *   - Coverage ratio / LTV computeds (value-normalized via neoPrice when set)
 *   - Validation (pure frontend checks — integer NEO, repay cap)
 *   - Loading / processing UI flags (double-submit guards)
 *   - Reclaim affordances for the deposit-then-act recovery paths
 */

import { createObservable, createDerived } from "@shared/react/context";
import type { Observable } from "@shared/react/context";
import type { MiniAppFramework } from "@shared/react";
import { formatNumber } from "@shared/utils/format";
import { eventValue } from "@shared/utils/chain-events";
import { addressToScriptHash, normalizeScriptHash } from "@shared/utils/neo";
import { combineBusy } from "@shared/utils/observables";
import { BLOCKCHAIN_CONSTANTS } from "@shared/constants";
import {
  SELF_LOAN_BINDINGS,
  normalizeSelfLoanNetwork,
  type SelfLoanAttestation,
  type SelfLoanNetwork,
} from "../self-loan-rpc";
import type { PlatformDeFiSelfLoanAttestation } from "../platform-defi-rpc";
import {
  createPendingSelfLoanOperation,
  createSelfLoanOperationStore,
  normalizeSelfLoanOperationScope,
  type PendingSelfLoanDraft,
  type PendingSelfLoanOperation,
  type SelfLoanOperationScope,
  type SelfLoanOperationStorage,
} from "../self-loan-operation-store";

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
const PLATFORM_APP_ID = "miniapp-self-loan";
const PLATFORM_SELF_LOAN_PROFILE = 1n;

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

/**
 * Chain reads that drive a money-moving preview must never collapse malformed
 * data into zero. A zero pool is real; an unreadable pool is unknown. Keeping
 * those states distinct is what makes the write lane fail closed.
 */
function parseExactInteger(value: unknown, label: string): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isSafeInteger(value)) return BigInt(value);
  if (typeof value === "string" && /^-?\d+$/.test(value.trim())) return BigInt(value.trim());
  throw new Error(`Invalid ${label} chain value`);
}

function parseExactBoolean(value: unknown, label: string): boolean {
  if (value === true || value === false) return value;
  if (value === "true" || value === "1" || value === 1) return true;
  if (value === "false" || value === "0" || value === 0) return false;
  throw new Error(`Invalid ${label} chain value`);
}

function requireNonNegative(value: bigint, label: string): bigint {
  if (value < 0n) throw new Error(`Invalid negative ${label}`);
  return value;
}

// ============================================================================
// Amount helpers (NEO integer vs GAS base units kept strictly separate)
// ============================================================================
// Scaling goes through app.amount.parseGasToFixed8 / parseNeoToUnits — the
// S6 null-on-invalid variants: the SINGLE GAS scaling point (the contract
// scales nothing); NEO is never ×1e8. They return null on invalid/zero input
// (never throw) so the actions keep raising their own localized t(...) errors
// (e.g. enterValidAmount, neoMustBeInteger). The THROWING variants
// (app.amount.gasToFixed8 / neoToUnits) are deliberately NOT used here —
// their non-localized throw messages would change the observable error
// semantics.

/** Convert a GAS base-unit Integer to whole GAS as a number (÷ 1e8). */
const gasFromBaseUnits = (base: bigint): number => Number(base) / 1e8;

// ============================================================================
// Types
// ============================================================================

export type Terms = { ltvPercent: number; minDurationHours: number };
/**
 * "awaiting-wallet" is the normal pre-connect state: with no wallet there is no
 * wallet network, so there is nothing to compare against the launch network and
 * no chain context to read the market through. It is deliberately NOT "error" —
 * collapsing the two made a fresh visitor with no wallet open the desk under a
 * red "Live data unavailable / Writes are disabled" alert describing a fault
 * that had not happened. Every write gate still treats it exactly like a
 * failure (loadRuntime keeps returning false), so this only changes what the
 * visitor is told, never what they are allowed to do.
 */
export type LoadStatus = "idle" | "loading" | "ready" | "awaiting-wallet" | "error";
export type ActionOutcome = "confirmed" | "pending";
export interface BorrowQuoteGuard {
  priceBase: bigint;
  feeBps: number;
  ltvBps: number;
  disbursedBase: bigint;
}
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
  /** MiniApp framework SDK from ctx.framework. */
  app: MiniAppFramework;
  /** Translation function. */
  t: (key: string, params?: Record<string, string | number>) => string;
  /** Launch-network binding delivered by the host. */
  launchNetwork?: unknown;
  /** Production injects the exact hash/checksum/update-counter/ABI attester. */
  attestContract?: (
    network: SelfLoanNetwork,
    contract: string,
  ) => Promise<SelfLoanAttestation>;
  attestPlatformContract?: (
    network: SelfLoanNetwork,
    contract: string,
  ) => Promise<PlatformDeFiSelfLoanAttestation>;
  /** Injectable for deterministic durable-journal tests. */
  operationStorage?: SelfLoanOperationStorage;
}

// ============================================================================
// Composable
// ============================================================================

export function useSelfLoan({
  app,
  t,
  launchNetwork = null,
  attestContract,
  attestPlatformContract,
  operationStorage,
}: UseSelfLoanOptions) {
  // ── Helpers ──────────────────────────────────────────────────────────
  const fmt = (n: number, d = 2) => formatNumber(n, d);
  const platformMode = app.platformDeFi.available;

  // ── Core state ───────────────────────────────────────────────────────
  const isLoading = createObservable(false);
  const isBorrowing = createObservable(false);
  const isRepaying = createObservable(false);
  const isAddingCollateral = createObservable(false);
  const isProcessing = createObservable(false);
  const isRefreshing = createObservable(false);

  /** Connected wallet's NEO balance — WHOLE NEO (integer, never ÷1e8). */
  const neoBalance = createObservable(0);
  /** Connected wallet's GAS balance — WHOLE GAS (on-chain value divided by 1e8). */
  const gasBalance = createObservable(0);
  const gasBalanceBase = createObservable(0n);
  /** Configured NEO price as GAS base units per 1 NEO (0 = unset). */
  const neoPriceBase = createObservable(0n);
  /** NEO price expressed in WHOLE GAS per NEO (for value-normalized metrics). */
  const neoPrice = createObservable(0);
  /** Lending pool liquidity available to disburse — WHOLE GAS (÷1e8). */
  const poolGas = createObservable(0);
  /** Exact lending-pool balance in GAS base units for fail-closed quote checks. */
  const poolGasBase = createObservable(0n);

  // Money-moving UI is enabled only after every relevant source has been read
  // and validated. Failed reads never masquerade as a real 0 balance/position.
  const marketStatus = createObservable<LoadStatus>("idle");
  const balancesStatus = createObservable<LoadStatus>("idle");
  const positionStatus = createObservable<LoadStatus>("idle");
  const recoveryStatus = createObservable<LoadStatus>("idle");
  const statsStatus = createObservable<LoadStatus>("idle");
  const readError = createObservable("");
  const lastRefreshAt = createObservable(0);
  const runtimeStatus = createObservable<LoadStatus>("idle");
  const runtimeCompatible = createObservable(false);
  const repayRecoveryAvailable = createObservable(false);
  const activeNetwork = createObservable<SelfLoanNetwork | "">("");
  const runtimeChecksum = createObservable<number | null>(null);

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
  const pendingOperation = createObservable<PendingSelfLoanOperation | null>(null);
  const journalReady = createObservable(false);
  const operationStore = createSelfLoanOperationStore(operationStorage ?? app.storage.local);

  const platformStats = createObservable<PlatformStats>({
    ltvTier1Bps: 0,
    ltvTier2Bps: 0,
    ltvTier3Bps: 0,
    platformFeeBps: 0,
  });
  const selectedTier = createObservable(1);
  const loan = createObservable<Loan>({ borrowed: 0, collateralLocked: 0, active: false });
  const loanBorrowedBase = createObservable(0n);
  const activeLoanId = createObservable(0n);
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
    const next = addr ?? "";
    const changed = next !== address.get();
    address.set(next);
    isConnected.set(Boolean(next));
    if (changed) {
      // Never show the previous account's balance/position while a new account
      // is still loading (or after that load fails).
      neoBalance.set(0);
      gasBalance.set(0);
      gasBalanceBase.set(0n);
      loan.set({ borrowed: 0, collateralLocked: 0, active: false });
      loanBorrowedBase.set(0n);
      activeLoanId.set(0n);
      collateralCredit.set(0);
      repayCredit.set(0);
      balancesStatus.set(next ? "loading" : "awaiting-wallet");
      positionStatus.set(next ? "loading" : "awaiting-wallet");
      recoveryStatus.set(next ? "loading" : "awaiting-wallet");
      pendingOperation.set(null);
      pendingConfirmation.set("");
    }
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
    return option?.percent ?? 0;
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
  // coverage / LTV ratio is only meaningful when both legs are valued in the
  // same unit, so the NEO collateral is converted to its GAS-equivalent value via
  // neoPrice (WHOLE GAS per NEO) when a price is configured. With no price
  // (neoPrice === 0), there is no meaningful cross-asset ratio; return 0 and let
  // the UI render it as unavailable rather than inventing a 1:1 fallback quote.
  const collateralValueGas = createDerived(() => {
    const collateral = loan.get().collateralLocked;
    const price = neoPrice.get();
    return marketStatus.get() === "ready" && price > 0 ? collateral * price : 0;
  }, [loan, neoPrice]);

  /** True when a NEO price is configured and the ratio is value-normalized. */
  const isPriceNormalized = createDerived(
    () => marketStatus.get() === "ready" && neoPrice.get() > 0,
    [marketStatus, neoPrice],
  );

  const healthFactor = createDerived(() => {
    if (!isPriceNormalized.get() || loan.get().borrowed === 0) return 0;
    return collateralValueGas.get() / loan.get().borrowed;
  }, [loan, neoPrice, marketStatus]);

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
  /**
   * Both read straight off `loan`, which rests at
   * `{ borrowed: 0, collateralLocked: 0 }` — the shape of an empty position,
   * not a reading. Formatting that resting value published a confident "0" in
   * the chrome while getLoan was still in flight: a fabricated number telling a
   * borrower they have borrowed nothing and locked nothing. Same class as
   * `hasLoanDisplay` below, gated on the same `positionStatus`, so a zero here
   * is only ever a zero the chain actually reported.
   */
  const collateralDisplay = createDerived(() => {
    const status = positionStatus.get();
    if (status === "ready") return fmt(loan.get().collateralLocked, 0);
    if (status === "awaiting-wallet") return t("connectWallet");
    if (status === "error") return t("notAvailable");
    return undefined;
  }, [loan, positionStatus]);
  const borrowedDisplay = createDerived(() => {
    const status = positionStatus.get();
    if (status === "ready") return fmt(loan.get().borrowed);
    if (status === "awaiting-wallet") return t("connectWallet");
    if (status === "error") return t("notAvailable");
    return undefined;
  }, [loan, positionStatus]);

  // Both metrics are computed FROM the loan position, so neither can be stated
  // before that position has been read. Until then they are `undefined` — the
  // chrome renders the binding's `pendingKey`, and the PlayArea keeps showing
  // the "N/A" it already passes as its own `str()` fallback.
  const healthFactorDisplay = createDerived(() => {
    const status = positionStatus.get();
    if (status === "awaiting-wallet") return t("connectWallet");
    if (status !== "ready" && status !== "error") return undefined;
    const hf = healthFactor.get();
    if (hf <= 0) return t("notAvailable");
    return fmt(hf, 2);
  }, [loan, neoPrice, marketStatus, positionStatus]);
  const coverageRatio = healthFactor;
  const coverageRatioDisplay = healthFactorDisplay;

  const currentLTVDisplay = createDerived(() => {
    const status = positionStatus.get();
    if (status === "awaiting-wallet") return t("connectWallet");
    if (status !== "ready" && status !== "error") return undefined;
    const ltv = currentLTV.get();
    if (loan.get().active && !isPriceNormalized.get()) return t("notAvailable");
    if (ltv === 0 && !loan.get().active) return t("notAvailable");
    return `${ltv}%`;
  }, [loan, neoPrice, marketStatus, positionStatus]);

  /** This contract has no liquidation threshold; the metric is coverage, not health. */
  const healthMetricLabel = createDerived(() => t("coverageRatio"), [neoPrice]);

  /**
   * "No" is an answer, and it must not be given before the question has been
   * asked. `loan` rests at `{ active: false }` — the shape of an empty
   * position, not a reading — so answering straight off it published a
   * confident "No" in the chrome while the getLoan read was still in flight: a
   * fabricated negative telling a borrower they have no loan.
   *
   * `positionStatus` is the signal this app already tracks, so each state can
   * say what it actually knows:
   *   · ready          → the real answer. "No" here is a reading.
   *   · awaiting-wallet → "Connect wallet". A settled fact, not a pending read:
   *     with no wallet there is no position to look up.
   *   · error          → "N/A". The read came back broken; we do not know.
   *   · idle/loading   → `undefined`. Nothing has been set yet, so the chrome
   *     renders the binding's `pendingKey` and says nothing at all.
   */
  const hasLoanDisplay = createDerived(() => {
    const status = positionStatus.get();
    if (status === "ready") return loan.get().active ? t("yes") : t("no");
    if (status === "awaiting-wallet") return t("connectWallet");
    if (status === "error") return t("notAvailable");
    return undefined;
  }, [loan, positionStatus]);

  const neoBalanceDisplay = createDerived(
    () => {
      const status = balancesStatus.get();
      // Same three-way split: only an unread balance is `undefined`. A wallet
      // that is not connected, and a read that failed, are settled facts.
      if (status === "ready") return fmt(neoBalance.get(), 0);
      if (status === "awaiting-wallet") return t("connectWallet");
      if (status === "error") return t("notAvailable");
      return undefined;
    },
    [neoBalance, balancesStatus],
  );
  const gasBalanceDisplay = createDerived(
    () => balancesStatus.get() === "ready" ? fmt(gasBalance.get(), 4) : t("notAvailable"),
    [gasBalance, balancesStatus],
  );

  /** True when the connected wallet already holds an active loan. */
  const hasActiveLoan = createDerived(() => loan.get().active, [loan]);

  /**
   * The configured NEO price as "1 NEO = X GAS". Empty when no price is set so
   * the UI can hide the rate row rather than show a misleading 0.
   */
  const neoPriceDisplay = createDerived(() => {
    const price = neoPrice.get();
    return marketStatus.get() === "ready" && price > 0
      ? `${fmt(price, 4)} ${t("tokenGas")}`
      : "";
  }, [neoPrice, marketStatus]);

  /** Pool liquidity available to disburse, formatted as WHOLE GAS. */
  const poolDisplay = createDerived(
    () => marketStatus.get() === "ready"
      ? `${fmt(poolGas.get())} ${t("tokenGas")}`
      : t("notAvailable"),
    [poolGas, marketStatus],
  );

  const marketReady = createDerived(
    () => marketStatus.get() === "ready" && neoPriceBase.get() > 0n,
    [marketStatus, neoPriceBase],
  );
  const borrowDataReady = createDerived(
    () => runtimeCompatible.get()
      && marketReady.get()
      && balancesStatus.get() === "ready"
      && positionStatus.get() === "ready"
      && recoveryStatus.get() === "ready"
      && pendingOperation.get() === null,
    [runtimeCompatible, marketReady, balancesStatus, positionStatus, recoveryStatus, pendingOperation],
  );
  const manageDataReady = createDerived(
    () => runtimeCompatible.get()
      && balancesStatus.get() === "ready"
      && positionStatus.get() === "ready"
      && recoveryStatus.get() === "ready"
      && pendingOperation.get() === null,
    [runtimeCompatible, balancesStatus, positionStatus, recoveryStatus, pendingOperation],
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
    () => pendingConfirmation.get().length > 0 || pendingOperation.get() !== null,
    [pendingConfirmation, pendingOperation],
  );
  const hasPendingOperation = createDerived(
    () => pendingOperation.get() !== null,
    [pendingOperation],
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

  /**
   * Bind every write to the wallet's explicit network and the reviewed live
   * contract generation. A script hash alone is insufficient because Neo
   * upgrades keep the same address while changing the ABI and bytecode.
   */
  const loadRuntime = async (): Promise<boolean> => {
    runtimeStatus.set("loading");
    runtimeCompatible.set(false);
    repayRecoveryAvailable.set(false);
    activeNetwork.set("");
    runtimeChecksum.set(null);
    try {
      const detected = normalizeSelfLoanNetwork(await app.chain.detectNetwork());
      const expectedLaunch = normalizeSelfLoanNetwork(launchNetwork);
      const contract = normalizeScriptHash(app.chain.contractAddress.get() ?? "");
      // No resolvable network means no wallet has named one yet (a wallet-less
      // host reports a bare "neo-n3", which normalizes to null). Nothing
      // mismatches nothing — hold the neutral pre-connect state instead of
      // raising a network mismatch the visitor did not cause. Returning false
      // keeps every write gate closed exactly as before.
      if (!detected) {
        runtimeStatus.set("awaiting-wallet");
        return false;
      }
      if (expectedLaunch && expectedLaunch !== detected) {
        throw new Error(t("runtimeNetworkMismatch"));
      }
      if (platformMode) {
        if (!attestPlatformContract) throw new Error(t("runtimeBindingMismatch"));
        const attestation = await attestPlatformContract(detected, contract);
        if (!attestation.compatible) throw new Error(t("runtimeBindingMismatch"));
        const profile = await app.platformDeFi.getLendingProfile();
        if (profile !== PLATFORM_SELF_LOAN_PROFILE) {
          throw new Error(t("runtimeBindingMismatch"));
        }
        runtimeChecksum.set(attestation.checksum);
        repayRecoveryAvailable.set(true);
      } else {
        const expected = SELF_LOAN_BINDINGS[detected];
        if (contract !== normalizeScriptHash(expected.contract)) {
          throw new Error(t("runtimeBindingMismatch"));
        }
        if (attestContract) {
          const attestation = await attestContract(detected, contract);
          if (!attestation.compatible) throw new Error(t("runtimeBindingMismatch"));
          runtimeChecksum.set(attestation.checksum);
          repayRecoveryAvailable.set(Boolean(attestation.repayRecoveryCompatible));
        } else {
          repayRecoveryAvailable.set(true);
        }
      }
      activeNetwork.set(detected);
      runtimeCompatible.set(true);
      runtimeStatus.set("ready");
      return true;
    } catch (error) {
      warnLoadFailure("loadRuntime", error);
      runtimeStatus.set("error");
      return false;
    }
  };

  /** Read tier bps, fee, configured price and pool as one coherent market quote. */
  const loadMarket = async (): Promise<boolean> => {
    marketStatus.set("loading");
    try {
      let t1Raw: unknown;
      let t2Raw: unknown;
      let t3Raw: unknown;
      let feeRaw: unknown;
      let priceRaw: unknown;
      let poolRaw: unknown;
      if (platformMode) {
        const [marketRaw, sharedPrice, sharedPool] = await Promise.all([
          app.platformDeFi.getLendingStats(),
          app.platformDeFi.getNeoGasPrice(),
          app.platformDeFi.getLendingLiquidity(),
        ]);
        if (!marketRaw || typeof marketRaw !== "object" || Array.isArray(marketRaw)) {
          throw new Error("Invalid shared lending stats");
        }
        const market = marketRaw as Record<string, unknown>;
        t1Raw = market.ltvTier1Bps;
        t2Raw = market.ltvTier2Bps;
        t3Raw = market.ltvTier3Bps;
        feeRaw = market.lendingFeeBps;
        priceRaw = sharedPrice;
        poolRaw = sharedPool;
      } else {
        [t1Raw, t2Raw, t3Raw, feeRaw, priceRaw, poolRaw] = await Promise.all([
          app.chain.readRaw("ltvTierBps", [app.chain.arg.integer(1)]),
          app.chain.readRaw("ltvTierBps", [app.chain.arg.integer(2)]),
          app.chain.readRaw("ltvTierBps", [app.chain.arg.integer(3)]),
          app.chain.readRaw("feeBps", []),
          app.chain.readRaw("neoPrice", []),
          app.chain.readRaw("pool", []),
        ]);
      }

      const t1 = requireNonNegative(parseExactInteger(t1Raw, "tier 1 LTV"), "tier 1 LTV");
      const t2 = requireNonNegative(parseExactInteger(t2Raw, "tier 2 LTV"), "tier 2 LTV");
      const t3 = requireNonNegative(parseExactInteger(t3Raw, "tier 3 LTV"), "tier 3 LTV");
      const fee = requireNonNegative(parseExactInteger(feeRaw, "origination fee"), "origination fee");
      const price = requireNonNegative(parseExactInteger(priceRaw, "NEO price"), "NEO price");
      const pool = requireNonNegative(parseExactInteger(poolRaw, "pool"), "pool");

      if (!(t1 > 0n && t1 < t2 && t2 < t3 && t3 <= 10_000n)) {
        throw new Error("Invalid on-chain LTV tiers");
      }
      if (fee > 10_000n) throw new Error("Invalid on-chain origination fee");

      platformStats.set({
        ltvTier1Bps: Number(t1),
        ltvTier2Bps: Number(t2),
        ltvTier3Bps: Number(t3),
        platformFeeBps: Number(fee),
      });
      neoPriceBase.set(price);
      neoPrice.set(gasFromBaseUnits(price));
      poolGasBase.set(pool);
      poolGas.set(gasFromBaseUnits(pool));
      marketStatus.set("ready");
      return true;
    } catch (error) {
      warnLoadFailure("loadMarket", error);
      marketStatus.set("error");
      return false;
    }
  };

  /** Read both wallet assets together so one stale leg cannot authorize a write. */
  const loadBalances = async (): Promise<boolean> => {
    const hash = myHash();
    if (!hash) {
      neoBalance.set(0);
      gasBalance.set(0);
      gasBalanceBase.set(0n);
      balancesStatus.set("awaiting-wallet");
      return false;
    }
    balancesStatus.set("loading");
    try {
      const [neoRaw, gasRaw] = await Promise.all([
        app.chain.readRaw("balanceOf", [app.chain.arg.hash160(hash)], { scriptHash: NEO_HASH }),
        app.chain.readRaw("balanceOf", [app.chain.arg.hash160(hash)], { scriptHash: GAS_HASH }),
      ]);
      const neo = requireNonNegative(parseExactInteger(neoRaw, "NEO balance"), "NEO balance");
      const gas = requireNonNegative(parseExactInteger(gasRaw, "GAS balance"), "GAS balance");
      if (neo > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("NEO balance exceeds safe display range");
      neoBalance.set(Number(neo));
      gasBalanceBase.set(gas);
      gasBalance.set(gasFromBaseUnits(gas));
      balancesStatus.set("ready");
      return true;
    } catch (error) {
      warnLoadFailure("loadBalances", error);
      balancesStatus.set("error");
      return false;
    }
  };

  /**
   * Load the connected wallet's active loan position via getLoan. collateral is
   * WHOLE NEO; borrowed is GAS base units → ÷1e8 for display; ltvBps → percent.
   */
  const loadLoanPosition = async (): Promise<boolean> => {
    const hash = myHash();
    if (!hash) {
      loan.set({ borrowed: 0, collateralLocked: 0, active: false });
      loanBorrowedBase.set(0n);
      activeLoanId.set(0n);
      positionStatus.set("awaiting-wallet");
      return false;
    }
    positionStatus.set("loading");
    try {
      const raw = platformMode
        ? await app.platformDeFi.getSingleLoanPosition(hash)
        : await app.chain.readRaw("getLoan", [app.chain.arg.hash160(hash)]);
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        throw new Error("Invalid loan position response");
      }
      const data = raw as Record<string, unknown>;
      const active = parseExactBoolean(data.active, "loan active flag");
      const collateral = requireNonNegative(
        parseExactInteger(data.collateral, "loan collateral"),
        "loan collateral",
      );
      const borrowed = requireNonNegative(
        parseExactInteger(data.borrowed, "loan debt"),
        "loan debt",
      );
      const ltvBps = requireNonNegative(parseExactInteger(data.ltvBps, "loan LTV"), "loan LTV");
      const loanId = platformMode
        ? requireNonNegative(parseExactInteger(data.loanId, "loan id"), "loan id")
        : 0n;
      if (active && (collateral <= 0n || borrowed <= 0n || ltvBps <= 0n || ltvBps > 10_000n)) {
        throw new Error("Invalid active loan position");
      }
      if (platformMode && active && loanId <= 0n) throw new Error("Invalid active loan id");
      if (collateral > BigInt(Number.MAX_SAFE_INTEGER)) {
        throw new Error("Loan collateral exceeds safe display range");
      }
      loanBorrowedBase.set(active ? borrowed : 0n);
      activeLoanId.set(active ? loanId : 0n);
      loan.set({
        borrowed: active ? gasFromBaseUnits(borrowed) : 0,
        collateralLocked: active ? Number(collateral) : 0,
        active,
        ltvPercent: active ? Number(ltvBps) / 100 : undefined,
      });
      positionStatus.set("ready");
      return true;
    } catch (error) {
      warnLoadFailure("loadLoanPosition", error);
      positionStatus.set("error");
      return false;
    }
  };

  /**
   * Load the reclaimable deposit-then-act credits: NEO collateral credited but never
   * borrowed (WHOLE NEO) and GAS repay-credit deposited but never applied (÷1e8).
   */
  const loadReclaimable = async (): Promise<boolean> => {
    const hash = myHash();
    if (!hash) {
      collateralCredit.set(0);
      repayCredit.set(0);
      recoveryStatus.set("awaiting-wallet");
      return false;
    }
    recoveryStatus.set("loading");
    try {
      const [collateralRaw, repayRaw] = platformMode
        ? await Promise.all([
            app.platformDeFi.neoCreditOf(hash),
            app.platformDeFi.gasCreditOf(hash),
          ])
        : await Promise.all([
            app.chain.readRaw("collateralCreditOf", [app.chain.arg.hash160(hash)]),
            app.chain.readRaw("repayCreditOf", [app.chain.arg.hash160(hash)]),
          ]);
      const collateral = requireNonNegative(
        parseExactInteger(collateralRaw, "collateral credit"),
        "collateral credit",
      );
      const repay = requireNonNegative(parseExactInteger(repayRaw, "repay credit"), "repay credit");
      if (collateral > BigInt(Number.MAX_SAFE_INTEGER)) {
        throw new Error("Collateral credit exceeds safe display range");
      }
      collateralCredit.set(Number(collateral));
      repayCredit.set(gasFromBaseUnits(repay));
      recoveryStatus.set("ready");
      return true;
    } catch (error) {
      warnLoadFailure("loadReclaimable", error);
      recoveryStatus.set("error");
      return false;
    }
  };

  /** Load the platform-wide loan totals. borrowed/repaid are GAS base units → ÷1e8. */
  const loadStats = async (): Promise<boolean> => {
    statsStatus.set("loading");
    try {
      let loansRaw: unknown;
      let borrowedRaw: unknown;
      let repaidRaw: unknown;
      if (platformMode) {
        const statsRaw = await app.platformDeFi.getLendingStats();
        if (!statsRaw || typeof statsRaw !== "object" || Array.isArray(statsRaw)) {
          throw new Error("Invalid shared lending stats");
        }
        const shared = statsRaw as Record<string, unknown>;
        loansRaw = shared.totalLoans;
        borrowedRaw = shared.totalDebt;
        repaidRaw = shared.totalRepaid;
      } else {
        [loansRaw, borrowedRaw, repaidRaw] = await Promise.all([
          app.chain.readRaw("totalLoans", []),
          app.chain.readRaw("totalBorrowed", []),
          app.chain.readRaw("totalRepaid", []),
        ]);
      }
      const loans = requireNonNegative(parseExactInteger(loansRaw, "total loans"), "total loans");
      const borrowed = requireNonNegative(
        parseExactInteger(borrowedRaw, "total borrowed"),
        "total borrowed",
      );
      const repaid = requireNonNegative(parseExactInteger(repaidRaw, "total repaid"), "total repaid");
      if (loans > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("Loan count exceeds safe display range");
      stats.set({
        totalLoans: Number(loans),
        totalBorrowed: gasFromBaseUnits(borrowed),
        totalRepaid: gasFromBaseUnits(repaid),
      });
      statsStatus.set("ready");
      return true;
    } catch (error) {
      warnLoadFailure("loadStats", error);
      statsStatus.set("error");
      return false;
    }
  };

  const ensureWalletSnapshot = async (): Promise<{ address: string; hash: string }> => {
    const nextAddress = address.get() || (await app.chain.ensureWallet());
    const hash = nextAddress ? addressToScriptHash(nextAddress) : null;
    if (!nextAddress || !hash) throw new Error(t("walletStatusIdle"));
    setAddress(nextAddress);
    return { address: nextAddress, hash };
  };

  const requireBorrowSnapshot = async (): Promise<void> => {
    const [runtimeOk, marketOk, balancesOk, positionOk, recoveryOk] = await Promise.all([
      loadRuntime(),
      loadMarket(),
      loadBalances(),
      loadLoanPosition(),
      loadReclaimable(),
    ]);
    if (!runtimeOk || !marketOk || !balancesOk || !positionOk || !recoveryOk) {
      throw new Error(t("criticalDataUnavailable"));
    }
    if (neoPriceBase.get() <= 0n) throw new Error(t("priceNotConfigured"));
  };

  const requireManageSnapshot = async (): Promise<void> => {
    const [runtimeOk, balancesOk, positionOk, recoveryOk] = await Promise.all([
      loadRuntime(),
      loadBalances(),
      loadLoanPosition(),
      loadReclaimable(),
    ]);
    if (!runtimeOk || !balancesOk || !positionOk || !recoveryOk) {
      throw new Error(t("criticalDataUnavailable"));
    }
  };

  const readCreditExact = async (hash: string, operation: "collateralCreditOf" | "repayCreditOf") => {
    const raw = platformMode
      ? operation === "collateralCreditOf"
        ? await app.platformDeFi.neoCreditOf(hash)
        : await app.platformDeFi.gasCreditOf(hash)
      : await app.chain.readRaw(operation, [app.chain.arg.hash160(hash)]);
    return requireNonNegative(parseExactInteger(raw, operation), operation);
  };

  const normalizeTxid = (value: unknown): string => {
    const raw = String(value ?? "").trim().toLowerCase().replace(/^0x/, "");
    return raw ? `0x${raw}` : "";
  };

  const eventBorrowerMatches = (value: unknown, borrowerHash: string): boolean => {
    const expected = borrowerHash.toLowerCase().replace(/^0x/, "");
    const decoded = addressToScriptHash(String(value ?? ""));
    const raw = String(decoded || value || "").trim().toLowerCase().replace(/^0x/, "");
    if (!raw || !expected) return false;
    const reversed = (expected.match(/../g) ?? []).reverse().join("");
    return raw === expected || raw === reversed;
  };

  const eventIntegerMatches = (event: unknown, index: number, expected: string): boolean => {
    try {
      return parseExactInteger(eventValue(event, index), `event slot ${index}`).toString() === expected;
    } catch {
      return false;
    }
  };

  const eventStringMatches = (event: unknown, index: number, expected: string): boolean =>
    String(eventValue(event, index) ?? "").trim() === expected;

  const eventMatchesOperation = (
    event: unknown,
    operation: PendingSelfLoanOperation,
  ): boolean => {
    if (!event || typeof event !== "object") return false;
    const row = event as Record<string, unknown>;
    const eventName = String(row.event_name ?? row.eventName ?? "").trim();
    if (eventName && eventName !== operation.eventName) return false;
    const eventTxid = normalizeTxid(
      row.tx_hash ?? row.txid ?? row.transaction_hash ?? row.transactionHash,
    );
    if (eventTxid && eventTxid !== normalizeTxid(operation.txid)) return false;
    if (platformMode) {
      if (!eventStringMatches(event, 0, PLATFORM_APP_ID)) return false;
      if (operation.phase === "collateral-deposit" || operation.phase === "repay-deposit") {
        const asset = operation.phase === "collateral-deposit" ? NEO_HASH : GAS_HASH;
        return eventBorrowerMatches(eventValue(event, 1), operation.borrower)
          && eventBorrowerMatches(eventValue(event, 2), asset)
          && eventIntegerMatches(event, 3, operation.eventAmountBase);
      }
      if (operation.phase === "reclaim-collateral" || operation.phase === "reclaim-repay") {
        const asset = operation.phase === "reclaim-collateral" ? NEO_HASH : GAS_HASH;
        return eventBorrowerMatches(eventValue(event, 1), operation.borrower)
          && eventBorrowerMatches(eventValue(event, 2), asset)
          && eventIntegerMatches(event, 3, operation.eventAmountBase);
      }
      if (operation.phase === "borrow") {
        return eventBorrowerMatches(eventValue(event, 2), operation.borrower)
          && eventIntegerMatches(event, 3, operation.expectedCollateralBase ?? "")
          && eventIntegerMatches(event, 4, operation.expectedDisbursedBase ?? "");
      }
      if (
        operation.expectedLoanId
        && !eventIntegerMatches(event, 1, operation.expectedLoanId)
      ) return false;
      if (operation.phase === "collateral-add") {
        return eventIntegerMatches(event, 2, operation.eventAmountBase)
          && eventIntegerMatches(event, 3, operation.expectedCollateralBase ?? "");
      }
      if (operation.phase === "repay") {
        return eventIntegerMatches(event, 2, operation.eventAmountBase)
          && eventIntegerMatches(event, 3, operation.expectedDebtBase ?? "");
      }
      return true;
    }
    if (!eventBorrowerMatches(eventValue(event, 0), operation.borrower)) return false;
    if (!eventIntegerMatches(event, 1, operation.eventAmountBase)) return false;

    if (operation.phase === "collateral-deposit" || operation.phase === "repay-deposit") {
      try {
        const credited = parseExactInteger(eventValue(event, 2), "credited balance");
        return credited >= BigInt(operation.expectedCreditBase ?? "0");
      } catch {
        return false;
      }
    }
    if (operation.phase === "borrow") {
      return eventIntegerMatches(event, 2, operation.expectedDebtBase ?? "")
        && eventIntegerMatches(event, 3, operation.expectedDisbursedBase ?? "");
    }
    if (operation.phase === "collateral-add") {
      return eventIntegerMatches(event, 2, operation.expectedCollateralBase ?? "");
    }
    if (operation.phase === "repay") {
      return eventIntegerMatches(event, 2, operation.expectedDebtBase ?? "");
    }
    return true;
  };

  const readLoanExact = async (borrowerHash: string) => {
    const raw = platformMode
      ? await app.platformDeFi.getSingleLoanPosition(borrowerHash)
      : await app.chain.readRaw("getLoan", [app.chain.arg.hash160(borrowerHash)]);
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      throw new Error("Invalid loan readback");
    }
    const row = raw as Record<string, unknown>;
    return {
      loanId: platformMode
        ? requireNonNegative(parseExactInteger(row.loanId, "loan id readback"), "loan id readback")
        : 0n,
      active: parseExactBoolean(row.active, "loan active readback"),
      collateral: requireNonNegative(
        parseExactInteger(row.collateral, "loan collateral readback"),
        "loan collateral readback",
      ),
      debt: requireNonNegative(
        parseExactInteger(row.borrowed, "loan debt readback"),
        "loan debt readback",
      ),
      ltvBps: requireNonNegative(
        parseExactInteger(row.ltvBps, "loan LTV readback"),
        "loan LTV readback",
      ),
    };
  };

  const operationReadbackMatches = async (
    operation: PendingSelfLoanOperation,
  ): Promise<boolean> => {
    try {
      if (operation.phase === "collateral-deposit") {
        return await readCreditExact(operation.borrower, "collateralCreditOf")
          >= BigInt(operation.expectedCreditBase ?? "0");
      }
      if (operation.phase === "repay-deposit") {
        return await readCreditExact(operation.borrower, "repayCreditOf")
          >= BigInt(operation.expectedCreditBase ?? "0");
      }
      if (operation.phase === "reclaim-collateral") {
        return await readCreditExact(operation.borrower, "collateralCreditOf") === 0n;
      }
      if (operation.phase === "reclaim-repay") {
        return await readCreditExact(operation.borrower, "repayCreditOf") === 0n;
      }

      const live = await readLoanExact(operation.borrower);
      if (
        operation.expectedLoanId
        && !(operation.phase === "repay" && operation.expectedDebtBase === "0")
        && live.loanId.toString() !== operation.expectedLoanId
      ) return false;
      if (operation.phase === "borrow") {
        return live.active
          && live.collateral.toString() === operation.expectedCollateralBase
          && live.debt.toString() === operation.expectedDebtBase
          && live.ltvBps.toString() === operation.expectedLtvBps
          && await readCreditExact(operation.borrower, "collateralCreditOf") === 0n;
      }
      if (operation.phase === "collateral-add") {
        return live.active
          && live.collateral.toString() === operation.expectedCollateralBase
          && live.debt.toString() === operation.expectedDebtBase
          && await readCreditExact(operation.borrower, "collateralCreditOf") === 0n;
      }
      const expectedDebt = BigInt(operation.expectedDebtBase ?? "0");
      return live.debt === expectedDebt
        && live.active === (expectedDebt > 0n)
        && await readCreditExact(operation.borrower, "repayCreditOf") === 0n;
    } catch {
      return false;
    }
  };

  const operationScope = (borrowerHash: string): SelfLoanOperationScope => {
    const network = activeNetwork.get();
    const contract = normalizeScriptHash(app.chain.contractAddress.get() ?? "");
    if (!network || !contract || contract === "0x") throw new Error(t("runtimeBindingMismatch"));
    return normalizeSelfLoanOperationScope({ borrower: borrowerHash, network, contract });
  };

  const assertDurableRecovery = (scope: SelfLoanOperationScope): void => {
    const existing = operationStore.get(scope);
    if (existing) {
      pendingOperation.set(existing);
      pendingConfirmation.set(t("pendingTransactionRestored"));
      throw new Error(t("pendingTransactionBlocksAction"));
    }
    const ready = operationStore.canPersist(scope);
    journalReady.set(ready);
    if (!ready) throw new Error(t("transactionRecoveryUnavailable"));
  };

  const persistBroadcast = (
    draft: PendingSelfLoanDraft,
    txid: string,
  ): PendingSelfLoanOperation | null => {
    if (!txid) return null;
    const stored = operationStore.set(createPendingSelfLoanOperation(draft, txid));
    pendingOperation.set(stored.operation);
    journalReady.set(stored.durable);
    pendingConfirmation.set(t("transactionPending"));
    return stored.operation;
  };

  const clearPending = (operation: PendingSelfLoanOperation): void => {
    operationStore.clear(operation);
    pendingOperation.set(null);
    pendingConfirmation.set("");
  };

  const invokeTrackedRun = async (
    run: (onTransactionSent: (txid: string) => void) =>
      Promise<{
        txid: string;
        success?: boolean;
        event?: unknown;
        verified?: boolean;
      }>,
    draft: PendingSelfLoanDraft,
    pendingKey: string,
  ): Promise<ActionOutcome> => {
    let broadcast: PendingSelfLoanOperation | null = null;
    let result: {
      txid: string;
      success?: boolean;
      event?: unknown;
      verified?: boolean;
    };
    try {
      result = await run((txid) => {
        broadcast = persistBroadcast(draft, txid);
      });
    } catch (error) {
      if (broadcast || pendingOperation.get()) {
        pendingConfirmation.set(t(pendingKey));
        return "pending";
      }
      throw error;
    }
    const tracked = broadcast ?? persistBroadcast(draft, result.txid);
    if (!tracked || result.success === false) throw new Error(t("transactionFailed"));
    const exactEvent = eventMatchesOperation(result.event, tracked);
    const exactReadback = await operationReadbackMatches(tracked);
    if (result.verified !== true || !exactEvent || !exactReadback) {
      pendingConfirmation.set(t(pendingKey));
      return "pending";
    }
    clearPending(tracked);
    return "confirmed";
  };

  const invokeTracked = async (
    operationName: string,
    args: Parameters<typeof app.chain.invoke>[1],
    options: { scriptHash?: string; waitForEvent: string },
    draft: PendingSelfLoanDraft,
    pendingKey: string,
  ): Promise<ActionOutcome> => invokeTrackedRun(
    (onTransactionSent) => app.chain.invoke(operationName, args, {
      ...options,
      onTransactionSent,
    }),
    draft,
    pendingKey,
  );

  /**
   * Atomic transfer + repay. This avoids creating a new standalone GAS credit
   * on the published v1 generation, whose manifest omits a confirmation event
   * for withdrawRepayCredit. If either script faults, the whole Neo transaction
   * reverts; the exact Repaid event and readback still gate success.
   */
  const invokeTrackedBatchRun = async (
    run: (onTransactionSent: (txid: string) => void) =>
      Promise<{ txid: string; success?: boolean }>,
    draft: PendingSelfLoanDraft,
    pendingKey: string,
  ): Promise<ActionOutcome> => {
    let broadcast: PendingSelfLoanOperation | null = null;
    let result: { txid: string; success?: boolean };
    try {
      result = await run((txid) => {
        broadcast = persistBroadcast(draft, txid);
      });
    } catch (error) {
      if (broadcast || pendingOperation.get()) {
        pendingConfirmation.set(t(pendingKey));
        return "pending";
      }
      throw error;
    }
    const tracked = broadcast ?? persistBroadcast(draft, result.txid);
    if (!tracked || result.success === false) throw new Error(t("transactionFailed"));
    const event = await app.events.waitFor(tracked.txid, tracked.eventName, 45_000);
    if (
      !event
      || !eventMatchesOperation(event, tracked)
      || !(await operationReadbackMatches(tracked))
    ) {
      pendingConfirmation.set(t(pendingKey));
      return "pending";
    }
    clearPending(tracked);
    return "confirmed";
  };

  const invokeTrackedBatch = async (
    calls: Parameters<typeof app.chain.invokeMultiple>[0],
    draft: PendingSelfLoanDraft,
    pendingKey: string,
  ): Promise<ActionOutcome> => invokeTrackedBatchRun(
    (onTransactionSent) => app.chain.invokeMultiple(calls, { onTransactionSent }),
    draft,
    pendingKey,
  );

  const recoverPendingOperation = async (): Promise<boolean> => {
    const borrowerHash = myHash();
    if (!borrowerHash || !runtimeCompatible.get()) return false;
    const scope = operationScope(borrowerHash);
    const restored = operationStore.get(scope);
    if (!restored) {
      pendingOperation.set(null);
      return false;
    }
    const current = pendingOperation.get();
    pendingOperation.set(restored);
    if (!current || current.txid !== restored.txid || !pendingConfirmation.get()) {
      pendingConfirmation.set(t("pendingTransactionRestored"));
    }
    journalReady.set(true);
    try {
      const event = await app.events.waitFor(restored.txid, restored.eventName, 1);
      if (!event || !eventMatchesOperation(event, restored)) return false;
      if (!(await operationReadbackMatches(restored))) return false;
      clearPending(restored);
      return true;
    } catch {
      return false;
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
   *
   * Deliberately app-side orchestration on app.chain.invoke (not
   * app.funds.prepayAndCall): the framework prepay lane is the unconditional
   * full-amount GAS deposit (indexer-confirmed). This deposit is NEO, tops up
   * only the SHORTFALL over existing credit, and settles on the
   * CollateralCredited event — and the stranded-credit copy
   * (collateralCreditHeld) is driven by the app's own depositSettled branch.
   */
  const takeLoan = async (expectedQuote?: BorrowQuoteGuard): Promise<ActionOutcome> => {
    if (isBusy.get()) throw new Error(t("operationInProgress"));
    pendingConfirmation.set("");

    // Validate shape before opening a wallet prompt; NEO is indivisible.
    const neoUnits = app.amount.parseNeoToUnits(collateralAmount.get());
    if (neoUnits === null) throw new Error(t("neoMustBeInteger"));
    const neoInt = BigInt(neoUnits);

    const { hash } = await ensureWalletSnapshot();
    await requireBorrowSnapshot();
    if (loan.get().active) throw new Error(t("loanAlreadyActiveHint"));
    const scope = operationScope(hash);

    const credit = await readCreditExact(hash, "collateralCreditOf");
    if (credit > neoInt) {
      throw new Error(t("collateralCreditExceedsAmount", {
        credit: credit.toString(),
        amount: neoInt.toString(),
      }));
    }
    const shortfall = neoInt - credit;
    if (shortfall > BigInt(Math.floor(neoBalance.get()))) throw new Error(t("insufficientNeo"));

    const tiers = platformStats.get();
    const tierBps = selectedTier.get() === 1
      ? tiers.ltvTier1Bps
      : selectedTier.get() === 2
        ? tiers.ltvTier2Bps
        : selectedTier.get() === 3
          ? tiers.ltvTier3Bps
          : 0;
    if (tierBps <= 0) throw new Error(t("criticalDataUnavailable"));
    const grossBase = neoInt * neoPriceBase.get() * BigInt(tierBps) / 10_000n;
    const feeBase = grossBase * BigInt(tiers.platformFeeBps) / 10_000n;
    const disbursedBase = grossBase - feeBase;
    if (grossBase <= 0n || disbursedBase <= 0n) throw new Error(t("borrowAmountTooSmall"));
    if (expectedQuote && (
      expectedQuote.priceBase !== neoPriceBase.get()
      || expectedQuote.feeBps !== tiers.platformFeeBps
      || expectedQuote.ltvBps !== tierBps
      || expectedQuote.disbursedBase !== disbursedBase
    )) {
      throw new Error(t("quoteChanged"));
    }
    if (disbursedBase > poolGasBase.get()) {
      throw new Error(t("insufficientPool", { pool: fmt(poolGas.get()) }));
    }

    const contractHash = app.chain.contractAddress.get();
    if (!contractHash) throw new Error(t("missingContract"));
    assertDurableRecovery(scope);

    isLoading.set(true);
    let depositSettled = false;
    try {
      if (shortfall > 0n) {
        const depositDraft: PendingSelfLoanDraft = {
          ...scope,
          phase: "collateral-deposit",
          eventName: platformMode ? "CreditDeposited" : "CollateralCredited",
          eventAmountBase: shortfall.toString(),
          expectedCreditBase: neoInt.toString(),
        };
        const depositOutcome = platformMode
          ? await invokeTrackedRun(
              (onTransactionSent) => app.platformDeFi.depositNeo(shortfall, hash, {
                waitForEvent: "CreditDeposited",
                onTransactionSent,
              }),
              depositDraft,
              "collateralDepositPending",
            )
          : await invokeTracked(
              "transfer",
              [
                app.chain.arg.hash160(hash),
                app.chain.arg.hash160(contractHash),
                app.chain.arg.integer(shortfall),
                app.chain.arg.string(COLLATERAL_MEMO),
              ],
              { scriptHash: NEO_HASH, waitForEvent: "CollateralCredited" },
              depositDraft,
              "collateralDepositPending",
            );
        if (depositOutcome === "pending") {
          await loadAll();
          return "pending";
        }
        depositSettled = true;
      }

      let outcome: ActionOutcome;
      try {
        const borrowDraft: PendingSelfLoanDraft = {
          ...scope,
          phase: "borrow",
          eventName: platformMode ? "LoanCreated" : "LoanTaken",
          eventAmountBase: neoInt.toString(),
          expectedCollateralBase: neoInt.toString(),
          expectedDebtBase: grossBase.toString(),
          expectedLtvBps: String(tierBps),
          expectedDisbursedBase: disbursedBase.toString(),
        };
        outcome = platformMode
          ? await invokeTrackedRun(
              (onTransactionSent) => app.platformDeFi.createLoan({
                borrower: hash,
                ltvTier: selectedTier.get(),
                collateralAmount: neoInt,
                options: { waitForEvent: "LoanCreated", onTransactionSent },
              }),
              borrowDraft,
              "loanPendingConfirmation",
            )
          : await invokeTracked(
              "borrow",
              [app.chain.arg.hash160(hash), app.chain.arg.integer(selectedTier.get())],
              { waitForEvent: "LoanTaken" },
              borrowDraft,
              "loanPendingConfirmation",
            );
      } catch (borrowError) {
        if (depositSettled) throw new Error(t("collateralCreditHeld"));
        // messageOf keeps chain/RPC failures on the localized family copy
        // instead of rethrowing the raw English wallet/VM string.
        throw new Error(app.errors.messageOf(borrowError, t("error")));
      }
      await loadAll();
      if (outcome === "pending") return outcome;

      collateralAmount.set("");
      borrowOkNonce.set(borrowOkNonce.get() + 1);
      return "confirmed";
    } finally {
      isLoading.set(false);
    }
  };

  /**
   * Borrow from manifest form data: { collateralAmount, ltvTier }. Sets the
   * explicit amount/tier from the PlayArea action payload, then runs the
   * deposit-then-borrow flow under the isBorrowing flag.
   */
  const borrow = async (formData: Record<string, unknown>): Promise<ActionOutcome> => {
    const nextCollateral = String(formData.collateralAmount ?? "").trim();
    const nextTier = Number(formData.ltvTier ?? formData.selectedLtv ?? "");
    if (nextCollateral) collateralAmount.set(nextCollateral);
    if (Number.isInteger(nextTier) && nextTier >= 1 && nextTier <= 3) {
      selectedTier.set(nextTier);
    }

    let expectedQuote: BorrowQuoteGuard | undefined;
    try {
      const priceBase = formData.expectedPriceBase;
      const feeBps = formData.expectedFeeBps;
      const ltvBps = formData.expectedLtvBps;
      const disbursedBase = formData.expectedDisbursedBase;
      if (priceBase !== undefined || feeBps !== undefined || ltvBps !== undefined || disbursedBase !== undefined) {
        expectedQuote = {
          priceBase: parseExactInteger(priceBase, "reviewed NEO price"),
          feeBps: Number(parseExactInteger(feeBps, "reviewed fee")),
          ltvBps: Number(parseExactInteger(ltvBps, "reviewed LTV")),
          disbursedBase: parseExactInteger(disbursedBase, "reviewed disbursement"),
        };
      }
    } catch {
      throw new Error(t("quoteChanged"));
    }

    if (isBorrowing.get()) throw new Error(t("operationInProgress"));
    try {
      isBorrowing.set(true);
      return await takeLoan(expectedQuote);
    } finally {
      isBorrowing.set(false);
    }
  };

  /**
   * Add collateral to the active loan (deposit-then-act): a NEO transfer with the
   * "selfloan:collateral" memo (WHOLE integer, no scaling), then addCollateral
   * moves the freshly-credited NEO into the loan. Settles on CollateralAdded.
   */
  const addCollateral = async (amount: string): Promise<ActionOutcome> => {
    if (isAddingCollateral.get()) throw new Error(t("operationInProgress"));
    pendingConfirmation.set("");
    const neoUnits = app.amount.parseNeoToUnits(amount);
    if (neoUnits === null) throw new Error(t("neoMustBeInteger"));
    const neoInt = BigInt(neoUnits);

    const { hash } = await ensureWalletSnapshot();
    await requireManageSnapshot();
    if (!loan.get().active) throw new Error(t("noActiveLoan"));
    if (platformMode && activeLoanId.get() <= 0n) throw new Error(t("criticalDataUnavailable"));
    const scope = operationScope(hash);

    const credit = await readCreditExact(hash, "collateralCreditOf");
    if (credit > neoInt) {
      throw new Error(t("collateralCreditExceedsAmount", {
        credit: credit.toString(),
        amount: neoInt.toString(),
      }));
    }
    const shortfall = neoInt - credit;
    if (shortfall > BigInt(Math.floor(neoBalance.get()))) throw new Error(t("insufficientNeo"));

    const contractHash = app.chain.contractAddress.get();
    if (!contractHash) throw new Error(t("missingContract"));
    assertDurableRecovery(scope);

    isAddingCollateral.set(true);
    let depositSettled = false;
    try {
      if (shortfall > 0n) {
        const depositDraft: PendingSelfLoanDraft = {
          ...scope,
          phase: "collateral-deposit",
          eventName: platformMode ? "CreditDeposited" : "CollateralCredited",
          eventAmountBase: shortfall.toString(),
          expectedCreditBase: neoInt.toString(),
        };
        const depositOutcome = platformMode
          ? await invokeTrackedRun(
              (onTransactionSent) => app.platformDeFi.depositNeo(shortfall, hash, {
                waitForEvent: "CreditDeposited",
                onTransactionSent,
              }),
              depositDraft,
              "collateralDepositPending",
            )
          : await invokeTracked(
              "transfer",
              [
                app.chain.arg.hash160(hash),
                app.chain.arg.hash160(contractHash),
                app.chain.arg.integer(shortfall),
                app.chain.arg.string(COLLATERAL_MEMO),
              ],
              { scriptHash: NEO_HASH, waitForEvent: "CollateralCredited" },
              depositDraft,
              "collateralDepositPending",
            );
        if (depositOutcome === "pending") {
          await loadAll();
          return "pending";
        }
        depositSettled = true;
      }

      let outcome: ActionOutcome;
      try {
        const addDraft: PendingSelfLoanDraft = {
          ...scope,
          phase: "collateral-add",
          eventName: "CollateralAdded",
          eventAmountBase: neoInt.toString(),
          expectedCollateralBase: (BigInt(Math.trunc(loan.get().collateralLocked)) + neoInt).toString(),
          expectedDebtBase: loanBorrowedBase.get().toString(),
          ...(platformMode ? { expectedLoanId: activeLoanId.get().toString() } : {}),
        };
        outcome = platformMode
          ? await invokeTrackedRun(
              (onTransactionSent) => app.platformDeFi.addCollateral(
                activeLoanId.get(),
                neoInt,
                { waitForEvent: "CollateralAdded", onTransactionSent },
              ),
              addDraft,
              "collateralAddPendingConfirmation",
            )
          : await invokeTracked(
              "addCollateral",
              [app.chain.arg.hash160(hash)],
              { waitForEvent: "CollateralAdded" },
              addDraft,
              "collateralAddPendingConfirmation",
            );
      } catch (addError) {
        if (depositSettled || credit > 0n) throw new Error(t("collateralCreditHeld"));
        // messageOf keeps chain/RPC failures on the localized family copy
        // instead of rethrowing the raw English wallet/VM string.
        throw new Error(app.errors.messageOf(addError, t("error")));
      }
      await loadAll();
      if (outcome === "pending") return outcome;
      addCollateralOkNonce.set(addCollateralOkNonce.get() + 1);
      return "confirmed";
    } finally {
      isAddingCollateral.set(false);
    }
  };

  /**
   * Repay the loan atomically: a GAS transfer with the "selfloan:repay" memo
   * (amount scaled to base units, no floats) and repay execute in one transaction. The contract
   * caps at the debt and refunds any excess, and on full repayment closes the loan
   * and releases the NEO collateral in the same call. Settles on Repaid.
   *
   * The repayment is still capped client-side at the outstanding debt for good UX —
   * a user should not be prompted to over-deposit even though the contract refunds.
   */
  const repay = async (amount: string): Promise<ActionOutcome> => {
    if (isRepaying.get()) throw new Error(t("operationInProgress"));
    pendingConfirmation.set("");
    const value = String(amount || "").trim();
    // Strict decimal validation: reject NaN, scientific/hex/whitespace and
    // non-positive amounts before any chain call. The S6 null-on-invalid GAS
    // scaler (×1e8, no floats) then rejects zero with the same localized copy.
    if (!/^\d+(\.\d{1,8})?$/.test(value)) throw new Error(t("enterValidAmount"));
    const baseUnits = app.amount.parseGasToFixed8(value);
    if (baseUnits === null) throw new Error(t("enterValidAmount"));
    const baseAmount = BigInt(baseUnits);

    const { hash } = await ensureWalletSnapshot();
    await requireManageSnapshot();
    const outstanding = loan.get().borrowed;
    if (!loan.get().active || loanBorrowedBase.get() <= 0n) throw new Error(t("repayNoActiveLoan"));
    if (platformMode && activeLoanId.get() <= 0n) throw new Error(t("criticalDataUnavailable"));
    if (baseAmount > loanBorrowedBase.get()) {
      throw new Error(t("repayExceedsDebt", { amount: fmt(outstanding) }));
    }
    const scope = operationScope(hash);

    const contractHash = app.chain.contractAddress.get();
    if (!contractHash) throw new Error(t("missingContract"));

    isRepaying.set(true);
    try {
      // Repay consumes ALL credited GAS. Never apply more than the user reviewed.
      const credit = await readCreditExact(hash, "repayCreditOf");
      if (credit > baseAmount) {
        throw new Error(t("repayCreditExceedsAmount", {
          credit: fmt(gasFromBaseUnits(credit), 8),
          amount: value,
        }));
      }
      const shortfall = baseAmount - credit;
      if (shortfall > gasBalanceBase.get()) throw new Error(t("insufficientGas"));
      assertDurableRecovery(scope);
      const repayDraft: PendingSelfLoanDraft = {
        ...scope,
        phase: "repay",
        eventName: platformMode ? "LoanRepaid" : "Repaid",
        eventAmountBase: baseAmount.toString(),
        expectedDebtBase: (loanBorrowedBase.get() - baseAmount).toString(),
        expectedCollateralBase: String(Math.trunc(loan.get().collateralLocked)),
        ...(platformMode ? { expectedLoanId: activeLoanId.get().toString() } : {}),
      };
      let outcome: ActionOutcome;
      if (platformMode) {
        outcome = await invokeTrackedBatchRun(
          (onTransactionSent) => app.platformDeFi.repayLoanWithGasDeposit({
            loanId: activeLoanId.get(),
            depositAmount: shortfall,
            payer: hash,
            options: { onTransactionSent },
          }),
          repayDraft,
          "repayPendingConfirmation",
        );
      } else {
        const calls: Parameters<typeof app.chain.invokeMultiple>[0] = [];
        if (shortfall > 0n) {
          calls.push({
            scriptHash: GAS_HASH,
            operation: "transfer",
            args: [
              app.chain.arg.hash160(hash),
              app.chain.arg.hash160(contractHash),
              app.chain.arg.integer(shortfall),
              app.chain.arg.string(REPAY_MEMO),
            ],
          });
        }
        calls.push({
          operation: "repay",
          args: [app.chain.arg.hash160(hash)],
        });
        outcome = await invokeTrackedBatch(
          calls,
          repayDraft,
          "repayPendingConfirmation",
        );
      }
      await loadAll();
      if (outcome === "pending") return outcome;
      repayOkNonce.set(repayOkNonce.get() + 1);
      return "confirmed";
    } finally {
      isRepaying.set(false);
    }
  };

  /**
   * Reclaim NEO collateral-credit deposited but never borrowed against, via
   * withdraw(account). Returns the credited NEO to the wallet (CollateralWithdrawn).
   */
  const reclaimCollateral = async (): Promise<ActionOutcome> => {
    if (isProcessing.get()) throw new Error(t("operationInProgress"));
    pendingConfirmation.set("");
    const { hash } = await ensureWalletSnapshot();
    if (!(await loadRuntime())) throw new Error(t("runtimeBindingMismatch"));
    if (!(await loadReclaimable())) throw new Error(t("criticalDataUnavailable"));
    const credit = await readCreditExact(hash, "collateralCreditOf");
    if (credit <= 0n) throw new Error(t("noCollateralCredit"));
    const scope = operationScope(hash);
    assertDurableRecovery(scope);

    isProcessing.set(true);
    try {
      const draft: PendingSelfLoanDraft = {
        ...scope,
        phase: "reclaim-collateral",
        eventName: platformMode ? "CreditWithdrawn" : "CollateralWithdrawn",
        eventAmountBase: credit.toString(),
        expectedCreditBase: "0",
      };
      const outcome = platformMode
        ? await invokeTrackedRun(
            (onTransactionSent) => app.platformDeFi.withdrawNeoCredit(
              credit,
              hash,
              { waitForEvent: "CreditWithdrawn", onTransactionSent },
            ),
            draft,
            "recoveryPendingConfirmation",
          )
        : await invokeTracked(
            "withdraw",
            [app.chain.arg.hash160(hash)],
            { waitForEvent: "CollateralWithdrawn" },
            draft,
            "recoveryPendingConfirmation",
          );
      await loadAll();
      return outcome;
    } finally {
      isProcessing.set(false);
    }
  };

  /**
   * Reclaim GAS repay-credit deposited but never applied, via
   * withdrawRepayCredit(account). Returns the GAS to the wallet (RepayCreditWithdrawn).
   */
  const reclaimRepayCredit = async (): Promise<ActionOutcome> => {
    if (isProcessing.get()) throw new Error(t("operationInProgress"));
    pendingConfirmation.set("");
    const { hash } = await ensureWalletSnapshot();
    if (!(await loadRuntime())) throw new Error(t("runtimeBindingMismatch"));
    if (!repayRecoveryAvailable.get()) throw new Error(t("repayRecoveryUnavailable"));
    if (!(await loadReclaimable())) throw new Error(t("criticalDataUnavailable"));
    const credit = await readCreditExact(hash, "repayCreditOf");
    if (credit <= 0n) throw new Error(t("noRepayCredit"));
    const scope = operationScope(hash);
    assertDurableRecovery(scope);

    isProcessing.set(true);
    try {
      const draft: PendingSelfLoanDraft = {
        ...scope,
        phase: "reclaim-repay",
        eventName: platformMode ? "CreditWithdrawn" : "RepayCreditWithdrawn",
        eventAmountBase: credit.toString(),
        expectedCreditBase: "0",
      };
      const outcome = platformMode
        ? await invokeTrackedRun(
            (onTransactionSent) => app.platformDeFi.withdrawGasCredit(
              credit,
              hash,
              { waitForEvent: "CreditWithdrawn", onTransactionSent },
            ),
            draft,
            "recoveryPendingConfirmation",
          )
        : await invokeTracked(
            "withdrawRepayCredit",
            [app.chain.arg.hash160(hash)],
            { waitForEvent: "RepayCreditWithdrawn" },
            draft,
            "recoveryPendingConfirmation",
          );
      await loadAll();
      return outcome;
    } finally {
      isProcessing.set(false);
    }
  };

  // ── Lifecycle ────────────────────────────────────────────────────────

  /** Load all data. Called by defineMiniApp on mount and on wallet reconnect. */
  const loadAll = async () => {
    if (!isMounted) return;
    isConnected.set(Boolean(address.get()));
    isRefreshing.set(true);
    readError.set("");
    try {
      const runtimeOk = await loadRuntime();
      if (!runtimeOk && runtimeStatus.get() === "awaiting-wallet") {
        // Pre-wallet first paint: with no network there is no chain context to
        // read the market, balances or position through. Park every lane in the
        // same neutral state instead of firing reads that can only fail and
        // then reporting those expected failures as "Live data unavailable".
        marketStatus.set("awaiting-wallet");
        balancesStatus.set("awaiting-wallet");
        positionStatus.set("awaiting-wallet");
        recoveryStatus.set("awaiting-wallet");
        lastRefreshAt.set(Date.now());
        return;
      }
      const [marketOk, balancesOk, positionOk, recoveryOk] = await Promise.all([
        loadMarket(),
        loadBalances(),
        loadLoanPosition(),
        loadReclaimable(),
        loadStats(),
      ]);
      const walletReadsOk = !address.get() || (balancesOk && positionOk && recoveryOk);
      if (!runtimeOk || !marketOk || !walletReadsOk) readError.set(t("criticalDataUnavailable"));
      if (runtimeOk && address.get()) await recoverPendingOperation();
      lastRefreshAt.set(Date.now());
    } finally {
      isRefreshing.set(false);
    }
  };

  // ── Public API ───────────────────────────────────────────────────────

  return {
    // Core refs
    isLoading,
    isBorrowing,
    isRepaying,
    isAddingCollateral,
    isProcessing,
    isRefreshing,
    isBusy,
    neoBalance,
    gasBalance,
    gasBalanceBase,
    neoPrice,
    neoPriceBase,
    neoPriceDisplay,
    poolGas,
    poolGasBase,
    poolDisplay,
    marketStatus,
    balancesStatus,
    positionStatus,
    recoveryStatus,
    statsStatus,
    marketReady,
    borrowDataReady,
    manageDataReady,
    readError,
    lastRefreshAt,
    runtimeStatus,
    runtimeCompatible,
    repayRecoveryAvailable,
    activeNetwork,
    runtimeChecksum,
    platformMode,
    activeLoanId,
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
    coverageRatio,
    currentLTV,
    collateralValueGas,
    isPriceNormalized,
    collateralUtilization,
    validateCollateral,
    address,

    // Pending confirmation (relayed-but-unconfirmed)
    pendingConfirmation,
    hasPendingConfirmation,
    pendingOperation,
    hasPendingOperation,
    journalReady,

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
    coverageRatioDisplay,
    currentLTVDisplay,
    healthMetricLabel,
    hasLoanDisplay,
    neoBalanceDisplay,
    gasBalanceDisplay,
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
    recoverPendingOperation,

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
