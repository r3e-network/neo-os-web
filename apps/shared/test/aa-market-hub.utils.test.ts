import { afterEach, describe, expect, it, vi } from "vitest";

import { GAS_HASH } from "@shared/constants/rpc";
import { createMiniAppFramework } from "@shared/react";
import { createObservable } from "@shared/react/context";
import { addressToScriptHash } from "@shared/utils/neo";
import {
  buyAddressListing,
  createAddressListing,
  formatGasFractions,
  getDefaultAAContractHash,
  getDefaultMarketHash,
  listAddressListings,
  parseGasToFractions,
} from "../../aa-market-hub/src/utils/aa-market";
import {
  relativeTime,
  statusLabel,
} from "../../aa-market-hub/src/components/ListingCard";

const ADDRESS = "NR3E4D8NUXh3zhbf5ZkAp3rTxWbQqNih32";
const MY_HASH = addressToScriptHash(ADDRESS).toLowerCase();
const OTHER_SELLER = "0xaabbccddeeff00112233445566778899aabbccdd";
const AA_CORE = "0xdbf38e7b2117186bf7a5e17ead702322c0c5b6f2";
const ACCOUNT_1 = "0x0102030405060708090a0b0c0d0e0f1011121314";
const ACCOUNT_2 = "0x14131211100f0e0d0c0b0a090807060504030201";
const MARKET = "0x8dbd4cf6fc47afc013e7fd7128d028db2985bddf";
const INVOKE_TXID = `0x${"11".repeat(32)}`;
const MULTI_TXID = `0x${"22".repeat(32)}`;

const t = (key: string, params?: Record<string, string | number>) => {
  const map: Record<string, string> = {
    statusActive: "active",
    statusSold: "sold",
    statusCancelled: "cancelled",
    statusUnknown: "unknown",
    timeJustNow: "just now",
    timeMinutesAgo: "{count}m ago",
    timeHoursAgo: "{count}h ago",
    timeDaysAgo: "{count}d ago",
  };
  let value = map[key] ?? key;
  for (const [name, replacement] of Object.entries(params ?? {})) {
    value = value.replace(`{${name}}`, String(replacement));
  }
  return value;
};

type RpcRequest = {
  id: string | number;
  params: [string, string, unknown[]];
};

function integer(value: string | number) {
  return { type: "Integer", value: String(value) };
}

function byteString(value: string) {
  return { type: "ByteString", value: Buffer.from(value, "utf8").toString("base64") };
}

function hash160(displayHash: string) {
  const bytes = Buffer.from(displayHash.replace(/^0x/i, ""), "hex");
  return {
    type: "ByteString",
    value: Buffer.from([...bytes].reverse()).toString("base64"),
  };
}

function listingStack(
  id: number,
  seller: string,
  account: string,
  price: number,
  title: string,
  metadataUri = "",
) {
  return {
    type: "Struct",
    value: [
      integer(id),
      hash160(AA_CORE),
      hash160(account),
      hash160(seller),
      integer(price),
      byteString(title),
      byteString(metadataUri),
      integer(1),
      { type: "ByteString", value: "" },
      integer(1_700_000_000),
      integer(1_700_000_000),
    ],
  };
}

function rpcResponse(request: RpcRequest, stackItem: unknown, state = "HALT") {
  return {
    jsonrpc: "2.0",
    id: request.id,
    result: { state, stack: [stackItem] },
  };
}

function mockRpc(
  resolve: (request: RpcRequest) => ReturnType<typeof rpcResponse>,
) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (_input, init) => {
    const payload = JSON.parse(String(init?.body)) as RpcRequest | RpcRequest[];
    const body = Array.isArray(payload)
      ? payload.map((request) => resolve(request))
      : resolve(payload);
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });
}

type MarketApp = Parameters<typeof listAddressListings>[0];

function makeMarketApp(chainOverrides: Record<string, unknown> = {}) {
  const chain = {
    address: createObservable<string | null>(ADDRESS),
    contractAddress: createObservable<string | null>(MARKET),
    detectNetwork: vi.fn(async () => "testnet"),
    ensureWallet: vi.fn(async () => ADDRESS),
    read: vi.fn(async () => null),
    invoke: vi.fn(async () => ({ txid: INVOKE_TXID, success: true })),
    invokeWithPayment: vi.fn(async () => ({ txid: INVOKE_TXID, success: true })),
    invokeMultiple: vi.fn(async () => ({ txid: MULTI_TXID, success: true })),
    ...chainOverrides,
  };
  const notify = { success: vi.fn(), error: vi.fn() };
  const app = createMiniAppFramework({
    services: { chain, notify },
    launchContext: { appId: "miniapp-aa-market-hub", network: "neo-n3-testnet" },
    t: (key: string) => key,
  } as never, { appId: "miniapp-aa-market-hub" });
  return { app: app as MarketApp, chain, notify };
}

afterEach(() => vi.restoreAllMocks());

describe("AA Market Hub display and amount helpers", () => {
  it("pins the independent canonical market and AA Core pairs", () => {
    expect(getDefaultMarketHash("mainnet")).toBe(
      "0xae7afe3a85ab08bfd1d4907b35ae8b80c75b3a69",
    );
    expect(getDefaultMarketHash("testnet")).toBe(MARKET);
    expect(getDefaultAAContractHash("mainnet")).toBe(
      "0x0268a387913b250166ddec032b03332690a1ef78",
    );
    expect(getDefaultAAContractHash("testnet")).toBe(AA_CORE);
  });

  it("keeps GAS conversion integer-safe and enforces deployed price limits", () => {
    expect(parseGasToFractions("0.01")).toBe("1000000");
    expect(parseGasToFractions("1.50000001")).toBe("150000001");
    expect(parseGasToFractions("1000")).toBe("100000000000");
    expect(formatGasFractions("150000001")).toBe("1.50000001");
    expect(() => parseGasToFractions("0.00999999")).toThrow(/0\.01 and 1000 GAS/);
    expect(() => parseGasToFractions("1000.00000001")).toThrow(/0\.01 and 1000 GAS/);
    expect(() => parseGasToFractions("1.000000001")).toThrow(/8 decimal/);
  });

  it("localizes listing status and contract timestamps", () => {
    const now = Math.floor(Date.now() / 1000);
    expect(statusLabel("active", t)).toBe("active");
    expect(statusLabel("sold", t)).toBe("sold");
    expect(statusLabel("cancelled", t)).toBe("cancelled");
    expect(statusLabel("weird", t)).toBe("unknown");
    expect(relativeTime("0", t)).toBe("");
    expect(relativeTime(String(now - 120), t)).toBe("2m ago");
  });
});

describe("AA Market Hub wallet-free discovery", () => {
  it("decodes strict RPC rows newest-first without requiring a wallet", async () => {
    const fetchSpy = mockRpc((request) => {
      const [, operation, args] = request.params;
      if (operation === "getListingCount") return rpcResponse(request, integer(2));
      if (operation === "getListing") {
        const id = Number((args[0] as { value: string }).value);
        return rpcResponse(request, id === 2
          ? listingStack(2, MY_HASH, ACCOUNT_2, 200_000_000, "My listing", "ipfs://meta")
          : listingStack(1, OTHER_SELLER, ACCOUNT_1, 150_000_000, "Starter account"));
      }
      throw new Error(`Unexpected RPC operation: ${operation}`);
    });
    const { app } = makeMarketApp();

    const result = await listAddressListings(app, MARKET);

    expect(result).toMatchObject({ total: 2, truncated: false, failedReads: 0, source: "chain" });
    expect(result.listings.map((listing) => listing.id)).toEqual(["2", "1"]);
    expect(result.listings[0]).toMatchObject({
      aaContractHash: AA_CORE,
      accountIdHash: ACCOUNT_2,
      seller: MY_HASH,
      priceRaw: "200000000",
      priceGas: "2",
      title: "My listing",
      metadataUri: "ipfs://meta",
      status: "active",
      pendingPaymentKnown: true,
      myPendingPayment: "0",
      isMine: false,
      isCanonicalAA: true,
    });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("rejects a FAULTed count instead of presenting a fake empty board", async () => {
    mockRpc((request) => rpcResponse(request, integer(0), "FAULT"));
    const { app } = makeMarketApp();
    await expect(listAddressListings(app, MARKET)).rejects.toThrow(
      "AA market contract read failed",
    );
  });

  it("labels a partial board instead of silently pretending every row loaded", async () => {
    mockRpc((request) => {
      const [, operation, args] = request.params;
      if (operation === "getListingCount") return rpcResponse(request, integer(2));
      const id = Number((args[0] as { value: string }).value);
      return id === 2
        ? rpcResponse(request, listingStack(2, OTHER_SELLER, ACCOUNT_2, 200_000_000, "Visible"))
        : rpcResponse(request, integer(0), "FAULT");
    });
    const { app } = makeMarketApp();

    await expect(listAddressListings(app, MARKET)).resolves.toMatchObject({
      total: 2,
      failedReads: 1,
      source: "partial",
      listings: [{ id: "2" }],
    });
  });

  it("marks a payer read unknown instead of converting an RPC failure into a trusted zero", async () => {
    mockRpc((request) => {
      const [, operation] = request.params;
      if (operation === "getListingCount") return rpcResponse(request, integer(1));
      if (operation === "getListing") {
        return rpcResponse(request, listingStack(1, OTHER_SELLER, ACCOUNT_1, 150_000_000, "Starter"));
      }
      if (operation === "getPendingPaymentOf") return rpcResponse(request, integer(0), "FAULT");
      throw new Error(`Unexpected RPC operation: ${operation}`);
    });
    const { app } = makeMarketApp();

    const result = await listAddressListings(app, MARKET, ADDRESS);
    expect(result.listings[0]).toMatchObject({
      myPendingPayment: "0",
      pendingPaymentKnown: false,
    });
  });
});

describe("AA Market Hub direct-wallet writes", () => {
  it("creates a canonical AA listing with the scoped escrow signer", async () => {
    const onTransactionSent = vi.fn();
    const { app, chain } = makeMarketApp();

    await expect(createAddressListing(app, MARKET, ADDRESS, {
      aaContractHash: AA_CORE,
      accountIdHash: ACCOUNT_1,
      priceGas: "1.5",
      title: " Starter ",
      metadataUri: "",
    }, { onTransactionSent })).resolves.toEqual({ txid: INVOKE_TXID });

    expect(chain.invoke).toHaveBeenCalledWith(
      "createListing",
      [
        { type: "Hash160", value: AA_CORE },
        { type: "Hash160", value: ACCOUNT_1 },
        { type: "Integer", value: "150000000" },
        { type: "String", value: "Starter" },
        { type: "String", value: "" },
      ],
      {
        scriptHash: MARKET,
        signers: [{
          account: ADDRESS,
          scopes: 16,
          allowedContracts: [MARKET, AA_CORE],
        }],
        notify: "silent",
        onTransactionSent,
      },
    );
  });

  it("buys atomically with Integer listingId as GAS transfer data", async () => {
    const onTransactionSent = vi.fn();
    const { app, chain } = makeMarketApp();

    await expect(buyAddressListing(
      app,
      MARKET,
      ADDRESS,
      { id: "7", priceRaw: "150000000" },
      { onTransactionSent },
    )).resolves.toEqual({ txid: MULTI_TXID });

    expect(chain.invokeMultiple).toHaveBeenCalledTimes(1);
    const [calls, options] = (chain.invokeMultiple as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(calls).toEqual([
      {
        scriptHash: GAS_HASH,
        operation: "transfer",
        args: [
          { type: "Hash160", value: MY_HASH },
          { type: "Hash160", value: MARKET },
          { type: "Integer", value: "150000000" },
          { type: "Integer", value: "7" },
        ],
      },
      {
        scriptHash: MARKET,
        operation: "settleListing",
        args: [
          { type: "Integer", value: "7" },
          { type: "Hash160", value: MY_HASH },
          { type: "Hash160", value: MY_HASH },
        ],
      },
    ]);
    expect(options).toEqual({
      signers: [{ account: ADDRESS, scopes: 1 }],
      onTransactionSent,
    });
  });

  it("surfaces a FAULTed atomic batch without a false success toast", async () => {
    const { app, notify } = makeMarketApp({
      invokeMultiple: vi.fn(async () => ({
        txid: MULTI_TXID,
        state: "FAULT",
        exception: "listing not active",
      })),
    });

    await expect(buyAddressListing(
      app,
      MARKET,
      ADDRESS,
      { id: "7", priceRaw: "150000000" },
      {},
    )).rejects.toThrow("listing not active");
    expect(notify.success).not.toHaveBeenCalled();
  });
});
