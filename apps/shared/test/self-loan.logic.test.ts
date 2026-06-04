import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PaymentProxy } from "../services/os/PaymentProxy";
import type { EscrowProxy } from "../services/os/EscrowProxy";
import type { StorageProxy } from "../services/os/StorageProxy";
import type { BadgeProxy } from "../services/os/BadgeProxy";

const OWNER = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";

const walletMock = { address: { value: OWNER } };
vi.mock("../utils/wallet-sdk", () => ({ useWallet: () => walletMock }));

// Imported after the wallet mock is registered.
import { useSelfLoan } from "../../self-loan/src/composables/useSelfLoan";

function t(key: string) {
  const messages: Record<string, string> = {
    enterValidAmount: "Enter a valid amount",
    neoMustBeInteger: "NEO must be a whole number",
    insufficientNeo: "Insufficient NEO balance",
    collateralRefunded: "Loan setup failed — your NEO collateral was refunded",
    collateralRecoveryNeeded:
      "Loan setup failed and the automatic refund did not complete.",
    notAvailable: "N/A",
    yes: "Yes",
    no: "No",
  };
  return messages[key] ?? key;
}

type ListPayload = Record<string, unknown>;

function setup(opts: {
  balance?: string;
  list?: ListPayload;
  escrowGet?: unknown;
} = {}) {
  const payment = {
    getBalance: vi.fn(async () => opts.balance ?? "100"),
    deposit: vi.fn(async () => ({ invocation: { txid: "0xdeposit" } })),
    withdraw: vi.fn(async () => undefined),
  } as unknown as PaymentProxy & {
    getBalance: ReturnType<typeof vi.fn>;
    deposit: ReturnType<typeof vi.fn>;
    withdraw: ReturnType<typeof vi.fn>;
  };

  const escrow = {
    create: vi.fn(async () => "esc-1"),
    refund: vi.fn(async () => undefined),
    get: vi.fn(async () => opts.escrowGet ?? null),
  } as unknown as EscrowProxy & {
    create: ReturnType<typeof vi.fn>;
    refund: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
  };

  const storage = {
    get: vi.fn(async () => null),
    list: vi.fn(async () => opts.list ?? {}),
  } as unknown as StorageProxy & {
    get: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
  };

  const badge = {
    award: vi.fn(async () => undefined),
  } as unknown as BadgeProxy & { award: ReturnType<typeof vi.fn> };

  const app = useSelfLoan({
    paymentService: payment,
    escrowService: escrow,
    storageService: storage,
    badgeService: badge,
    t,
  });

  return { app, payment, escrow, storage, badge };
}

// An active loan record as returned by storage.list("loan:"), keyed arbitrarily.
function activeLoanList() {
  return {
    "loan:1": {
      id: 1,
      netBorrow: 20,
      repaid: 0,
      active: true,
      collateral: 100,
      createdTime: 1_700_000_000,
    },
  } as ListPayload;
}

describe("useSelfLoan takeLoan rollback (self-loan-1)", () => {
  beforeEach(() => {
    walletMock.address.value = OWNER;
  });

  it("refunds deposited collateral when escrow.create fails", async () => {
    const { app, payment, escrow } = setup({ balance: "100" });
    await app.loadAll();

    app.collateralAmount.set("10");
    app.selectedTier.set(1);

    escrow.create.mockRejectedValueOnce(new Error("edge failure"));

    await expect(app.takeLoan()).rejects.toThrow(t("collateralRefunded"));

    // Deposit happened, escrow failed, so the deposit must be compensated.
    expect(payment.deposit).toHaveBeenCalledTimes(1);
    expect(escrow.create).toHaveBeenCalledTimes(1);
    expect(payment.withdraw).toHaveBeenCalledTimes(1);
    expect(payment.withdraw).toHaveBeenCalledWith("10");
  });

  it("surfaces a manual-recovery error when the refund itself fails", async () => {
    const { app, payment, escrow } = setup({ balance: "100" });
    await app.loadAll();

    app.collateralAmount.set("5");
    escrow.create.mockRejectedValueOnce(new Error("edge failure"));
    payment.withdraw.mockRejectedValueOnce(new Error("withdraw failed"));

    await expect(app.takeLoan()).rejects.toThrow(t("collateralRecoveryNeeded"));
    expect(payment.withdraw).toHaveBeenCalledTimes(1);
  });

  it("does not withdraw when escrow.create succeeds", async () => {
    const { app, payment, escrow } = setup({ balance: "100" });
    await app.loadAll();

    app.collateralAmount.set("10");
    await app.takeLoan();

    expect(escrow.create).toHaveBeenCalledTimes(1);
    expect(payment.withdraw).not.toHaveBeenCalled();
  });
});

describe("useSelfLoan repay collateral release (self-loan-2)", () => {
  beforeEach(() => {
    walletMock.address.value = OWNER;
  });

  it("releases collateral via escrow.refund once the loan is fully repaid", async () => {
    // Start with an active loan (debt 20), then after repay the escrow.get
    // reports zero debt so the position reloads as fully repaid.
    const { app, escrow } = setup({
      balance: "0",
      list: activeLoanList(),
      escrowGet: { id: 1, collateral: 100, debt: 20, active: true, ltvBps: 2000 },
    });

    await app.loadAll();
    expect(app.loan.get().borrowed).toBe(20);
    expect(app.loan.get().id).toBe(1);

    // After repayment the loan position reports no outstanding debt.
    escrow.get.mockResolvedValue({
      id: 1,
      collateral: 100,
      debt: 0,
      active: false,
      ltvBps: 2000,
    });
    // Storage list now shows the loan as inactive/repaid.
    app.loanHistory.get();

    await app.repay("20");

    expect(escrow.refund).toHaveBeenCalledTimes(1);
    expect(escrow.refund).toHaveBeenCalledWith("1");
  });

  it("does not release collateral on a partial repayment", async () => {
    const { app, escrow } = setup({
      balance: "0",
      list: activeLoanList(),
      escrowGet: { id: 1, collateral: 100, debt: 20, active: true, ltvBps: 2000 },
    });

    await app.loadAll();
    expect(app.loan.get().borrowed).toBe(20);

    // Still has outstanding debt after a partial repayment.
    escrow.get.mockResolvedValue({
      id: 1,
      collateral: 100,
      debt: 5,
      active: true,
      ltvBps: 2000,
    });

    await app.repay("15");

    expect(escrow.refund).not.toHaveBeenCalled();
  });
});
