import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GAS_HASH } from "@shared/constants/rpc";
import { createMiniAppFramework } from "@shared/react";
import { createObservable } from "@shared/react/context";
import { addressToScriptHash } from "@shared/utils/neo";

import {
  findAAMarketNotification,
  isPendingAAMarketOperation,
  readAAMarketTransactionOutcome,
  requireCanonicalAAMarketContext,
  type PendingAAMarketOperation,
} from "../../aa-market-hub/src/aa-market-safety";
import { useAAMarketHub } from "../../aa-market-hub/src/composables/useAAMarketHub";

const APP = path.resolve(process.cwd(), "../aa-market-hub");
const MAINNET_MARKET = "0xae7afe3a85ab08bfd1d4907b35ae8b80c75b3a69";
const TESTNET_MARKET = "0x8dbd4cf6fc47afc013e7fd7128d028db2985bddf";
const MAINNET_CORE = "0x0268a387913b250166ddec032b03332690a1ef78";
const TESTNET_CORE = "0xdbf38e7b2117186bf7a5e17ead702322c0c5b6f2";
const GAS = GAS_HASH.toLowerCase();
const ACTOR = "0x1111111111111111111111111111111111111111";
const ACCOUNT = "0x2222222222222222222222222222222222222222";
const TXID = `0x${"ab".repeat(32)}`;
const WALLET = "NR3E4D8NUXh3zhbf5ZkAp3rTxWbQqNih32";
const WALLET_HASH = addressToScriptHash(WALLET).toLowerCase();

function read(relativePath: string): string {
  return readFileSync(path.join(APP, relativePath), "utf8");
}

function cancelPending(
  overrides: Partial<PendingAAMarketOperation> = {},
): PendingAAMarketOperation {
  return {
    version: 1,
    kind: "cancel",
    network: "mainnet",
    marketHash: MAINNET_MARKET,
    aaCoreHash: MAINNET_CORE,
    gasHash: GAS,
    actorHash: ACTOR,
    txid: TXID,
    createdAt: Date.now(),
    listingId: "7",
    accountIdHash: ACCOUNT,
    ...overrides,
  };
}

function rpcStackResponse(id: unknown, stackItem: unknown): Response {
  return new Response(JSON.stringify({
    jsonrpc: "2.0",
    id,
    result: { state: "HALT", stack: [stackItem] },
  }), { status: 200, headers: { "Content-Type": "application/json" } });
}

function chainHashStack(displayHash: string): { type: "ByteString"; value: string } {
  const bytes = displayHash.replace(/^0x/i, "").match(/../g) ?? [];
  return {
    type: "ByteString",
    value: Buffer.from(bytes.reverse().join(""), "hex").toString("base64"),
  };
}

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe("AA Market Hub published product truth", () => {
  it("pins both canonical market deployments and keeps the designed UI authoritative", () => {
    const manifest = JSON.parse(read("neo-manifest.json")) as {
      version: string;
      contracts: Record<string, string>;
      deployment: Record<string, { status: string; contract_hash: string; reason: string }>;
      permissions: string[];
      operation_panel: { operations: unknown[]; subtitle: string };
    };
    const packageJson = JSON.parse(read("package.json")) as { version: string };

    expect(manifest.version).toBe(packageJson.version);
    expect(manifest.contracts).toEqual({
      "neo-n3-mainnet": MAINNET_MARKET,
      "neo-n3-testnet": TESTNET_MARKET,
    });
    expect(manifest.deployment["neo-n3-mainnet"]).toMatchObject({
      status: "deployed",
      contract_hash: MAINNET_MARKET,
    });
    expect(manifest.deployment["neo-n3-testnet"]).toMatchObject({
      status: "deployed",
      contract_hash: TESTNET_MARKET,
    });
    expect(manifest.deployment["neo-n3-mainnet"].reason).toContain("eventless");
    expect(manifest.deployment["neo-n3-testnet"].reason).toContain("87 HALT listing reads");
    expect(manifest.permissions).toEqual(expect.arrayContaining([
      "invoke:primary",
      "read:blockchain",
      "write:blockchain",
    ]));
    expect(manifest.operation_panel.operations).toEqual([]);
    expect(manifest.operation_panel.subtitle).toContain("designed escrow marketplace");
  });

  it("documents the direct-wallet, event-plus-readback confirmation boundary in both languages", () => {
    const documentation = `${read("README.md")}\n${read("NETWORK_STATUS.md")}`;

    expect(documentation).toContain(MAINNET_CORE);
    expect(documentation).toContain(TESTNET_CORE);
    expect(documentation).toContain("Integer listing ID");
    expect(documentation).toContain("501 relay_not_configured");
    expect(documentation).toContain("direct-wallet");
    expect(documentation).toContain("Business events: **none**");
    expect(documentation).toContain("AA Core");
    expect(documentation).toContain("GAS `Transfer`");
    expect(documentation).toContain("pending");
    expect(documentation).toContain("直连钱包");
    expect(documentation).toContain("交易哈希");
  });
});

describe("AA Market Hub canonical context", () => {
  it("binds market and AA Core to the detected network and rejects network drift", async () => {
    const app = {
      platform: { launch: { network: "neo-n3-mainnet" } },
      chain: {
        detectNetwork: vi.fn(async () => "mainnet"),
        contractAddress: { get: () => MAINNET_MARKET },
      },
    };

    await expect(
      requireCanonicalAAMarketContext(app as never, "context mismatch"),
    ).resolves.toMatchObject({
      network: "mainnet",
      marketHash: MAINNET_MARKET,
      aaCoreHash: MAINNET_CORE,
      gasHash: GAS,
    });

    app.chain.detectNetwork.mockResolvedValueOnce("testnet");
    await expect(
      requireCanonicalAAMarketContext(app as never, "context mismatch"),
    ).rejects.toThrow("context mismatch");

    app.chain.detectNetwork.mockRejectedValueOnce(new Error("wallet network unavailable"));
    await expect(
      requireCanonicalAAMarketContext(
        app as never,
        "network unverified",
        { requireDetectedNetwork: true },
      ),
    ).rejects.toThrow("network unverified");
  });

  it("resolves the independent testnet market and AA Core pair", async () => {
    const app = {
      platform: { launch: { network: "neo-n3-testnet" } },
      chain: {
        detectNetwork: vi.fn(async () => "testnet"),
        contractAddress: { get: () => TESTNET_MARKET },
      },
    };

    await expect(requireCanonicalAAMarketContext(app as never)).resolves.toMatchObject({
      network: "testnet",
      marketHash: TESTNET_MARKET,
      aaCoreHash: TESTNET_CORE,
      gasHash: GAS,
    });
  });
});

describe("AA Market Hub durable pending records", () => {
  it("requires operation-specific integer-safe evidence and rejects corrupted bindings", () => {
    expect(isPendingAAMarketOperation(cancelPending())).toBe(true);
    expect(isPendingAAMarketOperation(cancelPending({ listingId: "0" }))).toBe(false);
    expect(isPendingAAMarketOperation(cancelPending({ marketHash: "0x1234" }))).toBe(false);
    expect(isPendingAAMarketOperation(cancelPending({ gasHash: "" }))).toBe(false);
    expect(isPendingAAMarketOperation(cancelPending({ txid: "broadcast-ok" }))).toBe(false);
    expect(isPendingAAMarketOperation(cancelPending({ txid: `0x${"ab".repeat(8)}` }))).toBe(false);
    expect(isPendingAAMarketOperation(cancelPending({ txid: `0x${"ab".repeat(33)}` }))).toBe(false);
    expect(isPendingAAMarketOperation(cancelPending({ createdAt: 1.5 }))).toBe(false);

    expect(isPendingAAMarketOperation({
      ...cancelPending(),
      kind: "buy",
      sellerHash: "0x3333333333333333333333333333333333333333",
      priceRaw: "150000000",
      newBackupOwnerHash: ACTOR,
    })).toBe(true);
    expect(isPendingAAMarketOperation({
      ...cancelPending(),
      kind: "buy",
      sellerHash: "0x3333333333333333333333333333333333333333",
      priceRaw: "1.5",
      newBackupOwnerHash: ACTOR,
    })).toBe(false);
  });

  it.each([
    ["network", { network: "testnet" }],
    ["market", { marketHash: TESTNET_MARKET }],
    ["AA Core", { aaCoreHash: TESTNET_CORE }],
    ["GAS", { gasHash: "0x4444444444444444444444444444444444444444" }],
    ["wallet actor", { actorHash: "0x5555555555555555555555555555555555555555" }],
  ] as Array<[string, Partial<PendingAAMarketOperation>]>)(
    "keeps recovery pending without an RPC lookup when the %s binding drifts",
    async (_label, mismatch) => {
      const chain = {
        address: createObservable<string | null>(WALLET),
        contractAddress: createObservable<string | null>(MAINNET_MARKET),
        detectNetwork: vi.fn(async () => "mainnet"),
        ensureWallet: vi.fn(async () => WALLET),
        read: vi.fn(async () => null),
        invoke: vi.fn(),
        invokeWithPayment: vi.fn(),
        invokeMultiple: vi.fn(),
      };
      const app = createMiniAppFramework({
        services: { chain, notify: {} },
        launchContext: { appId: "miniapp-aa-market-hub", network: "neo-n3-mainnet" },
        t: (key: string) => key,
      } as never, { appId: "miniapp-aa-market-hub", storagePrefix: "aa-market-test:" });
      const hub = useAAMarketHub({ app, t: (key) => key });
      const pending = cancelPending({ actorHash: WALLET_HASH, ...mismatch });
      expect(isPendingAAMarketOperation(pending)).toBe(true);
      hub.pendingOperation.set(pending);
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("must not read"));

      await expect(hub.recoverPendingOperation()).resolves.toEqual({
        status: "pending",
        txid: TXID,
      });
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(hub.transactionNotice.get()).toBe("pendingContextMismatch");
      hub.cleanup();
    },
  );

  it("collapses duplicate writes and blocks a different market action during wallet work", async () => {
    let rejectWallet: ((reason: Error) => void) | undefined;
    const chain = {
      address: createObservable<string | null>(WALLET),
      contractAddress: createObservable<string | null>(MAINNET_MARKET),
      detectNetwork: vi.fn(async () => "mainnet"),
      ensureWallet: vi.fn(() => new Promise<string>((_resolve, reject) => {
        rejectWallet = reject;
      })),
      read: vi.fn(async () => null),
      invoke: vi.fn(),
      invokeWithPayment: vi.fn(),
      invokeMultiple: vi.fn(),
    };
    const app = createMiniAppFramework({
      services: { chain, notify: {} },
      launchContext: { appId: "miniapp-aa-market-hub", network: "neo-n3-mainnet" },
      t: (key: string) => key,
    } as never, { appId: "miniapp-aa-market-hub", storagePrefix: "aa-market-exclusive:" });
    const hub = useAAMarketHub({ app, t: (key) => key });
    hub.accountIdHash.set(ACCOUNT);

    const first = hub.submitCreateListing();
    const duplicate = hub.submitCreateListing();
    expect(duplicate).toBe(first);
    await expect(hub.submitRefundSelected()).rejects.toThrow("operationInProgress");

    await Promise.resolve();
    rejectWallet?.(new Error("wallet cancelled"));
    await expect(first).rejects.toThrow("wallet cancelled");
    expect(hub.isSubmitting.get()).toBe(false);
    hub.cleanup();
  });

  it("rejects malformed preflight state before opening a transaction", async () => {
    const chain = {
      address: createObservable<string | null>(WALLET),
      contractAddress: createObservable<string | null>(MAINNET_MARKET),
      detectNetwork: vi.fn(async () => "mainnet"),
      ensureWallet: vi.fn(async () => WALLET),
      read: vi.fn(async () => null),
      invoke: vi.fn(),
      invokeWithPayment: vi.fn(),
      invokeMultiple: vi.fn(),
    };
    const app = createMiniAppFramework({
      services: { chain, notify: {} },
      launchContext: { appId: "miniapp-aa-market-hub", network: "neo-n3-mainnet" },
      t: (key: string) => key,
    } as never, { appId: "miniapp-aa-market-hub", storagePrefix: "aa-market-count:" });
    const hub = useAAMarketHub({ app, t: (key) => key });
    hub.accountIdHash.set(ACCOUNT);
    let malformedActive = false;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (_input, init) => {
      const request = JSON.parse(String(init?.body)) as {
        id: unknown;
        params: [string, string];
      };
      const operation = request.params[1];
      if (operation === "getBackupOwner") {
        return rpcStackResponse(request.id, chainHashStack(WALLET_HASH));
      }
      if (operation === "isMarketEscrowActive") {
        if (malformedActive) {
          return rpcStackResponse(request.id, {
            type: "ByteString",
            value: Buffer.from("false").toString("base64"),
          });
        }
        return rpcStackResponse(request.id, { type: "Boolean", value: false });
      }
      if (operation === "getListingCount") {
        if (malformedActive) {
          return rpcStackResponse(request.id, { type: "Integer", value: "0" });
        }
        return rpcStackResponse(request.id, {
          type: "ByteString",
          value: Buffer.from("not-an-integer").toString("base64"),
        });
      }
      throw new Error(`Unexpected operation: ${operation}`);
    });

    await expect(hub.submitCreateListing()).rejects.toThrow("listingCountInvalid");
    expect(chain.invoke).not.toHaveBeenCalled();
    expect(chain.invokeMultiple).not.toHaveBeenCalled();

    malformedActive = true;
    await expect(hub.submitCreateListing()).rejects.toThrow("accountStateInvalid");
    expect(chain.invoke).not.toHaveBeenCalled();
    expect(chain.invokeMultiple).not.toHaveBeenCalled();
    hub.cleanup();
  });

  it("discards a stale listing failure and reloads for the new wallet snapshot", async () => {
    let resolveFirst: ((response: Response) => void) | undefined;
    const chain = {
      address: createObservable<string | null>(WALLET),
      contractAddress: createObservable<string | null>(MAINNET_MARKET),
      detectNetwork: vi.fn(async () => "mainnet"),
      ensureWallet: vi.fn(async () => WALLET),
      read: vi.fn(async () => null),
      invoke: vi.fn(),
      invokeWithPayment: vi.fn(),
      invokeMultiple: vi.fn(),
    };
    const app = createMiniAppFramework({
      services: { chain, notify: {} },
      launchContext: { appId: "miniapp-aa-market-hub", network: "neo-n3-mainnet" },
      t: (key: string) => key,
    } as never, { appId: "miniapp-aa-market-hub", storagePrefix: "aa-market-load-race:" });
    const hub = useAAMarketHub({ app, t: (key) => key });
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (_input, init) => {
      const request = JSON.parse(String(init?.body)) as { id: unknown };
      if (fetchSpy.mock.calls.length === 1) {
        return new Promise<Response>((resolve) => {
          resolveFirst = resolve;
        });
      }
      return rpcStackResponse(request.id, { type: "Integer", value: "0" });
    });

    const firstLoad = hub.loadListings();
    await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
    chain.address.set(null);
    resolveFirst?.(new Response("temporarily unavailable", { status: 503 }));
    await firstLoad;

    await vi.waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(hub.dataSource.get()).toBe("chain");
    });
    expect(hub.lastError.get()).toBe("");
    hub.cleanup();
  });

  it("maps a raw wallet rejection onto the chain-error family copy in lastError", async () => {
    // errorText used to display raw Error.message verbatim, leaking English
    // wallet/RPC prose to zh users. It now routes through
    // app.errors.messageOf, which maps this rejection onto the userRejected
    // family key (the identity translator returns the key).
    const chain = {
      address: createObservable<string | null>(null),
      contractAddress: createObservable<string | null>(MAINNET_MARKET),
      detectNetwork: vi.fn(async () => "mainnet"),
      ensureWallet: vi.fn(async () => {
        throw new Error("User rejected the request");
      }),
      read: vi.fn(async () => null),
      invoke: vi.fn(),
      invokeWithPayment: vi.fn(),
      invokeMultiple: vi.fn(),
    };
    const app = createMiniAppFramework({
      services: { chain, notify: {} },
      launchContext: { appId: "miniapp-aa-market-hub", network: "neo-n3-mainnet" },
      t: (key: string) => key,
    } as never, { appId: "miniapp-aa-market-hub", storagePrefix: "aa-market-reject:" });
    const hub = useAAMarketHub({ app, t: (key) => key });

    await expect(hub.connectWallet()).rejects.toThrow("User rejected the request");
    expect(hub.lastError.get()).toBe("userRejected");
    hub.cleanup();
  });

  it("keeps an in-session transaction visible when durable recovery storage fails", async () => {
    const chain = {
      address: createObservable<string | null>(WALLET),
      contractAddress: createObservable<string | null>(MAINNET_MARKET),
      detectNetwork: vi.fn(async () => "mainnet"),
      ensureWallet: vi.fn(async () => WALLET),
      read: vi.fn(async () => null),
      invoke: vi.fn(async (
        _operation: string,
        _args: unknown[],
        options: { onTransactionSent?: (txid: string) => void },
      ) => {
        options.onTransactionSent?.(TXID);
        return { txid: TXID };
      }),
      invokeWithPayment: vi.fn(),
      invokeMultiple: vi.fn(),
    };
    const app = createMiniAppFramework({
      services: { chain, notify: {} },
      launchContext: { appId: "miniapp-aa-market-hub", network: "neo-n3-mainnet" },
      t: (key: string) => key,
    } as never, { appId: "miniapp-aa-market-hub", storagePrefix: "aa-market-storage:" });
    const hub = useAAMarketHub({ app, t: (key) => key });
    hub.accountIdHash.set(ACCOUNT);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("storage disabled", "SecurityError");
    });
    vi.spyOn(globalThis, "fetch").mockImplementation(async (_input, init) => {
      const request = JSON.parse(String(init?.body)) as {
        id: unknown;
        method: string;
        params: [string, string];
      };
      if (request.method === "getapplicationlog") {
        return new Response(JSON.stringify({
          jsonrpc: "2.0",
          id: request.id,
          result: { executions: [{ vmstate: "FAULT", notifications: [] }] },
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      const operation = request.params[1];
      if (operation === "getBackupOwner") {
        return rpcStackResponse(request.id, chainHashStack(WALLET_HASH));
      }
      if (operation === "isMarketEscrowActive") {
        return rpcStackResponse(request.id, { type: "Boolean", value: false });
      }
      if (operation === "getListingCount") {
        return rpcStackResponse(request.id, { type: "Integer", value: "0" });
      }
      throw new Error(`Unexpected operation: ${operation}`);
    });

    await expect(hub.submitCreateListing()).resolves.toEqual({ status: "fault", txid: TXID });
    expect(hub.recoveryStorageHealthy.get()).toBe(false);
    expect(hub.lastError.get()).toBe("transactionFaulted");
    expect(hub.pendingOperation.get()).toBeNull();
    hub.cleanup();
  });
});

describe("AA Market Hub application-log recovery", () => {
  it("extracts the exact AA Core event only from HALT and keeps FAULT terminal", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({
      result: {
        executions: [{
          vmstate: "HALT",
          notifications: [{
            contract: MAINNET_CORE,
            eventname: "MarketEscrowCancelled",
            state: {
              type: "Array",
              value: [{ type: "ByteString", value: "IiIiIiIiIiIiIiIiIiIiIiIiIiI=" }],
            },
          }],
        }],
      },
    }), { status: 200, headers: { "Content-Type": "application/json" } }));

    const outcome = await readAAMarketTransactionOutcome(cancelPending());
    expect(outcome.state).toBe("halt");
    expect(findAAMarketNotification(
      outcome,
      MAINNET_CORE,
      "MarketEscrowCancelled",
    )).not.toBeNull();
    expect(findAAMarketNotification(
      outcome,
      MAINNET_CORE,
      "MarketEscrowSettled",
    )).toBeNull();

    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({
      result: { executions: [{ vmstate: "FAULT", notifications: [] }] },
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    await expect(readAAMarketTransactionOutcome(cancelPending())).resolves.toEqual({
      state: "fault",
      notifications: [],
    });
  });
});
