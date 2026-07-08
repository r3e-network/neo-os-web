import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ChainService } from "../services/ChainService";
import { createMiniAppFramework } from "../react";
import { useSelfLoan } from "../../self-loan/src/composables/useSelfLoan";

// A funded testnet account; addressToScriptHash resolves it without external deps.
const OWNER = "NR3E4D8NUXh3zhbf5ZkAp3rTxWbQqNih32";
const CONTRACT = "0x87f94598c78cb954ca8200d3964ded9b584d7250";

// GAS base-unit multiplier (1 GAS = 1e8 base units).
const GAS = 100_000_000n;

// Default lending-pool liquidity for tests that don't care about the pool
// preflight: large enough to cover every borrow case here (max disbursement is
// 10 NEO × 5 GAS × 40% ≈ 20 GAS net), so the pool gate never trips unless a
// test deliberately sets a smaller `pool`.
const DEFAULT_POOL = 1_000n * GAS;

function t(key: string, params?: Record<string, string | number>) {
  const messages: Record<string, string> = {
    enterValidAmount: "Enter a valid amount",
    neoMustBeInteger: "NEO amount must be a whole number",
    insufficientNeo: "Insufficient NEO balance",
    repayNoActiveLoan: "You have no outstanding loan to repay",
    repayExceedsDebt: `Amount exceeds your outstanding debt of ${params?.amount ?? ""} GAS`,
    collateralCreditHeld: "collateral credit held",
    repayCreditHeld: "repay credit held",
    collateralCreditExceedsAmount: `You have ${params?.credit ?? ""} NEO of existing collateral credit and the contract locks ALL of it — more than the ${params?.amount ?? ""} NEO you entered`,
    noCollateralCredit: "No collateral credit to reclaim",
    noRepayCredit: "No repay credit to reclaim",
    insufficientPool: `Pool can't cover this borrow — only ${params?.pool ?? ""} GAS available. Try a lower amount or LTV tier.`,
    walletStatusIdle: "Wallet not connected",
    missingContract: "Contract not configured",
    notAvailable: "N/A",
    healthFactor: "Health Factor",
    collateralRatio: "Collateral Ratio",
    yes: "Yes",
    no: "No",
    tokenNeo: "NEO",
    tokenGas: "GAS",
    profitAnchorValue: "Operator-selected council candidate",
    ltvTierConservative: "Conservative",
    ltvTierConservativeDesc: "20% LTV",
    ltvTierBalanced: "Balanced",
    ltvTierBalancedDesc: "30% LTV",
    ltvTierAggressive: "Aggressive",
    ltvTierAggressiveDesc: "40% LTV",
  };
  return messages[key] ?? key;
}

/** Reads the contract emulates. Values are RAW on-chain forms (NEO integer / GAS base units). */
interface ChainState {
  neoPrice?: bigint; // GAS base units per 1 NEO (0 / undefined = unset)
  pool?: bigint; // GAS base units available to disburse (undefined = use DEFAULT_POOL)
  neoBalance?: bigint; // WHOLE NEO (integer)
  loan?: {
    collateral: bigint; // WHOLE NEO
    borrowed: bigint; // GAS base units
    ltvBps: bigint;
    active: boolean;
  } | null;
  collateralCredit?: bigint; // WHOLE NEO
  repayCredit?: bigint; // GAS base units
  totalLoans?: bigint;
  totalBorrowed?: bigint; // GAS base units
  totalRepaid?: bigint; // GAS base units
}

interface ContractArg {
  type: string;
  value: string | number | boolean;
}

function makeChain(state: ChainState = {}) {
  const read = vi.fn(async (op: string, _args?: ContractArg[], _opts?: unknown) => {
    switch (op) {
      case "ltvTierBps": {
        const tier = Number((_args?.[0]?.value ?? "1"));
        return tier === 1 ? 2000n : tier === 2 ? 3000n : 4000n;
      }
      case "feeBps":
        return 50n;
      case "neoPrice":
        return state.neoPrice ?? 0n;
      case "pool":
        return state.pool ?? DEFAULT_POOL;
      case "balanceOf":
        return state.neoBalance ?? 0n;
      case "getLoan": {
        const l = state.loan;
        if (!l) return { collateral: 0n, borrowed: 0n, ltvBps: 0n, active: false };
        return { collateral: l.collateral, borrowed: l.borrowed, ltvBps: l.ltvBps, active: l.active };
      }
      case "collateralCreditOf":
        return state.collateralCredit ?? 0n;
      case "repayCreditOf":
        return state.repayCredit ?? 0n;
      case "totalLoans":
        return state.totalLoans ?? 0n;
      case "totalBorrowed":
        return state.totalBorrowed ?? 0n;
      case "totalRepaid":
        return state.totalRepaid ?? 0n;
      default:
        return 0n;
    }
  });

  const invoke = vi.fn(async (_op: string, _args: ContractArg[], _opts?: unknown) => ({
    txid: "0xtx",
    success: true,
  }));

  const chain = {
    read,
    invoke,
    ensureWallet: vi.fn(async () => OWNER),
    contractAddress: { get: () => CONTRACT, set: () => {}, subscribe: () => () => {} },
    address: { get: () => OWNER, set: () => {}, subscribe: () => () => {} },
  } as unknown as ChainService;

  return { chain, read, invoke };
}

/** Wrap a mock chain in the MiniApp framework SDK the composable now consumes. */
function makeApp(chain: ChainService) {
  return createMiniAppFramework(
    { services: { chain }, t } as never,
    { appId: "miniapp-self-loan" },
  );
}

/** Pull every invoke call's [op, args] for assertions. */
function invokeCalls(invoke: ReturnType<typeof vi.fn>) {
  return invoke.mock.calls.map((c) => ({ op: c[0] as string, args: c[1] as ContractArg[], opts: c[2] }));
}

describe("useSelfLoan NEO-integer vs GAS-base-units separation (self-loan-asset)", () => {
  it("reads loan collateral as WHOLE NEO and debt as GAS ÷1e8", async () => {
    // 100 NEO collateral, 20 GAS debt (= 20e8 base units), 20% LTV.
    const { chain } = makeChain({
      loan: { collateral: 100n, borrowed: 20n * GAS, ltvBps: 2000n, active: true },
    });
    const app = useSelfLoan({ app: makeApp(chain), t });
    app.setAddress(OWNER);
    await app.loadAll();

    // Collateral is NEVER scaled by 1e8 — 100 NEO stays 100.
    expect(app.loan.get().collateralLocked).toBe(100);
    // Debt is GAS base units → ÷1e8 for display = 20 GAS.
    expect(app.loan.get().borrowed).toBe(20);
    expect(app.loan.get().active).toBe(true);
  });

  it("reads NEO balance as WHOLE NEO (no ÷1e8)", async () => {
    const { chain } = makeChain({ neoBalance: 250n });
    const app = useSelfLoan({ app: makeApp(chain), t });
    app.setAddress(OWNER);
    await app.loadAll();
    expect(app.neoBalance.get()).toBe(250);
  });

  it("reads platform totals as GAS ÷1e8 and loan count as an integer", async () => {
    const { chain } = makeChain({
      totalLoans: 7n,
      totalBorrowed: 140n * GAS,
      totalRepaid: 35n * GAS,
    });
    const app = useSelfLoan({ app: makeApp(chain), t });
    app.setAddress(OWNER);
    await app.loadAll();
    expect(app.stats.get().totalLoans).toBe(7);
    expect(app.stats.get().totalBorrowed).toBe(140);
    expect(app.stats.get().totalRepaid).toBe(35);
  });

  it("reads tier bps + fee bps straight from the contract", async () => {
    const { chain } = makeChain();
    const app = useSelfLoan({ app: makeApp(chain), t });
    app.setAddress(OWNER);
    await app.loadAll();
    expect(app.platformStats.get().ltvTier1Bps).toBe(2000);
    expect(app.platformStats.get().ltvTier2Bps).toBe(3000);
    expect(app.platformStats.get().ltvTier3Bps).toBe(4000);
    expect(app.platformStats.get().platformFeeBps).toBe(50);
    expect(app.ltvOptions.get().map((o) => o.percent)).toEqual([20, 30, 40]);
  });
});

describe("useSelfLoan borrow flow (self-loan-1)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deposits NEO collateral (integer memo transfer) then calls borrow(tier)", async () => {
    // Price set so borrow is allowed on-chain; 100 NEO available.
    const { chain, invoke } = makeChain({ neoPrice: 5n * GAS, neoBalance: 100n });
    const app = useSelfLoan({ app: makeApp(chain), t });
    app.setAddress(OWNER);
    await app.loadAll();

    app.selectedTier.set(2);
    await app.borrow({ collateralAmount: "10" });

    const calls = invokeCalls(invoke);
    // Step 1: NEO transfer with the collateral memo, amount = WHOLE integer "10".
    const transfer = calls.find((c) => c.op === "transfer");
    expect(transfer).toBeTruthy();
    expect(transfer?.args[2]).toMatchObject({ type: "Integer", value: "10" }); // NOT "1000000000"
    expect(transfer?.args[3]).toMatchObject({ type: "String", value: "selfloan:collateral" });
    expect((transfer?.opts as { scriptHash?: string })?.scriptHash).toBe(
      "0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5",
    );
    // Step 2: borrow(borrower, tier).
    const borrow = calls.find((c) => c.op === "borrow");
    expect(borrow).toBeTruthy();
    expect(borrow?.args[1]).toMatchObject({ type: "Integer", value: "2" });
  });

  it("honors the LTV tier carried by the borrow action payload", async () => {
    const { chain, invoke } = makeChain({ neoPrice: 5n * GAS, neoBalance: 100n });
    const app = useSelfLoan({ app: makeApp(chain), t });
    app.setAddress(OWNER);
    await app.loadAll();

    app.selectedTier.set(1);
    await app.borrow({ collateralAmount: "10", ltvTier: 3 });

    const calls = invokeCalls(invoke);
    const borrow = calls.find((c) => c.op === "borrow");
    expect(app.selectedLtv.get()).toBe(3);
    expect(borrow?.args[1]).toMatchObject({ type: "Integer", value: "3" });
  });

  it("rejects fractional NEO collateral before any chain call", async () => {
    const { chain, invoke } = makeChain({ neoPrice: 5n * GAS, neoBalance: 100n });
    const app = useSelfLoan({ app: makeApp(chain), t });
    app.setAddress(OWNER);
    await app.loadAll();

    app.collateralAmount.set("1.5");
    await expect(app.takeLoan()).rejects.toThrow(t("neoMustBeInteger"));
    expect(invoke).not.toHaveBeenCalled();
  });

  it("rejects malformed NEO amounts via the null-on-invalid scaler (localized copy)", async () => {
    // "10abc" survives the parseFloat pre-validation (parseFloat -> 10) but the
    // strict integer scaler must reject it to null -> the app's own localized
    // t("neoMustBeInteger") throw, with no chain call (S6 parse* migration).
    const { chain, invoke } = makeChain({ neoPrice: 5n * GAS, neoBalance: 100n });
    const app = useSelfLoan({ app: makeApp(chain), t });
    app.setAddress(OWNER);
    await app.loadAll();

    app.collateralAmount.set("10abc");
    await expect(app.takeLoan()).rejects.toThrow(t("neoMustBeInteger"));
    expect(invoke).not.toHaveBeenCalled();
  });

  it("surfaces a held-credit error when the deposit lands but borrow reverts", async () => {
    const { chain, invoke } = makeChain({ neoPrice: 5n * GAS, neoBalance: 100n });
    const app = useSelfLoan({ app: makeApp(chain), t });
    app.setAddress(OWNER);
    await app.loadAll();

    // First invoke (transfer) succeeds, second (borrow) reverts.
    invoke
      .mockResolvedValueOnce({ txid: "0xdep", success: true })
      .mockRejectedValueOnce(new Error("insufficient pool liquidity"));

    app.collateralAmount.set("10");
    await expect(app.takeLoan()).rejects.toThrow(t("collateralCreditHeld"));
  });

  it("skips the deposit when collateral credit already covers the amount", async () => {
    // 10 NEO already credited; borrowing 10 should NOT re-deposit.
    const { chain, invoke } = makeChain({
      neoPrice: 5n * GAS,
      neoBalance: 100n,
      collateralCredit: 10n,
    });
    const app = useSelfLoan({ app: makeApp(chain), t });
    app.setAddress(OWNER);
    await app.loadAll();

    app.collateralAmount.set("10");
    await app.takeLoan();

    const calls = invokeCalls(invoke);
    expect(calls.some((c) => c.op === "transfer")).toBe(false);
    expect(calls.some((c) => c.op === "borrow")).toBe(true);
  });

  it("tops up only the SHORTFALL when residual credit partially covers the amount", async () => {
    // 4 NEO residual credit + typed 10 → transfer just 6; borrow locks 4+6=10,
    // exactly what the user typed (NOT credit + a full 10 re-deposit = 14).
    const { chain, invoke } = makeChain({
      neoPrice: 5n * GAS,
      neoBalance: 100n,
      collateralCredit: 4n,
    });
    const app = useSelfLoan({ app: makeApp(chain), t });
    app.setAddress(OWNER);
    await app.loadAll();

    app.collateralAmount.set("10");
    await app.takeLoan();

    const calls = invokeCalls(invoke);
    const transfer = calls.find((c) => c.op === "transfer");
    expect(transfer?.args[2]).toMatchObject({ type: "Integer", value: "6" });
    expect(transfer?.args[3]).toMatchObject({ type: "String", value: "selfloan:collateral" });
    expect(calls.some((c) => c.op === "borrow")).toBe(true);
  });

  it("blocks borrowing when residual credit exceeds the typed amount (borrow locks ALL credit)", async () => {
    // 12 NEO residual credit, user typed 10: borrow would lock — and size the
    // debt on — 12 NEO, more than consented. Surface the credit warning and
    // make no chain call.
    const { chain, invoke } = makeChain({
      neoPrice: 5n * GAS,
      neoBalance: 100n,
      collateralCredit: 12n,
    });
    const app = useSelfLoan({ app: makeApp(chain), t });
    app.setAddress(OWNER);
    await app.loadAll();

    app.collateralAmount.set("10");
    await expect(app.takeLoan()).rejects.toThrow(
      /12 NEO of existing collateral credit/,
    );
    expect(invoke).not.toHaveBeenCalled();
  });

  it("blocks the borrow before any deposit when the GAS pool can't cover the disbursement", async () => {
    // price 5 GAS/NEO, tier 2 (30% LTV), 0.5% fee. 10 NEO → gross 15 GAS,
    // net 14.925 GAS. Pool only 5 GAS → the preflight must reject up front and
    // keep the NEO out of the credit-held detour (pool() is a Safe ABS method).
    const { chain, invoke } = makeChain({
      neoPrice: 5n * GAS,
      neoBalance: 100n,
      pool: 5n * GAS,
    });
    const app = useSelfLoan({ app: makeApp(chain), t });
    app.setAddress(OWNER);
    await app.loadAll();

    app.selectedTier.set(2);
    app.collateralAmount.set("10");
    await expect(app.takeLoan()).rejects.toThrow(/Pool can't cover this borrow/);
    expect(invoke).not.toHaveBeenCalled();
  });
});

describe("useSelfLoan repay flow (self-loan-2)", () => {
  beforeEach(() => vi.clearAllMocks());

  const activeLoan = {
    loan: { collateral: 100n, borrowed: 20n * GAS, ltvBps: 2000n, active: true },
  } as const;

  it("deposits GAS repay credit (base units) then calls repay(borrower)", async () => {
    const { chain, invoke } = makeChain(activeLoan);
    const app = useSelfLoan({ app: makeApp(chain), t });
    app.setAddress(OWNER);
    await app.loadAll();
    expect(app.loan.get().borrowed).toBe(20);

    await app.repay("5");

    const calls = invokeCalls(invoke);
    const transfer = calls.find((c) => c.op === "transfer");
    // 5 GAS → 5e8 base units, memo "selfloan:repay", GAS script hash.
    expect(transfer?.args[2]).toMatchObject({ type: "Integer", value: (5n * GAS).toString() });
    expect(transfer?.args[3]).toMatchObject({ type: "String", value: "selfloan:repay" });
    expect((transfer?.opts as { scriptHash?: string })?.scriptHash).toBe(
      "0xd2a4cff31913016155e38e474a2c06d08be276cf",
    );
    expect(calls.some((c) => c.op === "repay")).toBe(true);
  });

  it("caps the repayment at the outstanding debt (client-side UX)", async () => {
    const { chain, invoke } = makeChain(activeLoan);
    const app = useSelfLoan({ app: makeApp(chain), t });
    app.setAddress(OWNER);
    await app.loadAll();

    // Debt is 20 GAS; repaying 25 must be rejected before any chain call.
    await expect(app.repay("25")).rejects.toThrow(/exceeds your outstanding debt/);
    expect(invoke).not.toHaveBeenCalled();
  });

  it("rejects invalid or zero GAS amounts with the localized copy and no chain call", async () => {
    // The GAS scaler is the S6 null-on-invalid variant: it never throws, so
    // the action keeps raising its own localized t("enterValidAmount") for
    // non-decimal input, more than 8 decimals, and a zero amount.
    const { chain, invoke } = makeChain(activeLoan);
    const app = useSelfLoan({ app: makeApp(chain), t });
    app.setAddress(OWNER);
    await app.loadAll();

    for (const bad of ["abc", "1.123456789", "0", "0.0", "-1", "1e2"]) {
      await expect(app.repay(bad)).rejects.toThrow(t("enterValidAmount"));
    }
    expect(invoke).not.toHaveBeenCalled();
  });

  it("rejects repaying when there is no active loan", async () => {
    const { chain, invoke } = makeChain({ loan: null });
    const app = useSelfLoan({ app: makeApp(chain), t });
    app.setAddress(OWNER);
    await app.loadAll();

    await expect(app.repay("5")).rejects.toThrow(t("repayNoActiveLoan"));
    expect(invoke).not.toHaveBeenCalled();
  });

  it("surfaces a held-credit error when the GAS deposit lands but repay reverts", async () => {
    const { chain, invoke } = makeChain(activeLoan);
    const app = useSelfLoan({ app: makeApp(chain), t });
    app.setAddress(OWNER);
    await app.loadAll();

    invoke
      .mockResolvedValueOnce({ txid: "0xdep", success: true })
      .mockRejectedValueOnce(new Error("no repay credit"));

    await expect(app.repay("5")).rejects.toThrow(t("repayCreditHeld"));
  });
});

describe("useSelfLoan addCollateral (self-loan-add)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deposits NEO (integer) then calls addCollateral(borrower)", async () => {
    const { chain, invoke } = makeChain({
      neoBalance: 100n,
      loan: { collateral: 50n, borrowed: 5n * GAS, ltvBps: 2000n, active: true },
    });
    const app = useSelfLoan({ app: makeApp(chain), t });
    app.setAddress(OWNER);
    await app.loadAll();

    await app.addCollateral("7");

    const calls = invokeCalls(invoke);
    const transfer = calls.find((c) => c.op === "transfer");
    expect(transfer?.args[2]).toMatchObject({ type: "Integer", value: "7" }); // integer, not scaled
    expect(transfer?.args[3]).toMatchObject({ type: "String", value: "selfloan:collateral" });
    expect(calls.some((c) => c.op === "addCollateral")).toBe(true);
  });

  it("rejects fractional NEO before any chain call", async () => {
    const { chain, invoke } = makeChain({
      neoBalance: 100n,
      loan: { collateral: 50n, borrowed: 5n * GAS, ltvBps: 2000n, active: true },
    });
    const app = useSelfLoan({ app: makeApp(chain), t });
    app.setAddress(OWNER);
    await app.loadAll();

    await expect(app.addCollateral("2.5")).rejects.toThrow(t("neoMustBeInteger"));
    expect(invoke).not.toHaveBeenCalled();
  });

  it("tops up only the SHORTFALL when residual credit partially covers the added amount", async () => {
    // 3 NEO residual credit + typed 7 → transfer just 4; addCollateral moves
    // 3+4=7 into the loan, exactly what the user typed.
    const { chain, invoke } = makeChain({
      neoBalance: 100n,
      collateralCredit: 3n,
      loan: { collateral: 50n, borrowed: 5n * GAS, ltvBps: 2000n, active: true },
    });
    const app = useSelfLoan({ app: makeApp(chain), t });
    app.setAddress(OWNER);
    await app.loadAll();

    await app.addCollateral("7");

    const calls = invokeCalls(invoke);
    const transfer = calls.find((c) => c.op === "transfer");
    expect(transfer?.args[2]).toMatchObject({ type: "Integer", value: "4" });
    expect(calls.some((c) => c.op === "addCollateral")).toBe(true);
  });

  it("blocks adding collateral when residual credit exceeds the typed amount", async () => {
    // addCollateral moves ALL credited NEO into the loan — 9 credited vs 7
    // typed must surface the credit warning and make no chain call.
    const { chain, invoke } = makeChain({
      neoBalance: 100n,
      collateralCredit: 9n,
      loan: { collateral: 50n, borrowed: 5n * GAS, ltvBps: 2000n, active: true },
    });
    const app = useSelfLoan({ app: makeApp(chain), t });
    app.setAddress(OWNER);
    await app.loadAll();

    await expect(app.addCollateral("7")).rejects.toThrow(
      /9 NEO of existing collateral credit/,
    );
    expect(invoke).not.toHaveBeenCalled();
  });
});

describe("useSelfLoan reclaim affordances (self-loan-reclaim)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("exposes reclaimable NEO collateral credit (WHOLE NEO) and reclaims via withdraw()", async () => {
    const { chain, invoke } = makeChain({ collateralCredit: 12n });
    const app = useSelfLoan({ app: makeApp(chain), t });
    app.setAddress(OWNER);
    await app.loadAll();

    expect(app.hasCollateralCredit.get()).toBe(true);
    // Credit is WHOLE NEO (never ÷1e8).
    expect(app.collateralCredit.get()).toBe(12);

    await app.reclaimCollateral();
    expect(invokeCalls(invoke).some((c) => c.op === "withdraw")).toBe(true);
  });

  it("exposes reclaimable GAS repay credit (÷1e8) and reclaims via withdrawRepayCredit()", async () => {
    const { chain, invoke } = makeChain({ repayCredit: 3n * GAS });
    const app = useSelfLoan({ app: makeApp(chain), t });
    app.setAddress(OWNER);
    await app.loadAll();

    expect(app.hasRepayCredit.get()).toBe(true);
    // Repay credit is GAS base units → 3 GAS for display.
    expect(app.repayCredit.get()).toBe(3);

    await app.reclaimRepayCredit();
    expect(invokeCalls(invoke).some((c) => c.op === "withdrawRepayCredit")).toBe(true);
  });

  it("rejects reclaim when there is no credit", async () => {
    const { chain } = makeChain();
    const app = useSelfLoan({ app: makeApp(chain), t });
    app.setAddress(OWNER);
    await app.loadAll();

    await expect(app.reclaimCollateral()).rejects.toThrow(t("noCollateralCredit"));
    await expect(app.reclaimRepayCredit()).rejects.toThrow(t("noRepayCredit"));
  });
});

describe("useSelfLoan health/LTV value normalization (self-loan-3)", () => {
  beforeEach(() => vi.clearAllMocks());

  // collateral 100 NEO, debt 20 GAS.
  const loanOpts = {
    loan: { collateral: 100n, borrowed: 20n * GAS, ltvBps: 2000n, active: true },
  } as const;

  it("falls back to a same-unit collateral ratio when no price is configured", async () => {
    const { chain } = makeChain(loanOpts);
    const app = useSelfLoan({ app: makeApp(chain), t });
    app.setAddress(OWNER);
    await app.loadAll();

    // neoPrice unset (0) → not normalized.
    expect(app.neoPrice.get()).toBe(0);
    expect(app.isPriceNormalized.get()).toBe(false);

    // Same-unit fallback: each NEO counts as 1 unit of collateral value, so
    // collateralValue = 100, healthFactor = 100 / 20 = 5, LTV = 20%.
    expect(app.collateralValueGas.get()).toBe(100);
    expect(app.healthFactor.get()).toBe(5);
    expect(app.currentLTV.get()).toBe(20);
    expect(app.healthMetricLabel.get()).toBe(t("collateralRatio"));
  });

  it("value-normalizes collateral to GAS via neoPrice when configured", async () => {
    // neoPrice = 0.5 GAS per NEO = 0.5e8 base units. Collateral value = 100 * 0.5 = 50 GAS.
    const { chain } = makeChain({ ...loanOpts, neoPrice: GAS / 2n });
    const app = useSelfLoan({ app: makeApp(chain), t });
    app.setAddress(OWNER);
    await app.loadAll();

    expect(app.neoPrice.get()).toBe(0.5);
    expect(app.isPriceNormalized.get()).toBe(true);

    // healthFactor = 50 / 20 = 2.5; LTV = round(20 / 50 * 100) = 40%.
    expect(app.collateralValueGas.get()).toBe(50);
    expect(app.healthFactor.get()).toBe(2.5);
    expect(app.currentLTV.get()).toBe(40);
    expect(app.healthMetricLabel.get()).toBe(t("healthFactor"));
  });

  it("reports a neutral health factor when there is no debt", async () => {
    const { chain } = makeChain({ neoBalance: 100n, loan: null });
    const app = useSelfLoan({ app: makeApp(chain), t });
    app.setAddress(OWNER);
    await app.loadAll();

    expect(app.loan.get().borrowed).toBe(0);
    expect(app.healthFactor.get()).toBe(999);
    expect(app.currentLTV.get()).toBe(0);
  });
});
