import { describe, expect, it, vi } from "vitest";

import {
  buyAddressListing,
  createAddressListing,
  getDefaultMarketHash,
  listAddressListings,
} from "../../aa-market-hub/src/utils/aa-market";
import {
  relativeTime,
  statusLabel,
} from "../../aa-market-hub/src/components/ListingCard";
import { createMiniAppFramework } from "@shared/react";
import { createObservable } from "@shared/react/context";
import { addressToScriptHash } from "@shared/utils/neo";

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
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      value = value.replace(`{${k}}`, String(v));
    }
  }
  return value;
};

describe("AA Market Hub utils", () => {
  it("defaults the market hash to the canonical AAAddressMarket per network", () => {
    // The app's manifest declares both; the runtime registry lacks the testnet
    // entry, so the manifest fallback must still resolve a normalized hash.
    expect(getDefaultMarketHash("mainnet")).toBe(
      "0xae7afe3a85ab08bfd1d4907b35ae8b80c75b3a69",
    );
    expect(getDefaultMarketHash("testnet")).toBe(
      "0x8dbd4cf6fc47afc013e7fd7128d028db2985bddf",
    );
  });

  it("localizes listing status, with an unknown fallback", () => {
    expect(statusLabel("active", t)).toBe("active");
    expect(statusLabel("sold", t)).toBe("sold");
    expect(statusLabel("cancelled", t)).toBe("cancelled");
    expect(statusLabel("weird", t)).toBe("unknown");
  });

  it("renders contract timestamps as localized relative time", () => {
    const now = Math.floor(Date.now() / 1000);
    expect(relativeTime("0", t)).toBe("");
    expect(relativeTime("", t)).toBe("");
    expect(relativeTime(String(now - 10), t)).toBe("just now");
    expect(relativeTime(String(now - 120), t)).toBe("2m ago");
    expect(relativeTime(String(now - 7200), t)).toBe("2h ago");
    expect(relativeTime(String(now - 172800), t)).toBe("2d ago");
  });
});

// ---------------------------------------------------------------------------
// Framework-lane behavior locks (Wave 5 migration): the market reads/writes
// now ride app.chain (readRaw / enumerate / invoke / invokeMultiple). These
// tests pin the user-visible contracts the raw wallet-sdk lane had — decoded
// listing shapes, FAULT error branching, and the exact wallet payloads
// (scopes-16 create signer, transfer-then-settle batch with the Any/null
// transfer data argument).
// ---------------------------------------------------------------------------

const ADDRESS = "NR3E4D8NUXh3zhbf5ZkAp3rTxWbQqNih32";
const MY_HASH = addressToScriptHash(ADDRESS);
const OTHER_SELLER = "0xaabbccddeeff00112233445566778899aabbccdd";
const AA_CORE = "0x1234567890abcdef1234567890abcdef12345678";
const ACCOUNT_1 = "0x0102030405060708090a0b0c0d0e0f1011121314";
const ACCOUNT_2 = "0x14131211100f0e0d0c0b0a090807060504030201";
const MARKET = "0x8dbd4cf6fc47afc013e7fd7128d028db2985bddf";

/**
 * UInt160 ByteStrings reach the app from the parsed host lane as CHAIN-order
 * 0x-hex; the decoders must flip them back to the display order the raw lane
 * produced.
 */
function chainOrderHex(displayHex: string): string {
  const bare = displayHex.replace(/^0x/i, "");
  let out = "";
  for (let index = bare.length; index > 0; index -= 2) {
    out += bare.slice(index - 2, index);
  }
  return `0x${out}`;
}

type MarketApp = Parameters<typeof listAddressListings>[0];

function makeMarketApp(chainOverrides: Record<string, unknown> = {}) {
  const chain = {
    address: createObservable<string | null>(ADDRESS),
    ensureWallet: vi.fn(async () => ADDRESS),
    read: vi.fn(async () => null),
    invoke: vi.fn(async () => ({ txid: "0xinvoke", success: true })),
    invokeWithPayment: vi.fn(async () => ({ txid: "0xpay", success: true })),
    invokeMultiple: vi.fn(async () => ({ txid: "0xmulti", success: true })),
    ...chainOverrides,
  };
  const notify = { success: vi.fn(), error: vi.fn() };
  const ctx = {
    services: { chain, notify },
    t: (key: string) => key,
  } as unknown as Parameters<typeof createMiniAppFramework>[0];
  const app = createMiniAppFramework(ctx, { appId: "miniapp-aa-market-hub" });
  return { app: app as MarketApp, chain, notify };
}

/** Parsed getListing row in contract field order. */
function listingRow(
  id: number,
  seller: string,
  account: string,
  price: number,
  title: string,
  metadataUri = "",
): unknown[] {
  return [
    id,
    chainOrderHex(AA_CORE),
    chainOrderHex(account),
    chainOrderHex(seller),
    price,
    title,
    metadataUri,
    1, // active
    "", // unsold: empty buyer ByteString parses to ""
    1700000000,
    1700000000,
  ];
}

describe("AA Market Hub framework read lane", () => {
  it("decodes parsed listing rows byte-identically to the raw-stack decoder", async () => {
    const read = vi.fn(async (operation: string, args?: { value: unknown }[]) => {
      if (operation === "getListingCount") return 2;
      if (operation === "getListing") {
        return String(args?.[0]?.value) === "2"
          ? listingRow(2, MY_HASH, ACCOUNT_2, 200000000, "My listing", "ipfs://meta")
          : listingRow(1, OTHER_SELLER, ACCOUNT_1, 150000000, "Starter account");
      }
      if (operation === "getPendingPaymentOf") {
        return String(args?.[0]?.value) === "2" ? 25000000 : 0;
      }
      return null;
    });
    const { app } = makeMarketApp({ read });

    const result = await listAddressListings(app, MARKET, ADDRESS);

    expect(result.total).toBe(2);
    expect(result.truncated).toBe(false);
    // Newest-first ordering, same as the hand-rolled sort.
    expect(result.listings.map((l) => l.id)).toEqual(["2", "1"]);

    const [mine, other] = result.listings;
    expect(mine).toMatchObject({
      id: "2",
      aaContractHash: AA_CORE,
      accountIdHash: ACCOUNT_2,
      seller: MY_HASH.toLowerCase(),
      buyer: "",
      priceRaw: "200000000",
      priceGas: "2",
      title: "My listing",
      metadataUri: "ipfs://meta",
      statusCode: 1,
      status: "active",
      createdAt: "1700000000",
      updatedAt: "1700000000",
      myPendingPayment: "25000000",
      isMine: true,
    });
    expect(other).toMatchObject({
      id: "1",
      seller: OTHER_SELLER,
      priceGas: "1.5",
      title: "Starter account",
      myPendingPayment: "0",
      isMine: false,
    });
    // Bare display-order hex, exactly what the raw decoder exposed.
    expect(mine.sellerScriptHash).toBe(MY_HASH.replace(/^0x/i, "").toLowerCase());
  });

  it("keeps the FAULTed count read on the error path (no silent empty board)", async () => {
    // The parsed host lane renders a FAULTed read as null; the legacy lane
    // threw the sanitized generic. The load flow must still reject so the
    // loadListingsFailed toast branch fires.
    const { app } = makeMarketApp({ read: vi.fn(async () => null) });
    await expect(listAddressListings(app, MARKET, ADDRESS)).rejects.toThrow(
      "Contract operation failed",
    );
  });
});

describe("AA Market Hub framework write lane", () => {
  it("creates listings with the scopes-16 allowedContracts escrow signer", async () => {
    const { app, chain } = makeMarketApp();

    const result = await createAddressListing(app, MARKET, ADDRESS, {
      aaContractHash: AA_CORE,
      accountIdHash: ACCOUNT_1,
      priceGas: "1.5",
      title: " Starter ",
      metadataUri: "",
    });

    expect(result).toEqual({ txid: "0xinvoke" });
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
        signers: [
          {
            account: ADDRESS,
            scopes: 16,
            allowedContracts: [MARKET, AA_CORE],
          },
        ],
      },
    );
  });

  it("buys via ONE transfer-then-settle batch with the Any/null transfer data arg", async () => {
    const { app, chain } = makeMarketApp();
    const myHashNormalized = MY_HASH.toLowerCase();

    const result = await buyAddressListing(
      app,
      MARKET,
      ADDRESS,
      { id: "7", priceRaw: "150000000" },
      {},
    );

    expect(result).toEqual({ txid: "0xmulti" });
    expect(chain.invokeMultiple).toHaveBeenCalledTimes(1);
    const [calls, options] = (chain.invokeMultiple as ReturnType<typeof vi.fn>)
      .mock.calls[0] as [
      { scriptHash: string; operation: string; args: unknown[] }[],
      { signers?: unknown[] },
    ];
    expect(calls).toHaveLength(2);
    expect(calls[0].operation).toBe("transfer");
    expect(calls[0].args).toEqual([
      { type: "Hash160", value: myHashNormalized },
      { type: "Hash160", value: MARKET },
      { type: "Integer", value: "150000000" },
      { type: "Any", value: null },
    ]);
    expect(calls[1]).toEqual({
      scriptHash: MARKET,
      operation: "settleListing",
      args: [
        { type: "Integer", value: "7" },
        { type: "Hash160", value: myHashNormalized },
        { type: "Hash160", value: myHashNormalized },
      ],
    });
    // The buy signer stays CalledByEntry (scopes 1); notify:'silent' is
    // consumed by the framework and never reaches the host.
    expect(options).toEqual({ signers: [{ account: ADDRESS, scopes: 1 }] });
  });

  it("surfaces a FAULTed batch as a sanitized throw without toasting (silent lane)", async () => {
    const { app, notify } = makeMarketApp({
      invokeMultiple: vi.fn(async () => ({
        txid: "0x1",
        state: "FAULT",
        exception: "listing not active",
      })),
    });

    await expect(
      buyAddressListing(app, MARKET, ADDRESS, { id: "7", priceRaw: "1" }, {}),
    ).rejects.toThrow("listing not active");
    // The buy operation owns the toast — the silent chain lane must not.
    expect(notify.error).not.toHaveBeenCalled();
  });
});
