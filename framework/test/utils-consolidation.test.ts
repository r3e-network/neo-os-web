/**
 * S0 utils-consolidation spec (framework-extraction plan §2/S0).
 *
 * Verifies that framework/utils now holds the single canonical copy of the
 * formerly-forked helpers, that apps/shared re-exports preserve function AND
 * class identity (instanceof compatibility), that the two amount error-
 * semantics variants stay distinct, and that framework storage keys keep the
 * `neo:<appId>:` prefix byte-for-byte (user-data migration hazard).
 *
 * NOTE: the apps/shared imports below are intentional and allowed here —
 * the boundary test only forbids shared imports from framework *sources*
 * (framework/test is excluded); these assertions exist precisely to prove
 * the shared surface is a re-export of the framework canonical.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMiniAppFramework } from "../index";
import type { MiniAppFrameworkContext } from "../index";
import { combineBusy, createObservable } from "../reactive";
import { gasToBaseUnits, neoToInteger, amountToBaseUnits } from "../utils/amounts";
import { classifyChainError, mapChainError } from "../utils/chain-errors";
import { eventStateValue, eventValue } from "../utils/chain-events";
import { MiniAppError, isMiniAppError } from "../utils/errors";
import { FetchTimeoutError, HttpResponseError, isTransientFetchError } from "../utils/fetch-timeout";
import { sha256Hex, sha256Hex0x } from "../utils/hash";
import { addressToScriptHash, parseHash160 } from "../utils/neo";
import { localStorageAvailable } from "../utils/safe-storage";
import { extractTxid } from "../utils/transaction";
import { pollForEvent } from "../utils/async-utils";

// Shared re-export surface — must resolve to the SAME module instances.
import {
  MiniAppError as SharedMiniAppError,
  isMiniAppError as sharedIsMiniAppError,
} from "../../apps/shared/utils/errors";
import {
  FetchTimeoutError as SharedFetchTimeoutError,
  HttpResponseError as SharedHttpResponseError,
  isTransientFetchError as sharedIsTransientFetchError,
} from "../../apps/shared/utils/fetch-timeout";
import {
  eventStateValue as sharedEventStateValue,
  eventValue as sharedEventValue,
} from "../../apps/shared/utils/chain-events";
import {
  addressToScriptHash as sharedAddressToScriptHash,
  parseHash160 as sharedParseHash160,
} from "../../apps/shared/utils/neo";
import { gasToBaseUnits as sharedGasToBaseUnits } from "../../apps/shared/utils/amounts";
import { combineBusy as sharedCombineBusy } from "../../apps/shared/utils/observables";
import { sha256Hex as sharedSha256Hex } from "../../apps/shared/utils/hash";
import { extractTxid as sharedExtractTxid } from "../../apps/shared/utils/transaction";
import { pollForEvent as sharedPollForEvent } from "../../apps/shared/utils/async-utils";
import {
  classifyChainError as sharedClassifyChainError,
  mapChainError as sharedMapChainError,
} from "../../apps/shared/services/NotificationService";
import { localStorageAvailable as sharedLocalStorageAvailable } from "../../apps/shared/utils/safe-storage";

const ADDRESS = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";

function t(key: string, params?: Record<string, string | number>) {
  if (!params) return key;
  return Object.entries(params).reduce(
    (out, [name, value]) => out.replace(`{${name}}`, String(value)),
    key,
  );
}

function makeFramework(appId = "test-app") {
  const chain = {
    address: createObservable<string | null>(ADDRESS),
    ensureWallet: vi.fn(async () => ADDRESS),
    read: vi.fn(async () => "0"),
    invoke: vi.fn(async () => ({ txid: "0xinvoke", success: true })),
    invokeWithPayment: vi.fn(async () => ({ txid: "0xpay", success: true })),
    listEvents: vi.fn(async () => []),
  };
  const ctx = {
    services: { chain },
    t,
  } as unknown as MiniAppFrameworkContext;
  return { app: createMiniAppFramework(ctx, { appId }), chain };
}

beforeEach(() => {
  localStorage.clear();
});

describe("S0 utils consolidation", () => {
  describe("shared re-export identity (instanceof compatibility)", () => {
    it("resolves MiniAppError to a single class across framework and shared", () => {
      expect(Object.is(SharedMiniAppError, MiniAppError)).toBe(true);
      expect(Object.is(sharedIsMiniAppError, isMiniAppError)).toBe(true);

      const thrownByFramework = new MiniAppError("boom", "TEST_CODE");
      expect(thrownByFramework instanceof SharedMiniAppError).toBe(true);
      expect(sharedIsMiniAppError(thrownByFramework)).toBe(true);

      const thrownByApp = new SharedMiniAppError("boom", "TEST_CODE");
      expect(thrownByApp instanceof MiniAppError).toBe(true);
      expect(isMiniAppError(thrownByApp)).toBe(true);
    });

    it("resolves FetchTimeoutError/HttpResponseError to single classes", () => {
      expect(Object.is(SharedFetchTimeoutError, FetchTimeoutError)).toBe(true);
      expect(Object.is(SharedHttpResponseError, HttpResponseError)).toBe(true);

      const timeout = new FetchTimeoutError("https://x", 10);
      expect(timeout instanceof SharedFetchTimeoutError).toBe(true);
      // Retry predicates from either import see the same class.
      expect(sharedIsTransientFetchError(timeout)).toBe(true);
      expect(isTransientFetchError(new SharedHttpResponseError("429", 429))).toBe(true);
      expect(isTransientFetchError(new SharedHttpResponseError("404", 404))).toBe(false);
    });

    it("framework-thrown pollForEvent timeout is a shared-visible MiniAppError", async () => {
      expect(Object.is(sharedPollForEvent, pollForEvent)).toBe(true);
      await expect(
        pollForEvent(async () => [], () => false, { timeoutMs: 0, pollIntervalMs: 0 }),
      ).rejects.toSatisfy((error: unknown) => error instanceof SharedMiniAppError);
    });

    it("re-exports the same function objects for the pure helpers", () => {
      expect(Object.is(sharedAddressToScriptHash, addressToScriptHash)).toBe(true);
      expect(Object.is(sharedParseHash160, parseHash160)).toBe(true);
      expect(Object.is(sharedEventValue, eventValue)).toBe(true);
      expect(Object.is(sharedEventStateValue, eventStateValue)).toBe(true);
      expect(Object.is(sharedGasToBaseUnits, gasToBaseUnits)).toBe(true);
      expect(Object.is(sharedCombineBusy, combineBusy)).toBe(true);
      expect(Object.is(sharedSha256Hex, sha256Hex)).toBe(true);
      expect(Object.is(sharedExtractTxid, extractTxid)).toBe(true);
      expect(Object.is(sharedLocalStorageAvailable, localStorageAvailable)).toBe(true);
      expect(Object.is(sharedClassifyChainError, classifyChainError)).toBe(true);
      expect(Object.is(sharedMapChainError, mapChainError)).toBe(true);
    });
  });

  describe("storage prefix compatibility (neo:<appId>: byte-for-byte)", () => {
    it("writes framework local storage under the exact neo:<appId>: prefix", () => {
      const { app } = makeFramework("prefix-app");
      app.storage.local.set("journal", { entries: [1, 2] });

      expect(localStorage.getItem("neo:prefix-app:journal")).toBe(
        JSON.stringify({ entries: [1, 2] }),
      );
    });

    it("resolves pre-existing user data stored under neo:<appId>: keys", () => {
      // Simulate data written by the pre-consolidation framework build.
      localStorage.setItem("neo:prefix-app:legacy", JSON.stringify({ score: 42 }));
      localStorage.setItem("neo:prefix-app:list/a", JSON.stringify("a"));
      localStorage.setItem("neo:other-app:legacy", JSON.stringify("foreign"));

      const { app } = makeFramework("prefix-app");
      expect(app.storage.local.get<{ score: number }>("legacy")).toEqual({ score: 42 });

      const listed = app.storage.local.list("");
      expect(listed).toMatchObject({ legacy: { score: 42 }, "list/a": "a" });
      // Another app's namespace never leaks in.
      expect(Object.keys(listed).some((key) => key.includes("other-app"))).toBe(false);

      app.storage.local.delete("legacy");
      expect(localStorage.getItem("neo:prefix-app:legacy")).toBeNull();
    });

    it("persisted state atoms keep the neo:<appId>:state/ key layout", () => {
      const { app } = makeFramework("prefix-app");
      const atom = app.state.persisted("round", 1);
      atom.set(7);
      expect(localStorage.getItem("neo:prefix-app:state/round")).toBe("7");
    });
  });

  describe("amount error-semantics variants stay distinct (§S6 gotcha)", () => {
    it("shared-style scalers return 0n on invalid input and never throw", () => {
      expect(gasToBaseUnits("1.5")).toBe(150_000_000n);
      expect(gasToBaseUnits("not-a-number")).toBe(0n);
      expect(gasToBaseUnits("-3")).toBe(0n);
      expect(gasToBaseUnits("0")).toBe(0n);
      expect(neoToInteger("2")).toBe(2n);
      expect(neoToInteger("2.5")).toBe(0n); // NEO is indivisible — rejected, not scaled
      expect(amountToBaseUnits("1.00000001", "GAS")).toBe(100_000_001n);
      expect(amountToBaseUnits("3", "NEO")).toBe(3n);
    });

    it("app.amount.gasToFixed8 still THROWS on invalid input", () => {
      const { app } = makeFramework();
      expect(app.amount.gasToFixed8("1.5")).toBe(150_000_000n);
      expect(() => app.amount.gasToFixed8("not-a-number")).toThrow();
      expect(() => app.amount.gasToFixed8("-3")).toThrow();
      expect(() => app.amount.gasToFixed8("0")).toThrow();
    });
  });

  describe("eventValue parity (retired private copy in framework/index.ts)", () => {
    it("app.chain.eventValue IS the canonical eventStateValue", () => {
      const { app } = makeFramework();
      expect(Object.is(app.chain.eventValue, eventStateValue)).toBe(true);
    });

    it("keeps the defensive semantics of the retired private copy", () => {
      const enveloped = { state: [{ value: "alpha" }, "bare"] };
      expect(eventStateValue(enveloped, 0)).toBe("alpha");
      expect(eventStateValue(enveloped, 1)).toBe("bare");
      // Bare state arrays (indexer variant) are accepted too.
      expect(eventStateValue([{ value: "beta" }], 0)).toBe("beta");
      expect(eventStateValue("nope", 0)).toBeUndefined();
      // The strict variant requires the { state } envelope.
      expect(eventValue([{ value: "beta" }], 0)).toBeUndefined();
      expect(eventValue(enveloped, 0)).toBe("alpha");
    });
  });

  describe("hash consolidation (retired private sha256Hex in framework/index.ts)", () => {
    it("sha256Hex matches the reference vector; sha256Hex0x is its 0x form", async () => {
      const abc = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
      await expect(sha256Hex("abc")).resolves.toBe(abc);
      await expect(sha256Hex0x("abc")).resolves.toBe(`0x${abc}`);
    });

    it("oracle envelopes keep 0x-prefixed SHA-256 digests", async () => {
      const { app } = makeFramework();
      const envelope = await app.oracle.http({ url: "https://example.com/data" });
      expect(envelope.digest).toMatch(/^0x[0-9a-f]{64}$/);
      expect(envelope.payload.digest).toBe(envelope.digest);
      // Deterministic: same request → same digest (stable JSON + real SHA-256).
      const again = await app.oracle.http({ url: "https://example.com/data" });
      expect(again.digest).toBe(envelope.digest);
    });
  });

  describe("transaction consolidation (retired private txidOf in framework/index.ts)", () => {
    it("operations.run records the txid from {txid} results as before", async () => {
      const { app } = makeFramework();
      const op = app.operations.create("act");
      await op.run(async () => ({ txid: "0xdeadbeef" }));
      expect(op.state.get().status).toBe("succeeded");
      expect(op.state.get().txid).toBe("0xdeadbeef");
    });

    it("extractTxid also understands the txHash wire shape", () => {
      expect(extractTxid({ txid: "0xa" })).toBe("0xa");
      expect(extractTxid({ txHash: "0xb" })).toBe("0xb");
      expect(extractTxid("0xa")).toBe("");
      expect(extractTxid(null)).toBe("");
    });
  });

  describe("chain-errors extraction (NotificationService delegation)", () => {
    it("classifies the known chain/RPC failure families", () => {
      expect(classifyChainError(new Error("User rejected the request"))).toBe("userRejected");
      expect(classifyChainError("contract not deployed")).toBe("contractUnavailable");
      // Order matters: a FAULT embedding a specific assert stays specific.
      expect(classifyChainError(new Error("FAULT: insufficient prepaid gas"))).toBe(
        "insufficientGas",
      );
      expect(classifyChainError(new Error("request timed out"))).toBe("networkTimeout");
      expect(classifyChainError(new Error("VM exited with FAULT"))).toBe("transactionFailed");
      expect(classifyChainError(new Error("app-authored localized copy"))).toBeNull();
      expect(classifyChainError(42)).toBeNull();
      expect(classifyChainError(null)).toBeNull();
    });

    it("mapChainError translates known families and returns null otherwise", () => {
      const translate = (key: string) => `t:${key}`;
      expect(mapChainError(new Error("not enough gas"), translate)).toBe("t:insufficientGas");
      expect(mapChainError(new Error("Custom business assert"), translate)).toBeNull();
    });
  });

  describe("combineBusy in framework/reactive", () => {
    it("derives busy from any true source and releases all subscriptions", () => {
      const a = createObservable(false);
      const b = createObservable(false);
      const busy = combineBusy(a, b);
      expect(busy.get()).toBe(false);

      const listener = vi.fn();
      const unsubscribe = busy.subscribe(listener);
      a.set(true);
      expect(busy.get()).toBe(true);
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();
      b.set(true);
      expect(listener).toHaveBeenCalledTimes(1);
      // set() is a no-op on the derived observable.
      busy.set(false);
      expect(busy.get()).toBe(true);
    });
  });

  describe("neo canonical behavior", () => {
    it("converts the reference address and parseHash160 fixture", () => {
      expect(addressToScriptHash(ADDRESS)).toMatch(/^0x[0-9a-f]{40}$/);
      // Real-node fixture documented on parseHash160.
      expect(parseHash160("ODf0EwY4dOXBDMmxnUaR3fZWBm0=")).toBe(
        "0x6d0656f6dd91469db1c90cc1e574380613f43738",
      );
      expect(addressToScriptHash("not-an-address")).toBe("");
    });
  });
});
