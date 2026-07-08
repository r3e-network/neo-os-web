/**
 * S3 app.funds extensions spec (framework-extraction plan §2/S3).
 *
 * Covers the deposit-then-act lane (prepayAndCall), the mainnet receipt-id
 * lane (receiptPay), the identity-stable FrameworkPrepaidActionError that
 * gasbox/dev-tipping/self-loan branch on for stranded-credit recovery copy,
 * and the revertKeyOf helper for gov-merc-style revert→i18n mapping.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createMiniAppFramework,
  FrameworkPrepaidActionError,
  revertKeyOf,
} from "../index";
import type { MiniAppFrameworkContext } from "../index";
import { createObservable } from "../reactive";
import { isMiniAppError, MiniAppError } from "../utils/errors";
import { addressToScriptHash } from "../utils/neo";

const ADDRESS = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";

/** Mirror of the host chain-service DepositConfirmedActionFailedError shape. */
class HostDepositConfirmedError extends Error {
  readonly operation: string;
  readonly depositTxid: string;
  readonly actionError: unknown;
  readonly settlement?: "confirmed" | "timeout" | "unreachable";
  constructor(
    operation: string,
    depositTxid: string,
    actionError: unknown,
    settlement?: "confirmed" | "timeout" | "unreachable",
  ) {
    super(`Deposit confirmed but "${operation}" failed`);
    this.name = "DepositConfirmedActionFailedError";
    this.operation = operation;
    this.depositTxid = depositTxid;
    this.actionError = actionError;
    if (settlement) this.settlement = settlement;
  }
}

function makeFramework({
  prepay = true,
  contractAddress = null,
}: { prepay?: boolean; contractAddress?: string | null } = {}) {
  const chain: Record<string, unknown> = {
    address: createObservable<string | null>(ADDRESS),
    contractAddress: createObservable<string | null>(contractAddress),
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

  it("forwards the host settlement field ('timeout'/'unreachable' still means broadcast, credit recoverable)", async () => {
    for (const settlement of ["timeout", "unreachable"] as const) {
      const { app, chain } = makeFramework();
      (chain.prepayAndInvoke as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new HostDepositConfirmedError("commit", "0xdeposit", new Error("FAULT"), settlement),
      );
      const error = await app.funds
        .prepayAndCall({ operation: "commit", args: [], amountGas: "1", memo: "m", notify: "silent" })
        .then(() => null, (caught: unknown) => caught);

      expect(error).toBeInstanceOf(FrameworkPrepaidActionError);
      const prepaid = error as FrameworkPrepaidActionError;
      expect(prepaid.settlement).toBe(settlement);
      // The deposit is unproven, not absent — the class identity (what apps
      // branch on) is the recovery signal; depositConfirmed only reports the
      // proof level.
      expect(prepaid.depositConfirmed).toBe(false);
      expect(prepaid.txid).toBe("0xdeposit");
    }
  });

  it("defaults settlement to 'confirmed' for host shapes that predate the field", async () => {
    const { app, chain } = makeFramework();
    (chain.prepayAndInvoke as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new HostDepositConfirmedError("commit", "0xdeposit", new Error("FAULT")),
    );
    const error = await app.funds
      .prepayAndCall({ operation: "commit", args: [], amountGas: "1", memo: "m", notify: "silent" })
      .then(() => null, (caught: unknown) => caught);

    const prepaid = error as FrameworkPrepaidActionError;
    expect(prepaid).toBeInstanceOf(FrameworkPrepaidActionError);
    expect(prepaid.settlement).toBe("confirmed");
    expect(prepaid.depositConfirmed).toBe(true);
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

describe("S3 funds.prepayAndCall custom deposit lane", () => {
  const CONTRACT = "0x442162de25008ac78d4cce62ed8d8a64401b7ece";
  const NEO_TOKEN = "0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5";
  const ADDRESS_HASH = addressToScriptHash(ADDRESS);

  afterEach(() => {
    vi.useRealTimers();
  });

  function depositSpec(
    confirm?: (txid: string) => Promise<"confirmed" | "timeout" | "unreachable">,
  ) {
    return {
      operation: "createEscrow",
      args: [{ type: "Integer" as const, value: "5" }],
      amountFixed8: 5n,
      memo: "app:fund",
      deposit: { scriptHash: NEO_TOKEN, confirm: confirm ?? (async () => "confirmed" as const) },
      waitForEvent: "EscrowCreated",
      notify: "silent" as const,
    };
  }

  it("transfers on the deposit token, settles, then fires the consuming call", async () => {
    const { app, chain } = makeFramework({ contractAddress: CONTRACT });
    const order: string[] = [];
    let resolveConfirm!: (value: "confirmed") => void;
    const confirm = vi.fn(
      () => new Promise<"confirmed">((resolve) => {
        resolveConfirm = resolve;
      }),
    );
    (chain.invoke as ReturnType<typeof vi.fn>).mockImplementation(async (op: string) => {
      order.push(op);
      return { txid: op === "transfer" ? "0xdeposit" : "0xtx", success: true };
    });

    const pending = app.funds.prepayAndCall(depositSpec(confirm));
    await new Promise((resolve) => setTimeout(resolve, 0));
    // The wait polls the deposit's OWN txid; the credit-consuming call must
    // not be issued until it resolves.
    expect(confirm).toHaveBeenCalledWith("0xdeposit");
    expect(order).toEqual(["transfer"]);

    resolveConfirm("confirmed");
    await expect(pending).resolves.toMatchObject({ txid: "0xtx" });
    expect(order).toEqual(["transfer", "createEscrow"]);

    // Deposit transfer: NEP-17 [from, to, amount, memo] on the TOKEN contract,
    // with the app contract as the recipient and base units unchanged.
    expect(chain.invoke).toHaveBeenCalledWith(
      "transfer",
      [
        { type: "Hash160", value: ADDRESS_HASH },
        { type: "Hash160", value: CONTRACT },
        { type: "Integer", value: "5" },
        { type: "String", value: "app:fund" },
      ],
      { scriptHash: NEO_TOKEN },
    );
    // Consuming call: spec args + compacted invoke options (no deposit leak).
    expect(chain.invoke).toHaveBeenCalledWith(
      "createEscrow",
      [{ type: "Integer", value: "5" }],
      { waitForEvent: "EscrowCreated" },
    );
    expect(chain.prepayAndInvoke).not.toHaveBeenCalled();
  });

  it("wraps consuming-call failures in FrameworkPrepaidActionError with the deposit txid", async () => {
    const { app, chain } = makeFramework({ contractAddress: CONTRACT });
    const revert = new Error("insufficient prepaid asset");
    (chain.invoke as ReturnType<typeof vi.fn>).mockImplementation(async (op: string) => {
      if (op === "createEscrow") throw revert;
      return { txid: "0xdeposit", success: true };
    });

    const error = await app.funds
      .prepayAndCall(depositSpec())
      .then(() => null, (caught: unknown) => caught);

    expect(error).toBeInstanceOf(FrameworkPrepaidActionError);
    const prepaid = error as FrameworkPrepaidActionError;
    expect(prepaid.txid).toBe("0xdeposit");
    expect(prepaid.operation).toBe("createEscrow");
    expect(prepaid.actionError).toBe(revert);
  });

  it("passes deposit-transfer failures through unwrapped", async () => {
    const { app, chain } = makeFramework({ contractAddress: CONTRACT });
    const rejected = new Error("User rejected the request");
    (chain.invoke as ReturnType<typeof vi.fn>).mockRejectedValueOnce(rejected);
    await expect(app.funds.prepayAndCall(depositSpec())).rejects.toBe(rejected);
  });

  it("falls back to the fixed settle delay when the indexer is unreachable", async () => {
    vi.useFakeTimers();
    const { app, chain } = makeFramework({ contractAddress: CONTRACT });
    const order: string[] = [];
    (chain.invoke as ReturnType<typeof vi.fn>).mockImplementation(async (op: string) => {
      order.push(op);
      return { txid: "0xtx", success: true };
    });

    const pending = app.funds.prepayAndCall(depositSpec(async () => "unreachable" as const));
    await vi.advanceTimersByTimeAsync(0);
    expect(order).toEqual(["transfer"]);

    await vi.advanceTimersByTimeAsync(4000);
    await pending;
    expect(order).toEqual(["transfer", "createEscrow"]);
  });

  it("rejects with CONTRACT_MISSING before moving funds when no contract is configured", async () => {
    const { app, chain } = makeFramework();
    await expect(app.funds.prepayAndCall(depositSpec())).rejects.toSatisfy(
      (error: unknown) => isMiniAppError(error) && error.code === "CONTRACT_MISSING",
    );
    expect(chain.invoke).not.toHaveBeenCalled();
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
    expect((error as FrameworkPrepaidActionError).settlement).toBe("confirmed");
    expect((error as FrameworkPrepaidActionError).depositConfirmed).toBe(true);
  });

  it("forwards the host settlement field on the payAndCall lane too", async () => {
    const { app, chain } = makeFramework();
    (chain.invokeWithPayment as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new HostDepositConfirmedError("tip", "0xdep", new Error("no tip"), "timeout"),
    );
    const error = await app.funds
      .payAndCall({ operation: "tip", args: [], amountGas: "1", memo: "tip", notify: "silent" })
      .then(() => null, (caught: unknown) => caught);
    expect(error).toBeInstanceOf(FrameworkPrepaidActionError);
    expect((error as FrameworkPrepaidActionError).settlement).toBe("timeout");
    expect((error as FrameworkPrepaidActionError).depositConfirmed).toBe(false);
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
