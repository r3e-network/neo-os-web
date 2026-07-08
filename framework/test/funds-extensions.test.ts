/**
 * S3 app.funds extensions spec (framework-extraction plan §2/S3).
 *
 * Covers the deposit-then-act lane (prepayAndCall), the mainnet receipt-id
 * lane (receiptPay), the identity-stable FrameworkPrepaidActionError that
 * gasbox/dev-tipping/self-loan branch on for stranded-credit recovery copy,
 * and the revertKeyOf helper for gov-merc-style revert→i18n mapping.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createMiniAppFramework,
  FrameworkPrepaidActionError,
  revertKeyOf,
} from "../index";
import type { MiniAppFrameworkContext } from "../index";
import { createObservable } from "../reactive";
import { isMiniAppError, MiniAppError } from "../utils/errors";

const ADDRESS = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";

/** Mirror of the host chain-service DepositConfirmedActionFailedError shape. */
class HostDepositConfirmedError extends Error {
  readonly operation: string;
  readonly depositTxid: string;
  readonly actionError: unknown;
  constructor(operation: string, depositTxid: string, actionError: unknown) {
    super(`Deposit confirmed but "${operation}" failed`);
    this.name = "DepositConfirmedActionFailedError";
    this.operation = operation;
    this.depositTxid = depositTxid;
    this.actionError = actionError;
  }
}

function makeFramework({ prepay = true }: { prepay?: boolean } = {}) {
  const chain: Record<string, unknown> = {
    address: createObservable<string | null>(ADDRESS),
    ensureWallet: vi.fn(async () => ADDRESS),
    read: vi.fn(async () => "0"),
    invoke: vi.fn(async () => ({ txid: "0xinvoke", success: true })),
    invokeWithPayment: vi.fn(async () => ({ txid: "0xpay", success: true })),
    listEvents: vi.fn(async () => []),
  };
  if (prepay) {
    chain.prepayAndInvoke = vi.fn(async () => ({ txid: "0xprepaid", success: true }));
  }
  const notify = { success: vi.fn(), error: vi.fn() };
  const ctx = {
    services: { chain, notify },
    t: (key: string) => key,
  } as unknown as MiniAppFrameworkContext;
  return { app: createMiniAppFramework(ctx, { appId: "funds-app" }), chain, notify };
}

beforeEach(() => {
  localStorage.clear();
});

describe("S3 funds.prepayAndCall", () => {
  it("delegates to the host prepay lane with the fixed8 amount and reloads", async () => {
    const { app, chain } = makeFramework();
    const reload = vi.fn(async () => {});
    await expect(
      app.funds.prepayAndCall({
        operation: "commit",
        args: [{ type: "Integer", value: "1" }],
        amountGas: "1.5",
        memo: "gasbox:commit",
        scriptHash: "0xbox",
        reload,
      }),
    ).resolves.toMatchObject({ txid: "0xprepaid" });
    expect(chain.prepayAndInvoke).toHaveBeenCalledWith(
      "150000000",
      "gasbox:commit",
      "commit",
      [{ type: "Integer", value: "1" }],
      { scriptHash: "0xbox" },
    );
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("wraps host deposit-confirmed failures into FrameworkPrepaidActionError", async () => {
    const { app, chain } = makeFramework();
    const revert = new Error("FAULT: bidding closed");
    (chain.prepayAndInvoke as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new HostDepositConfirmedError("commit", "0xdeposit", revert),
    );
    const error = await app.funds
      .prepayAndCall({ operation: "commit", args: [], amountGas: "1", memo: "m", notify: "silent" })
      .then(() => null, (caught: unknown) => caught);

    expect(error).toBeInstanceOf(FrameworkPrepaidActionError);
    const prepaid = error as FrameworkPrepaidActionError;
    // Identity-stable + part of the MiniAppError hierarchy.
    expect(isMiniAppError(prepaid)).toBe(true);
    expect(prepaid instanceof MiniAppError).toBe(true);
    expect(prepaid.depositConfirmed).toBe(true);
    expect(prepaid.txid).toBe("0xdeposit");
    expect(prepaid.operation).toBe("commit");
    expect(prepaid.actionError).toBe(revert);
    // The message embeds the consuming revert so revertKeyOf still maps it.
    expect(revertKeyOf(prepaid, { biddingClosed: "bidding closed" })).toBe("biddingClosed");
  });

  it("passes non-deposit failures through unwrapped", async () => {
    const { app, chain } = makeFramework();
    const rejected = new Error("User rejected the request");
    (chain.prepayAndInvoke as ReturnType<typeof vi.fn>).mockRejectedValueOnce(rejected);
    await expect(
      app.funds.prepayAndCall({ operation: "commit", args: [], amountGas: "1", memo: "m", notify: "silent" }),
    ).rejects.toBe(rejected);
  });

  it("falls back to the atomic invokeWithPayment bundle when the host lacks a prepay lane", async () => {
    const { app, chain } = makeFramework({ prepay: false });
    await expect(
      app.funds.prepayAndCall({ operation: "commit", args: [], amountGas: "2", memo: "m" }),
    ).resolves.toMatchObject({ txid: "0xpay" });
    expect(chain.invokeWithPayment).toHaveBeenCalledWith("200000000", "m", "commit", [], {});
  });

  it("uses the atomic bundle when waitForCredit is explicitly false", async () => {
    const { app, chain } = makeFramework();
    await app.funds.prepayAndCall({
      operation: "commit",
      args: [],
      amountGas: "1",
      memo: "m",
      waitForCredit: false,
    });
    expect(chain.prepayAndInvoke).not.toHaveBeenCalled();
    expect(chain.invokeWithPayment).toHaveBeenCalledTimes(1);
  });
});

describe("S3 funds.payAndCall prepaid-error translation", () => {
  it("rethrows host deposit-confirmed failures as FrameworkPrepaidActionError", async () => {
    const { app, chain } = makeFramework();
    (chain.invokeWithPayment as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new HostDepositConfirmedError("tip", "0xdep", new Error("no tip")),
    );
    const error = await app.funds
      .payAndCall({ operation: "tip", args: [], amountGas: "1", memo: "tip", notify: "silent" })
      .then(() => null, (caught: unknown) => caught);
    expect(error).toBeInstanceOf(FrameworkPrepaidActionError);
    expect((error as FrameworkPrepaidActionError).txid).toBe("0xdep");
  });
});

describe("S3 funds.receiptPay", () => {
  it("appends the receipt id as the trailing Integer argument", async () => {
    const { app, chain } = makeFramework();
    const reload = vi.fn(async () => {});
    await expect(
      app.funds.receiptPay({
        operation: "deposit",
        args: [
          { type: "Hash160", value: ADDRESS },
          { type: "Integer", value: "100000000" },
        ],
        receiptId: " 42 ",
        waitForEvent: "LiquidityDeposited",
        reload,
      }),
    ).resolves.toMatchObject({ txid: "0xinvoke" });
    expect(chain.invoke).toHaveBeenCalledWith(
      "deposit",
      [
        { type: "Hash160", value: ADDRESS },
        { type: "Integer", value: "100000000" },
        { type: "Integer", value: "42" },
      ],
      { waitForEvent: "LiquidityDeposited" },
    );
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("rejects non-positive-integer receipt ids before touching the chain", async () => {
    const { app, chain } = makeFramework();
    for (const receiptId of ["", "abc", "0", "-3", "1.5", "0x10"]) {
      await expect(
        app.funds.receiptPay({ operation: "deposit", args: [], receiptId, notify: "silent" }),
      ).rejects.toSatisfy(
        (error: unknown) => isMiniAppError(error) && error.code === "RECEIPT_ID_INVALID",
      );
    }
    expect(chain.invoke).not.toHaveBeenCalled();
  });
});

describe("S3 revertKeyOf", () => {
  it("maps reverts onto i18n keys via string and RegExp patterns", () => {
    const map = {
      biddingClosed: "bidding closed",
      epochNotEnded: /epoch not ended/i,
    } as const;
    expect(revertKeyOf(new Error("FAULT: Bidding Closed"), map)).toBe("biddingClosed");
    expect(revertKeyOf(new Error("assert: epoch not ended"), map)).toBe("epochNotEnded");
    expect(revertKeyOf("epoch NOT ended", { epochNotEnded: /epoch not ended/i })).toBe(
      "epochNotEnded",
    );
    expect(revertKeyOf(new Error("something else"), map)).toBeNull();
  });

  it("supports pattern lists and non-error inputs", () => {
    const map = { held: ["credit held", /deposit.*settled/i] };
    expect(revertKeyOf(new Error("prepaid CREDIT HELD on contract"), map)).toBe("held");
    expect(revertKeyOf(new Error("deposit already settled"), map)).toBe("held");
    expect(revertKeyOf(42, map)).toBeNull();
    expect(revertKeyOf(null, map)).toBeNull();
    expect(revertKeyOf("", map)).toBeNull();
  });
});
