/**
 * S7 app.chain extensions spec (framework-extraction plan §2/S7).
 *
 * Covers arg.publicKey / arg.hash160Raw (deployed-ABI passthrough — NO
 * conversion), signMessage result-shape normalization, invokeMultiple with
 * FAULT-state sanitization, waitForState's verbatim 4-attempt/4s-then-5s poll
 * (fake timers), count-then-page enumerate, and the contractReady observable.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMiniAppFramework } from "../index";
import type { FrameworkContractArg, MiniAppFrameworkContext } from "../index";
import { createObservable } from "../reactive";
import { isMiniAppError } from "../utils/errors";
import { addressToScriptHash } from "../utils/neo";

const ADDRESS = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";
const PUBKEY = "02b3622bf4017bdfe317c58aed5f4c753f206b7db896046fa7d774bbc4bf7f8dc2";

function makeFramework(chainOverrides: Record<string, unknown> = {}) {
  const chain = {
    address: createObservable<string | null>(ADDRESS),
    ensureWallet: vi.fn(async () => ADDRESS),
    read: vi.fn(async () => "0"),
    invoke: vi.fn(async () => ({ txid: "0xinvoke", success: true })),
    invokeWithPayment: vi.fn(async () => ({ txid: "0xpay", success: true })),
    listEvents: vi.fn(async () => []),
    ...chainOverrides,
  };
  const notify = { success: vi.fn(), error: vi.fn() };
  const ctx = {
    services: { chain, notify },
    t: (key: string) => key,
  } as unknown as MiniAppFrameworkContext;
  return { app: createMiniAppFramework(ctx, { appId: "chain-ext-app" }), chain, notify };
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("S7 arg.publicKey", () => {
  it("accepts a 33-byte compressed key, stripping any 0x prefix", () => {
    const { app } = makeFramework();
    expect(app.chain.arg.publicKey(PUBKEY)).toEqual({ type: "PublicKey", value: PUBKEY });
    expect(app.chain.arg.publicKey(`0x${PUBKEY}`)).toEqual({ type: "PublicKey", value: PUBKEY });
    expect(app.chain.arg.publicKey(`  ${PUBKEY}  `)).toEqual({ type: "PublicKey", value: PUBKEY });
  });

  it("rejects malformed keys", () => {
    const { app } = makeFramework();
    for (const bad of ["", "abc", PUBKEY.slice(0, 64), `04${PUBKEY.slice(2)}`, `${PUBKEY}ff`]) {
      expect(() => app.chain.arg.publicKey(bad)).toThrow(/PublicKey/);
    }
  });
});

describe("S7 arg.hash160Raw (deployed-ABI passthrough)", () => {
  it("passes a raw base58 address literal through UNCONVERTED", () => {
    const { app } = makeFramework();
    const raw = app.chain.arg.hash160Raw(ADDRESS);
    expect(raw).toEqual({ type: "Hash160", value: ADDRESS });
    // arg.hash160 would have converted the address — the raw lane must not.
    expect(app.chain.arg.hash160(ADDRESS).value).toBe(addressToScriptHash(ADDRESS));
    expect(raw.value).not.toBe(addressToScriptHash(ADDRESS));
  });

  it("does not normalize hex, casing, or whitespace", () => {
    const { app } = makeFramework();
    expect(app.chain.arg.hash160Raw("ABCDEF").value).toBe("ABCDEF");
    expect(app.chain.arg.hash160Raw(" padded ").value).toBe(" padded ");
    expect(app.chain.arg.hash160Raw("").value).toBe("");
  });
});

describe("S7 chain.signMessage normalization", () => {
  it("wraps bare signature strings", async () => {
    const { app } = makeFramework({ signMessage: vi.fn(async () => "deadbeef") });
    await expect(app.chain.signMessage("hello")).resolves.toEqual({ signature: "deadbeef" });
  });

  it("normalizes { signature, publicKey } records", async () => {
    const signMessage = vi.fn(async () => ({ signature: "sig", publicKey: "pk", salt: "s" }));
    const { app } = makeFramework({ signMessage });
    await expect(app.chain.signMessage("hello")).resolves.toEqual({
      signature: "sig",
      publicKey: "pk",
    });
    expect(signMessage).toHaveBeenCalledWith("hello");
  });

  it("falls back to the data field and keeps it exposed", async () => {
    const { app } = makeFramework({
      signMessage: vi.fn(async () => ({
        data: "datasig",
        pubkey: "pk2",
        account: ADDRESS,
      })),
    });
    await expect(app.chain.signMessage("hello")).resolves.toEqual({
      signature: "datasig",
      publicKey: "pk2",
      data: "datasig",
      account: ADDRESS,
    });
  });

  it("throws typed errors when unsupported or empty", async () => {
    const { app } = makeFramework(); // no signMessage on the host
    await expect(app.chain.signMessage("hello")).rejects.toSatisfy(
      (error: unknown) => isMiniAppError(error) && error.code === "SIGN_UNSUPPORTED",
    );

    const nullHost = makeFramework({ signMessage: vi.fn(async () => null) });
    await expect(nullHost.app.chain.signMessage("")).rejects.toSatisfy(
      (error: unknown) => isMiniAppError(error) && error.code === "SIGN_EMPTY_RESULT",
    );
  });
});

describe("S7 chain.invokeMultiple", () => {
  const calls = [
    { scriptHash: "0xgas", operation: "transfer", args: [] as FrameworkContractArg[] },
    { scriptHash: "0xmarket", operation: "settleListing", args: [] as FrameworkContractArg[] },
  ];

  it("forwards calls, custom signers, and tx persistence to the host", async () => {
    const invokeMultiple = vi.fn(async () => ({ txid: "0xmulti", success: true }));
    const { app } = makeFramework({ invokeMultiple });
    const signers = [{ account: ADDRESS, scopes: 16, allowedContracts: ["0xgas", "0xmarket"] }];
    const onTransactionSent = vi.fn();
    await expect(app.chain.invokeMultiple(calls, { signers, onTransactionSent })).resolves.toMatchObject({
      txid: "0xmulti",
    });
    expect(invokeMultiple).toHaveBeenCalledWith(calls, { signers, onTransactionSent });
  });

  it("sanitizes FAULT-state exceptions: short asserts pass, dumps are replaced", async () => {
    const short = makeFramework({
      invokeMultiple: vi.fn(async () => ({ txid: "0x1", state: "FAULT", exception: "listing not active" })),
    });
    await expect(
      short.app.chain.invokeMultiple(calls, { notify: "silent" }),
    ).rejects.toThrow("listing not active");

    const long = makeFramework({
      invokeMultiple: vi.fn(async () => ({ txid: "0x1", state: "FAULT", exception: "x".repeat(120) })),
    });
    await expect(
      long.app.chain.invokeMultiple(calls, { notify: "silent" }),
    ).rejects.toThrow("Contract operation failed");

    const nonString = makeFramework({
      invokeMultiple: vi.fn(async () => ({ txid: "0x1", state: "FAULT", exception: undefined })),
    });
    await expect(
      nonString.app.chain.invokeMultiple(calls, { notify: "silent" }),
    ).rejects.toThrow("Contract operation failed");
  });

  it("passes HALT results through and reports missing host capability", async () => {
    const halt = makeFramework({
      invokeMultiple: vi.fn(async () => ({ txid: "0x2", state: "HALT" })),
    });
    await expect(halt.app.chain.invokeMultiple(calls)).resolves.toMatchObject({ txid: "0x2" });

    const { app } = makeFramework(); // host without invokeMultiple
    await expect(app.chain.invokeMultiple(calls, { notify: "silent" })).rejects.toSatisfy(
      (error: unknown) => isMiniAppError(error) && error.code === "INVOKE_MULTIPLE_UNSUPPORTED",
    );
  });
});

describe("S7 chain.waitForState (verbatim 4-attempt / 4s-then-5s poll)", () => {
  it("delays 4s BEFORE the first read and resolves with the matching value", async () => {
    vi.useFakeTimers();
    const { app } = makeFramework();
    const read = vi.fn(async () => "verifier");
    const pending = app.chain.waitForState(read, (value) => value === "verifier");

    // Nothing happens before the first 4s delay elapses.
    await vi.advanceTimersByTimeAsync(3999);
    expect(read).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await expect(pending).resolves.toBe("verifier");
    expect(read).toHaveBeenCalledTimes(1);
  });

  it("swallows read errors and retries at 5s spacing", async () => {
    vi.useFakeTimers();
    const { app } = makeFramework();
    const read = vi.fn()
      .mockRejectedValueOnce(new Error("rpc lag"))
      .mockResolvedValueOnce("0x" + "0".repeat(40))
      .mockResolvedValueOnce("0xready");
    const pending = app.chain.waitForState(read, (value) => value === "0xready");

    await vi.advanceTimersByTimeAsync(4000); // attempt 1: throws — swallowed
    expect(read).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(4999);
    expect(read).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1); // attempt 2 at +5s: no match yet
    expect(read).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(5000); // attempt 3: match
    await expect(pending).resolves.toBe("0xready");
    expect(read).toHaveBeenCalledTimes(3);
  });

  it("exhausts exactly 4 attempts (4s + 3×5s) and resolves null", async () => {
    vi.useFakeTimers();
    const { app } = makeFramework();
    const read = vi.fn(async () => "never");
    const pending = app.chain.waitForState(read, () => false);

    await vi.advanceTimersByTimeAsync(4000 + 5000 * 3);
    await expect(pending).resolves.toBeNull();
    expect(read).toHaveBeenCalledTimes(4);

    // No fifth attempt no matter how long we wait.
    await vi.advanceTimersByTimeAsync(60_000);
    expect(read).toHaveBeenCalledTimes(4);
  });

  it("honors custom attempts/delay options", async () => {
    vi.useFakeTimers();
    const { app } = makeFramework();
    const read = vi.fn(async () => 0);
    const pending = app.chain.waitForState(read, () => false, {
      attempts: 2,
      firstDelayMs: 100,
      delayMs: 200,
    });
    await vi.advanceTimersByTimeAsync(300);
    await expect(pending).resolves.toBeNull();
    expect(read).toHaveBeenCalledTimes(2);
  });
});

describe("S7 chain.enumerate (count-then-page fan-out)", () => {
  function detailChain(count: number, failIds: number[] = []) {
    return {
      read: vi.fn(async (operation: string, args?: FrameworkContractArg[]) => {
        if (operation === "getCount") return String(count);
        const id = Number(args?.[0]?.value);
        if (failIds.includes(id)) throw new Error(`read failed for ${id}`);
        return { id, title: `item-${id}` };
      }),
    };
  }

  it("caps to the newest ids, swallows per-id failures, sorts newest first", async () => {
    const { app, chain } = makeFramework(detailChain(7, [5]));
    const items = await app.chain.enumerate({
      countOp: "getCount",
      detailOp: "getListing",
      cap: 5,
      decode: (raw) => raw as { id: number; title: string },
    });
    // count=7 cap=5 → ids 3..7; id 5 read fails and is skipped; newest first.
    expect(items.map((item) => item.id)).toEqual([7, 6, 4, 3]);
    expect(chain.read).toHaveBeenCalledWith("getCount", undefined, { scriptHash: undefined });
    expect(chain.read).toHaveBeenCalledWith(
      "getListing",
      [{ type: "Integer", value: "3" }],
      { scriptHash: undefined },
    );
  });

  it("skips rows the decoder rejects (null) or throws on", async () => {
    const { app } = makeFramework(detailChain(4));
    const items = await app.chain.enumerate({
      countOp: "getCount",
      detailOp: "getListing",
      decode: (raw) => {
        const row = raw as { id: number };
        if (row.id === 2) return null;
        if (row.id === 3) throw new Error("corrupt row");
        return row;
      },
    });
    expect(items.map((item) => item.id)).toEqual([4, 1]);
  });

  it("supports explicit id lists and oldest-first ordering", async () => {
    const { app } = makeFramework(detailChain(0));
    const items = await app.chain.enumerate({
      ids: [9, 2, 5],
      detailOp: "getListing",
      order: "oldest",
      decode: (raw) => raw as { id: number },
    });
    expect(items.map((item) => item.id)).toEqual([2, 5, 9]);
  });

  it("returns empty for zero/invalid counts without detail reads", async () => {
    const zero = makeFramework(detailChain(0));
    await expect(
      zero.app.chain.enumerate({ countOp: "getCount", detailOp: "getListing", decode: (raw) => raw }),
    ).resolves.toEqual([]);
    expect(zero.chain.read).toHaveBeenCalledTimes(1);

    const bogus = makeFramework({ read: vi.fn(async () => "not-a-number") });
    await expect(
      bogus.app.chain.enumerate({ countOp: "getCount", detailOp: "getListing", decode: (raw) => raw }),
    ).resolves.toEqual([]);
  });
});

describe("S7 chain.contractReady", () => {
  it("derives readiness from the contract-address observable", () => {
    const contractAddress = createObservable<string | null>(null);
    const { app } = makeFramework({ contractAddress });
    expect(app.chain.contractReady.get()).toBe(false);

    const listener = vi.fn();
    const unsubscribe = app.chain.contractReady.subscribe(listener);
    contractAddress.set("0xdeployed");
    expect(app.chain.contractReady.get()).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);

    // Derived observable: set() is a no-op, unsubscribe releases the source.
    app.chain.contractReady.set(false);
    expect(app.chain.contractReady.get()).toBe(true);
    unsubscribe();
    contractAddress.set(null);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(app.chain.contractReady.get()).toBe(false);
  });

  it("stays false on hosts without a contract-address accessor", () => {
    const { app } = makeFramework();
    expect(app.chain.contractReady.get()).toBe(false);
  });
});
