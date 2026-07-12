import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type MiniAppFramework } from "@shared/react";
import {
  fetchOwnedDomains,
  formatGasBaseUnits,
  normalizeNnsExpiryMs,
  readNnsNameSnapshot,
  readNnsSearchSnapshot,
  readNnsTransactionOutcome,
  scriptHashToAddress,
  type NnsTransactionOutcome,
} from "./hooks/nnsRpc";
import {
  isPendingNnsOperation,
  normalizeNnsName,
  pendingMatchesOutcome,
  useNeoNS,
  type PendingNnsOperation,
} from "./hooks/useNeoNS";

const CONTRACT = "0x50ac1c37690cc2cfc594472833cf57505d5f46de";
const OWNER_HEX = "0xfda64993864efc704f708cd9393def67c7b32ea6";
const OWNER = "Nj39M97Rk2e23JiULBBMQmvpcnKaRHqxFf";
const RECEIVER_HEX = "0x11223344556677889900aabbccddeeff00112233";
const RECEIVER = scriptHashToAddress(RECEIVER_HEX);
const TXID = `0x${"ab".repeat(32)}`;
const EXPIRY = 1_979_732_129_690;

function hexToBase64(value: string): string {
  const bytes = (value.replace(/^0x/, "").match(/../g) ?? []).map((part) => Number.parseInt(part, 16));
  return btoa(String.fromCharCode(...bytes));
}

function pending(overrides: Partial<PendingNnsOperation> = {}): PendingNnsOperation {
  return {
    version: 1,
    kind: "register",
    network: "mainnet",
    contractHash: CONTRACT,
    actor: OWNER,
    txid: TXID,
    createdAt: Date.now(),
    name: "alice.neo",
    priceBase: "200000000",
    ...overrides,
  };
}

describe("Neo NS contract-exact inputs", () => {
  it("normalizes only names accepted by the official first-label rules", () => {
    expect(normalizeNnsName(" Alice ")).toBe("alice.neo");
    expect(normalizeNnsName("a-b.neo")).toBe("a-b.neo");
    expect(normalizeNnsName("1.neo")).toBe("1.neo");
    expect(normalizeNnsName("-alice")).toBeNull();
    expect(normalizeNnsName("alice-")).toBeNull();
    expect(normalizeNnsName("alice_name")).toBeNull();
    expect(normalizeNnsName("sub.alice.neo")).toBeNull();
    expect(normalizeNnsName("a".repeat(64))).toBeNull();
  });

  it("formats Fixed8 GAS and expiration without invented floating values", () => {
    expect(formatGasBaseUnits("1")).toBe("0.00000001");
    expect(formatGasBaseUnits("200000000")).toBe("2");
    expect(formatGasBaseUnits("7012345678")).toBe("70.12345678");
    expect(formatGasBaseUnits("-1")).toBe("");
    expect(normalizeNnsExpiryMs(EXPIRY)).toBe(EXPIRY);
    expect(normalizeNnsExpiryMs(Math.floor(EXPIRY / 1000))).toBe(Math.floor(EXPIRY / 1000) * 1000);
  });
});

describe("Neo NS durable operation truth", () => {
  it("rejects incomplete or ambiguous pending records", () => {
    expect(isPendingNnsOperation(pending())).toBe(true);
    expect(isPendingNnsOperation(pending({ txid: "0xtx" }))).toBe(false);
    expect(isPendingNnsOperation(pending({ contractHash: "0x0" }))).toBe(false);
    expect(isPendingNnsOperation(pending({ actor: "" }))).toBe(false);
    expect(isPendingNnsOperation(pending({ actor: `${OWNER.slice(0, -1)}1` }))).toBe(false);
    expect(isPendingNnsOperation(pending({ network: "neo-n3-mainnet" as "mainnet" }))).toBe(false);
    expect(isPendingNnsOperation(pending({ createdAt: 1.5 }))).toBe(false);
    expect(isPendingNnsOperation(pending({ kind: "transfer", receiver: undefined }))).toBe(false);
    expect(isPendingNnsOperation(pending({ kind: "set-record", target: RECEIVER }))).toBe(true);
  });

  it("requires an exact mint Transfer plus owner/expiry readback", () => {
    const operation = pending();
    const outcome: NnsTransactionOutcome = {
      state: "halt",
      transfer: { from: "", to: OWNER, amount: "1", name: "alice.neo" },
      renew: null,
    };
    expect(pendingMatchesOutcome(operation, outcome, {
      name: "alice.neo",
      owner: OWNER,
      expiration: EXPIRY,
    })).toBe(true);
    expect(pendingMatchesOutcome(operation, {
      ...outcome,
      transfer: { from: "", to: RECEIVER, amount: "1", name: "alice.neo" },
    }, { name: "alice.neo", owner: OWNER, expiration: EXPIRY })).toBe(false);
    expect(pendingMatchesOutcome(operation, {
      ...outcome,
      transfer: { from: RECEIVER, to: OWNER, amount: "1", name: "alice.neo" },
    }, { name: "alice.neo", owner: OWNER, expiration: EXPIRY })).toBe(true);
  });

  it("binds transfer, renewal, and TXT target readbacks to the reviewed action", () => {
    const transfer = pending({ kind: "transfer", receiver: RECEIVER, priceBase: undefined });
    expect(pendingMatchesOutcome(transfer, {
      state: "halt",
      transfer: { from: OWNER, to: RECEIVER, amount: "1", name: "alice.neo" },
      renew: null,
    }, { name: "alice.neo", owner: RECEIVER, expiration: EXPIRY })).toBe(true);

    const renew = pending({ kind: "renew", beforeExpiry: EXPIRY, priceBase: "200000000" });
    expect(pendingMatchesOutcome(renew, {
      state: "halt",
      transfer: null,
      renew: { name: "alice.neo", oldExpiration: EXPIRY, newExpiration: EXPIRY + 31_536_000_000 },
    }, { name: "alice.neo", owner: OWNER, expiration: EXPIRY + 31_536_000_000 })).toBe(true);

    const record = pending({ kind: "set-record", target: RECEIVER, priceBase: undefined });
    expect(pendingMatchesOutcome(record, { state: "halt", transfer: null, renew: null }, {
      name: "alice.neo",
      owner: OWNER,
      expiration: EXPIRY,
      target: RECEIVER,
    })).toBe(true);
  });
});

describe("Neo NS strict RPC evidence", () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("parses the exact contract-bound Transfer notification", async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        result: {
          executions: [{
            vmstate: "HALT",
            notifications: [{
              contract: CONTRACT,
              eventname: "Transfer",
              state: {
                type: "Array",
                value: [
                  { type: "Any" },
                  { type: "ByteString", value: hexToBase64(OWNER_HEX) },
                  { type: "Integer", value: "1" },
                  { type: "ByteString", value: btoa("alice.neo") },
                ],
              },
            }],
          }],
        },
      }),
    })) as unknown as typeof fetch;

    await expect(readNnsTransactionOutcome("mainnet", TXID, CONTRACT)).resolves.toEqual({
      state: "halt",
      transfer: { from: "", to: OWNER, amount: "1", name: "alice.neo" },
      renew: null,
    });
  });

  it("parses the exact Renew notification with millisecond expiries", async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        result: {
          executions: [{
            vmstate: "HALT",
            notifications: [{
              contract: CONTRACT,
              eventname: "Renew",
              state: {
                type: "Array",
                value: [
                  { type: "ByteString", value: btoa("alice.neo") },
                  { type: "Integer", value: String(EXPIRY) },
                  { type: "Integer", value: String(EXPIRY + 31_536_000_000) },
                ],
              },
            }],
          }],
        },
      }),
    })) as unknown as typeof fetch;

    await expect(readNnsTransactionOutcome("mainnet", TXID, CONTRACT)).resolves.toEqual({
      state: "halt",
      transfer: null,
      renew: { name: "alice.neo", oldExpiration: EXPIRY, newExpiration: EXPIRY + 31_536_000_000 },
    });
  });

  it("keeps FAULT and unknown receipts out of the success path", async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ result: { executions: [{ vmstate: "FAULT", notifications: [] }] } }),
    })) as unknown as typeof fetch;
    await expect(readNnsTransactionOutcome("testnet", TXID, CONTRACT)).resolves.toMatchObject({ state: "fault" });
    await expect(readNnsTransactionOutcome("testnet", "0xshort", CONTRACT)).resolves.toMatchObject({ state: "unknown" });
  });

  it("distinguishes a reserved short name without fabricating an owner", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { params: unknown[] };
      const operation = body.params[1];
      const stack = operation === "isAvailable"
        ? [{ type: "Boolean", value: false }]
        : [{ type: "Integer", value: "-1" }];
      return { ok: true, json: async () => ({ result: { state: "HALT", stack } }) } as Response;
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    await expect(readNnsSearchSnapshot("mainnet", CONTRACT, "a.neo")).resolves.toEqual({
      name: "a.neo",
      availability: "restricted",
      priceBase: "-1",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("requires strict owner and expiry reads before reporting a taken name", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { params: unknown[] };
      const operation = body.params[1];
      let stack: unknown[];
      if (operation === "isAvailable") stack = [{ type: "Boolean", value: false }];
      else if (operation === "getPrice") stack = [{ type: "Integer", value: "200000000" }];
      else if (operation === "ownerOf") stack = [{ type: "ByteString", value: hexToBase64(OWNER_HEX) }];
      else if (operation === "properties") {
        stack = [{
          type: "Map",
          value: [
            { key: { type: "ByteString", value: btoa("name") }, value: { type: "ByteString", value: btoa("alice.neo") } },
            { key: { type: "ByteString", value: btoa("expiration") }, value: { type: "Integer", value: String(EXPIRY) } },
          ],
        }];
      } else stack = [{ type: "Any" }];
      return { ok: true, json: async () => ({ result: { state: "HALT", stack } }) } as Response;
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(readNnsSearchSnapshot("mainnet", CONTRACT, "alice.neo")).resolves.toEqual({
      name: "alice.neo",
      availability: "owned",
      priceBase: "200000000",
      owner: OWNER,
      expiration: EXPIRY,
    });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("reads the address target only when the caller needs target evidence", async () => {
    const operations: string[] = [];
    globalThis.fetch = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { params: unknown[] };
      const operation = String(body.params[1]);
      operations.push(operation);
      const stack = operation === "ownerOf"
        ? [{ type: "ByteString", value: hexToBase64(OWNER_HEX) }]
        : operation === "properties"
          ? [{
              type: "Map",
              value: [
                { key: { type: "ByteString", value: btoa("name") }, value: { type: "ByteString", value: btoa("alice.neo") } },
                { key: { type: "ByteString", value: btoa("expiration") }, value: { type: "Integer", value: String(EXPIRY) } },
              ],
            }]
          : [{ type: "ByteString", value: btoa(RECEIVER) }];
      return { ok: true, json: async () => ({ result: { state: "HALT", stack } }) } as Response;
    }) as unknown as typeof fetch;

    await expect(readNnsNameSnapshot("mainnet", CONTRACT, "alice.neo")).resolves.toEqual({
      name: "alice.neo",
      owner: OWNER,
      expiration: EXPIRY,
    });
    expect(operations).not.toContain("resolve");

    operations.length = 0;
    await expect(readNnsNameSnapshot("mainnet", CONTRACT, "alice.neo", { includeTarget: true })).resolves.toEqual({
      name: "alice.neo",
      owner: OWNER,
      expiration: EXPIRY,
      target: RECEIVER,
    });
    expect(operations).toContain("resolve");
  });

  it("rejects a failed properties read instead of returning expiry zero", async () => {
    globalThis.fetch = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { method: string; params: unknown[] };
      if (body.method === "getnep11balances") {
        return {
          ok: true,
          json: async () => ({ result: { balance: [{ assethash: CONTRACT, tokens: [{ tokenid: "616c6963652e6e656f", amount: "1" }] }] } }),
        } as Response;
      }
      const operation = body.params[1];
      if (operation === "properties") {
        return { ok: true, json: async () => ({ result: { state: "FAULT", exception: "read failed", stack: [] } }) } as Response;
      }
      return { ok: true, json: async () => ({ result: { state: "HALT", stack: [{ type: "Any" }] } }) } as Response;
    }) as unknown as typeof fetch;

    await expect(fetchOwnedDomains(OWNER, "neo-n3-mainnet", CONTRACT)).rejects.toThrow("read failed");
  });

  it("rejects an owned-token row that omits its NEP-11 amount", async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        result: { balance: [{ assethash: CONTRACT, tokens: [{ tokenid: "616c6963652e6e656f" }] }] },
      }),
    })) as unknown as typeof fetch;

    await expect(fetchOwnedDomains(OWNER, "neo-n3-mainnet", CONTRACT)).rejects.toThrow("non-unique token amount");
  });

  it("rejects duplicate owned token ids before publishing an ambiguous domain list", async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        result: {
          balance: [{
            assethash: CONTRACT,
            tokens: [
              { tokenid: "616c6963652e6e656f", amount: "1" },
              { tokenid: "616c6963652e6e656f", amount: "1" },
            ],
          }],
        },
      }),
    })) as unknown as typeof fetch;

    await expect(fetchOwnedDomains(OWNER, "neo-n3-mainnet", CONTRACT)).rejects.toThrow("duplicate token id");
  });

  it("requires the properties name when hydrating an owned domain", async () => {
    globalThis.fetch = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { method: string; params: unknown[] };
      if (body.method === "getnep11balances") {
        return {
          ok: true,
          json: async () => ({ result: { balance: [{ assethash: CONTRACT, tokens: [{ tokenid: "616c6963652e6e656f", amount: "1" }] }] } }),
        } as Response;
      }
      const operation = body.params[1];
      const stack = operation === "properties"
        ? [{
            type: "Map",
            value: [{ key: { type: "ByteString", value: btoa("expiration") }, value: { type: "Integer", value: String(EXPIRY) } }],
          }]
        : [{ type: "Any" }];
      return { ok: true, json: async () => ({ result: { state: "HALT", stack } }) } as Response;
    }) as unknown as typeof fetch;

    await expect(fetchOwnedDomains(OWNER, "neo-n3-mainnet", CONTRACT)).rejects.toThrow("names do not match");
  });

  it("does not silently route an unknown owned-name network to mainnet", async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    await expect(fetchOwnedDomains(OWNER, "unknown-network", CONTRACT)).rejects.toThrow("network is malformed");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("cannot publish the previous wallet's in-flight domain list after an account switch", async () => {
    const address = createObservable<string | null>(OWNER);
    let releaseBalance: (() => void) | undefined;
    const balanceGate = new Promise<void>((resolve) => { releaseBalance = resolve; });
    globalThis.fetch = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { method: string; params: unknown[] };
      if (body.method === "getnep11balances") {
        await balanceGate;
        return {
          ok: true,
          json: async () => ({ result: { balance: [{ assethash: CONTRACT, tokens: [{ tokenid: "616c6963652e6e656f", amount: "1" }] }] } }),
        } as Response;
      }
      const operation = body.params[1];
      if (operation === "properties") {
        return {
          ok: true,
          json: async () => ({
            result: {
              state: "HALT",
              stack: [{
                type: "Map",
                value: [
                  { key: { type: "ByteString", value: btoa("name") }, value: { type: "ByteString", value: btoa("alice.neo") } },
                  { key: { type: "ByteString", value: btoa("expiration") }, value: { type: "Integer", value: String(EXPIRY) } },
                ],
              }],
            },
          }),
        } as Response;
      }
      return { ok: true, json: async () => ({ result: { state: "HALT", stack: [{ type: "Any" }] } }) } as Response;
    }) as unknown as typeof fetch;

    const local = new Map<string, unknown>();
    const app = {
      chain: {
        address,
        contractAddress: createObservable<string | null>(null),
        detectNetwork: vi.fn(async () => "neo-n3-mainnet"),
      },
      platform: { launch: { network: "neo-n3-mainnet" } },
      storage: {
        local: {
          get: <T,>(key: string, fallback: T | null = null) => (local.has(key) ? local.get(key) as T : fallback),
          set: (key: string, value: unknown) => { local.set(key, value); },
          delete: (key: string) => { local.delete(key); },
        },
      },
    } as unknown as MiniAppFramework;
    const ns = useNeoNS({ app, t: (key) => key });
    const loading = ns.loadMyDomains();
    address.set(RECEIVER);
    ns.handleAccountChanged();
    releaseBalance?.();
    await loading;

    expect(ns.myDomains.get()).toEqual([]);
    expect(ns.domainsStatus.get()).toBe("loading");
    ns.cleanup();
  });

  it("does not let an older failed search overwrite a newer successful result", async () => {
    let releaseAlice: (() => void) | undefined;
    const aliceGate = new Promise<void>((resolve) => { releaseAlice = resolve; });
    globalThis.fetch = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { params: unknown[] };
      const operation = String(body.params[1]);
      const args = body.params[2] as Array<{ value?: unknown }>;
      const value = String(args?.[0]?.value ?? "");
      if (value === "alice.neo" || value === "5") await aliceGate;
      if (value === "alice.neo") {
        return { ok: true, json: async () => ({ result: { state: "FAULT", exception: "stale failure", stack: [] } }) } as Response;
      }
      const stack = operation === "isAvailable"
        ? [{ type: "Boolean", value: true }]
        : [{ type: "Integer", value: "7000000000" }];
      return { ok: true, json: async () => ({ result: { state: "HALT", stack } }) } as Response;
    }) as unknown as typeof fetch;

    const local = new Map<string, unknown>();
    const app = {
      chain: {
        address: createObservable<string | null>(null),
        contractAddress: createObservable<string | null>(null),
        detectNetwork: vi.fn(async () => "neo-n3-mainnet"),
      },
      platform: { launch: { network: "neo-n3-mainnet" } },
      storage: { local: {
        get: <T,>(key: string, fallback: T | null = null) => (local.has(key) ? local.get(key) as T : fallback),
        set: (key: string, value: unknown) => { local.set(key, value); },
        delete: (key: string) => { local.delete(key); },
      } },
    } as unknown as MiniAppFramework;
    const ns = useNeoNS({ app, t: (key) => key });
    ns.searchQuery.set("alice");
    const older = ns.searchDomain();
    await vi.waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(2));
    ns.searchQuery.set("bobb");
    await ns.searchDomain();
    expect(ns.searchResult.get()).toMatchObject({ name: "bobb.neo", available: true, price: "70" });
    releaseAlice?.();
    await older;
    expect(ns.searchResult.get()).toMatchObject({ name: "bobb.neo", available: true, price: "70" });
    expect(ns.error.get()).toBe("");
    expect(ns.isSearching.get()).toBe(false);
    ns.cleanup();
  });

  it("requires positive wallet-network detection before any write request", async () => {
    const invoke = vi.fn();
    const local = new Map<string, unknown>();
    const app = {
      chain: {
        address: createObservable<string | null>(OWNER),
        contractAddress: createObservable<string | null>(CONTRACT),
        ensureWallet: vi.fn(async () => OWNER),
        detectNetwork: vi.fn(async () => { throw new Error("wallet network unavailable"); }),
        invoke,
        arg: {
          string: (value: unknown) => ({ type: "String", value: String(value) }),
          hash160: (value: unknown) => ({ type: "Hash160", value: String(value) }),
        },
      },
      platform: { launch: { network: "neo-n3-mainnet" } },
      storage: { local: {
        get: <T,>(key: string, fallback: T | null = null) => (local.has(key) ? local.get(key) as T : fallback),
        set: (key: string, value: unknown) => { local.set(key, value); },
        delete: (key: string) => { local.delete(key); },
      } },
    } as unknown as MiniAppFramework;
    const ns = useNeoNS({ app, t: (key) => key });
    ns.searchQuery.set("alice");
    ns.searchResult.set({ name: "alice.neo", available: true, price: "2", priceBase: "200000000" });

    await expect(ns.registerDomain()).rejects.toThrow("networkUnverified");
    expect(invoke).not.toHaveBeenCalled();
    ns.cleanup();
  });

  it("pauses a write before the wallet when a recovery receipt cannot persist", async () => {
    const invoke = vi.fn();
    globalThis.fetch = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { params: unknown[] };
      const operation = String(body.params[1]);
      const stack = operation === "isAvailable"
        ? [{ type: "Boolean", value: true }]
        : [{ type: "Integer", value: "200000000" }];
      return { ok: true, json: async () => ({ result: { state: "HALT", stack } }) } as Response;
    }) as unknown as typeof fetch;
    const app = {
      chain: {
        address: createObservable<string | null>(OWNER),
        contractAddress: createObservable<string | null>(CONTRACT),
        ensureWallet: vi.fn(async () => OWNER),
        detectNetwork: vi.fn(async () => "neo-n3-mainnet"),
        invoke,
        arg: {
          string: (value: unknown) => ({ type: "String", value: String(value) }),
          hash160: (value: unknown) => ({ type: "Hash160", value: String(value) }),
        },
      },
      platform: { launch: { network: "neo-n3-mainnet" } },
      storage: { local: {
        get: <T,>(_key: string, fallback: T | null = null) => fallback,
        set: () => {},
        delete: () => {},
      } },
    } as unknown as MiniAppFramework;
    const ns = useNeoNS({ app, t: (key) => key });
    ns.searchQuery.set("alice");
    ns.searchResult.set({ name: "alice.neo", available: true, price: "2", priceBase: "200000000" });

    await expect(ns.registerDomain()).rejects.toThrow("recoveryStorageUnavailable");
    expect(invoke).not.toHaveBeenCalled();
    expect(ns.recoveryStorageStatus.get()).toBe("unavailable");
    ns.cleanup();
  });

  it("does not publish the original wallet's confirmed name after the account switches mid-flight", async () => {
    const address = createObservable<string | null>(OWNER);
    globalThis.fetch = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { method: string; params: unknown[] };
      if (body.method === "getapplicationlog") {
        return {
          ok: true,
          json: async () => ({ result: { executions: [{
            vmstate: "HALT",
            notifications: [{
              contract: CONTRACT,
              eventname: "Transfer",
              state: {
                type: "Array",
                value: [
                  { type: "Any" },
                  { type: "ByteString", value: hexToBase64(OWNER_HEX) },
                  { type: "Integer", value: "1" },
                  { type: "ByteString", value: btoa("alice.neo") },
                ],
              },
            }],
          }] } }),
        } as Response;
      }
      const operation = String(body.params[1]);
      const stack = operation === "isAvailable"
        ? [{ type: "Boolean", value: true }]
        : operation === "getPrice"
          ? [{ type: "Integer", value: "200000000" }]
          : operation === "ownerOf"
            ? [{ type: "ByteString", value: hexToBase64(OWNER_HEX) }]
            : [{
                type: "Map",
                value: [
                  { key: { type: "ByteString", value: btoa("name") }, value: { type: "ByteString", value: btoa("alice.neo") } },
                  { key: { type: "ByteString", value: btoa("expiration") }, value: { type: "Integer", value: String(EXPIRY) } },
                ],
              }];
      return { ok: true, json: async () => ({ result: { state: "HALT", stack } }) } as Response;
    }) as unknown as typeof fetch;

    const local = new Map<string, unknown>();
    const invoke = vi.fn(async (_operation: string, _args: unknown[], options: { onTransactionSent?: (txid: string) => void }) => {
      options.onTransactionSent?.(TXID);
      address.set(RECEIVER);
      return { success: true, txid: TXID };
    });
    const app = {
      chain: {
        address,
        contractAddress: createObservable<string | null>(CONTRACT),
        ensureWallet: vi.fn(async () => OWNER),
        detectNetwork: vi.fn(async () => "neo-n3-mainnet"),
        invoke,
        arg: {
          string: (value: unknown) => ({ type: "String", value: String(value) }),
          hash160: (value: unknown) => ({ type: "Hash160", value: String(value) }),
        },
      },
      platform: { launch: { network: "neo-n3-mainnet" } },
      storage: { local: {
        get: <T,>(key: string, fallback: T | null = null) => (local.has(key) ? local.get(key) as T : fallback),
        set: (key: string, value: unknown) => { local.set(key, value); },
        delete: (key: string) => { local.delete(key); },
      } },
    } as unknown as MiniAppFramework;
    const ns = useNeoNS({ app, t: (key) => key });
    ns.searchQuery.set("alice");
    ns.searchResult.set({ name: "alice.neo", available: true, price: "2", priceBase: "200000000" });

    await ns.registerDomain();
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(ns.myDomains.get()).toEqual([]);
    expect(ns.transactionNotice.get()).toBe("transactionConfirmedWalletChanged");
    expect(ns.pendingOperation.get()).toBeNull();
    ns.cleanup();
  });

  it("suppresses an address-record write when the chain already has that target", async () => {
    globalThis.fetch = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { params: unknown[] };
      const operation = String(body.params[1]);
      const stack = operation === "ownerOf"
        ? [{ type: "ByteString", value: hexToBase64(OWNER_HEX) }]
        : operation === "properties"
          ? [{
              type: "Map",
              value: [
                { key: { type: "ByteString", value: btoa("name") }, value: { type: "ByteString", value: btoa("alice.neo") } },
                { key: { type: "ByteString", value: btoa("expiration") }, value: { type: "Integer", value: String(EXPIRY) } },
              ],
            }]
          : [{ type: "ByteString", value: btoa(RECEIVER) }];
      return { ok: true, json: async () => ({ result: { state: "HALT", stack } }) } as Response;
    }) as unknown as typeof fetch;

    const invoke = vi.fn();
    const local = new Map<string, unknown>();
    const app = {
      chain: {
        address: createObservable<string | null>(OWNER),
        contractAddress: createObservable<string | null>(CONTRACT),
        ensureWallet: vi.fn(async () => OWNER),
        detectNetwork: vi.fn(async () => "neo-n3-mainnet"),
        invoke,
        arg: {
          string: (value: unknown) => ({ type: "String", value: String(value) }),
          integer: (value: unknown) => ({ type: "Integer", value: String(value) }),
        },
      },
      platform: { launch: { network: "neo-n3-mainnet" } },
      storage: { local: {
        get: <T,>(key: string, fallback: T | null = null) => (local.has(key) ? local.get(key) as T : fallback),
        set: (key: string, value: unknown) => { local.set(key, value); },
        delete: (key: string) => { local.delete(key); },
      } },
    } as unknown as MiniAppFramework;
    const ns = useNeoNS({ app, t: (key) => key });

    await expect(ns.setRecord({ name: "alice.neo", owner: OWNER, expiry: EXPIRY, target: RECEIVER }, RECEIVER))
      .rejects.toThrow("targetAlreadySet");
    expect(invoke).not.toHaveBeenCalled();
    expect(ns.isLoading.get()).toBe(false);
    ns.cleanup();
  });
});
