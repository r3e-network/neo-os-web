/**
 * chain.query (RFC P0-6) — the chainable typed read lane.
 *
 * Locks the coercion contract (value-safe lanes never throw on malformed
 * values; fallback applies to read errors too), the one-read-per-result
 * caching, the Hash160→address decode, and the framework wiring (read lane —
 * NOT guest-guarded).
 */
import { describe, expect, it, vi } from "vitest";
import { createQueryResult } from "../chain-query";
import { createMiniAppFramework } from "../index";
import type { MiniAppFrameworkContext } from "../index";
import { createObservable } from "../reactive";
import { addressToScriptHash, scriptHashToAddress } from "../utils/neo";

const ADDRESS = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";
// Real-node fixture from utils/neo: base64 ByteString → display hash → address.
const HASH160_BASE64 = "ODf0EwY4dOXBDMmxnUaR3fZWBm0=";
const HASH160_DISPLAY = "0x6d0656f6dd91469db1c90cc1e574380613f43738";
const HASH160_ADDRESS = "NR3E4D8NUXh3zhbf5ZkAp3rTxWbQqNih32";

function makeApp(readImpl: (operation: string) => Promise<unknown>) {
  const read = vi.fn(async (operation: string) => readImpl(operation));
  const ctx = {
    services: {
      chain: {
        address: createObservable<string | null>(ADDRESS),
        ensureWallet: vi.fn(async () => ADDRESS),
        read,
        invoke: vi.fn(async () => ({ txid: "0x1" })),
        invokeWithPayment: vi.fn(async () => ({ txid: "0x2" })),
      },
    },
    t: (key: string) => key,
  } as unknown as MiniAppFrameworkContext;
  return { app: createMiniAppFramework(ctx, { appId: "query-test" }), read };
}

describe("createQueryResult coercers", () => {
  it("asInt/asBigInt decode integers; null reads as zero; garbage hits the fallback", async () => {
    expect(await createQueryResult(async () => "42").asInt()).toBe(42);
    expect(await createQueryResult(async () => 7).asInt()).toBe(7);
    expect(await createQueryResult(async () => null).asInt()).toBe(0);
    expect(await createQueryResult(async () => "not-a-number").asInt()).toBe(0);
    expect(await createQueryResult(async () => "not-a-number").asInt(99)).toBe(99);
    expect(await createQueryResult(async () => "250000000").asBigInt()).toBe(250_000_000n);
    expect(await createQueryResult(async () => "garbage").asBigInt(5n)).toBe(5n);
    expect(await createQueryResult(async () => null).asBigInt()).toBe(0n);
  });

  it("asString/asBool decode with fleet-parity semantics", async () => {
    expect(await createQueryResult(async () => "hello").asString()).toBe("hello");
    expect(await createQueryResult(async () => null).asString()).toBe("");
    expect(await createQueryResult(async () => null).asString("dash")).toBe("dash");
    expect(await createQueryResult(async () => "true").asBool()).toBe(true);
    expect(await createQueryResult(async () => 1).asBool()).toBe(true);
    expect(await createQueryResult(async () => "false").asBool()).toBe(false);
    expect(await createQueryResult(async () => null).asBool(true)).toBe(true);
  });

  it("asAddress decodes Hash160 stack items and passes real addresses through", async () => {
    const stackItem = { type: "ByteString", value: HASH160_BASE64 };
    expect(await createQueryResult(async () => stackItem).asAddress()).toBe(HASH160_ADDRESS);
    expect(await createQueryResult(async () => ADDRESS).asAddress()).toBe(ADDRESS);
    expect(await createQueryResult(async () => "junk").asAddress()).toBe("");
    expect(await createQueryResult(async () => "junk").asAddress("n/a")).toBe("n/a");
  });

  it("scriptHashToAddress is the exact inverse of addressToScriptHash", () => {
    expect(scriptHashToAddress(addressToScriptHash(ADDRESS))).toBe(ADDRESS);
    expect(scriptHashToAddress(HASH160_DISPLAY)).toBe(HASH160_ADDRESS);
    expect(scriptHashToAddress("")).toBe("");
    expect(scriptHashToAddress("0x1234")).toBe("");
  });

  it("asArray returns arrays verbatim and [] for non-arrays", async () => {
    expect(await createQueryResult(async () => [1, 2]).asArray()).toEqual([1, 2]);
    expect(await createQueryResult(async () => "scalar").asArray()).toEqual([]);
  });

  it("asMap decodes Map and object reads; missing fields hit the coercer with undefined", async () => {
    const shape = {
      free: (raw: unknown) => Number(raw ?? -1),
      label: (raw: unknown) => String(raw ?? "missing"),
    };
    const fromMap = await createQueryResult(
      async () => new Map<string, unknown>([["free", "5"]]),
    ).asMap<{ free: number; label: string }>(shape);
    expect(fromMap).toEqual({ free: 5, label: "missing" });
    const fromObject = await createQueryResult(async () => ({ free: 7, label: "pool" })).asMap<{
      free: number;
      label: string;
    }>(shape);
    expect(fromObject).toEqual({ free: 7, label: "pool" });
  });

  it("as(parse) runs the custom parser; raw() is the escape hatch", async () => {
    const result = createQueryResult(async () => "0x2a");
    expect(await result.as((raw) => Number(raw))).toBe(42);
    expect(await result.raw()).toBe("0x2a");
  });

  it("reads once per result object across chained accessors", async () => {
    const read = vi.fn(async () => "42");
    const result = createQueryResult(read);
    expect(await result.asInt()).toBe(42);
    expect(await result.asBigInt()).toBe(42n);
    expect(await result.asString()).toBe("42");
    expect(read).toHaveBeenCalledTimes(1);
  });

  it("read errors: value-safe lanes return the fallback; without one they rethrow", async () => {
    const failing = () => createQueryResult(async () => Promise.reject(new Error("rpc down")));
    expect(await failing().asInt(3)).toBe(3);
    expect(await failing().asString("x")).toBe("x");
    await expect(failing().asInt()).rejects.toThrow(/rpc down/);
    await expect(failing().asArray()).rejects.toThrow(/rpc down/);
    await expect(failing().raw()).rejects.toThrow(/rpc down/);
  });
});

describe("app.chain.query wiring", () => {
  it("delegates to the host chain.read with operation/args/options", async () => {
    const { app, read } = makeApp(async (operation) =>
      operation === "totalGames" ? "12" : "0",
    );
    const total = await app.chain
      .query("totalGames", [app.chain.arg.integer(1)], { cache: true })
      .asInt();
    expect(total).toBe(12);
    expect(read).toHaveBeenCalledWith(
      "totalGames",
      [{ type: "Integer", value: "1" }],
      { cache: true },
    );
  });

  it("stays a READ lane: works in guest mode (no guard, no permission gate)", async () => {
    const { app } = makeApp(async () => "5");
    app.mode.set("guest");
    expect(await app.chain.query("freePool").asInt()).toBe(5);
  });
});
