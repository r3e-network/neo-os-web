import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservable } from "../react/context";
import type { ChainService } from "../services/ChainService";
import { createMiniAppFramework } from "../react";
import {
  fetchOwnedDomains,
  ownerValueToAddress,
  scriptHashToAddress,
} from "../../neo-ns/src/hooks/nnsRpc";
import { useNeoNS } from "../../neo-ns/src/hooks/useNeoNS";

const NNS_CONTRACT = "0x50ac1c37690cc2cfc594472833cf57505d5f46de";
// Live fixture: ownerOf(neo.neo) on mainnet returns ByteString base64
// "/aZJk4ZO/HBPcIzZOT3vZ8ezLqY=" → little-endian bytes fda64993…, which encode
// to this N-address (verified against the deployed contract).
const OWNER_LE_HEX = "0xfda64993864efc704f708cd9393def67c7b32ea6";
const OWNER_ADDRESS = "Nj39M97Rk2e23JiULBBMQmvpcnKaRHqxFf";

function hexToBase64(hex: string): string {
  const bytes = hex.match(/.{2}/g)?.map((h) => parseInt(h, 16)) ?? [];
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

describe("nnsRpc address encoding", () => {
  it("scriptHashToAddress encodes a little-endian hash160 into its N-address", () => {
    expect(scriptHashToAddress(OWNER_LE_HEX)).toBe(OWNER_ADDRESS);
    // Without the 0x prefix too.
    expect(scriptHashToAddress(OWNER_LE_HEX.slice(2))).toBe(OWNER_ADDRESS);
  });

  it("scriptHashToAddress rejects non-20-byte input", () => {
    expect(scriptHashToAddress("0x1234")).toBe("");
    expect(scriptHashToAddress("")).toBe("");
  });

  it("ownerValueToAddress normalizes every ownerOf read shape to the N-address", () => {
    // parseByteLike's 0x-hex fallback (little-endian) — the shape the bug surfaced.
    expect(ownerValueToAddress(OWNER_LE_HEX)).toBe(OWNER_ADDRESS);
    // Bare 40-char hex.
    expect(ownerValueToAddress(OWNER_LE_HEX.slice(2))).toBe(OWNER_ADDRESS);
    // Raw base64 ByteString value.
    expect(ownerValueToAddress(hexToBase64(OWNER_LE_HEX.slice(2)))).toBe(OWNER_ADDRESS);
    // Already an N-address — passthrough.
    expect(ownerValueToAddress(OWNER_ADDRESS)).toBe(OWNER_ADDRESS);
    // Empty stays empty (no spurious address).
    expect(ownerValueToAddress("")).toBe("");
  });
});

// Build a minimal RPC mock keyed by JSON-RPC method, mirroring the live shapes:
//   getnep11balances → owned token ids (hex), under the NNS asset hash
//   invokefunction(properties) → Map with an "expiration" Integer
//   invokefunction(resolve)    → ByteString target (or no value)
function mockNnsRpc(options: {
  tokens: Array<{ idHex: string; expiration: number; target?: string }>;
}) {
  return vi.fn(async (_url: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? "{}")) as {
      method: string;
      params: unknown[];
    };
    if (body.method === "getnep11balances") {
      return {
        json: async () => ({
          result: {
            balance: [
              {
                assethash: NNS_CONTRACT,
                tokens: options.tokens.map((token) => ({
                  tokenid: token.idHex,
                  amount: "1",
                })),
              },
            ],
          },
        }),
      } as Response;
    }
    if (body.method === "invokefunction") {
      const operation = body.params[1] as string;
      const args = body.params[2] as Array<{ value: string }>;
      if (operation === "properties") {
        const tokenIdBase64 = args[0].value;
        const idHex = Array.from(atob(tokenIdBase64))
          .map((c) => c.charCodeAt(0).toString(16).padStart(2, "0"))
          .join("");
        const token = options.tokens.find((entry) => entry.idHex === idHex);
        return {
          json: async () => ({
            result: {
              state: "HALT",
              stack: [
                {
                  type: "Map",
                  value: [
                    {
                      key: { type: "ByteString", value: btoa("name") },
                      value: { type: "ByteString", value: btoa(Buffer.from(idHex, "hex").toString("utf8")) },
                    },
                    {
                      key: { type: "ByteString", value: btoa("expiration") },
                      value: { type: "Integer", value: String(token?.expiration ?? 0) },
                    },
                  ],
                },
              ],
            },
          }),
        } as Response;
      }
      if (operation === "resolve") {
        const name = args[0].value;
        const token = options.tokens.find(
          (entry) => Buffer.from(entry.idHex, "hex").toString("utf8") === name,
        );
        return {
          json: async () => ({
            result: {
              state: "HALT",
              stack: [token?.target ? { type: "ByteString", value: btoa(token.target) } : { type: "Any" }],
            },
          }),
        } as Response;
      }
    }
    return { json: async () => ({ result: {} }) } as Response;
  });
}

describe("fetchOwnedDomains (tokensOf iterator bypass)", () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("resolves owned .neo domains from getnep11balances with expiry and target", async () => {
    globalThis.fetch = mockNnsRpc({
      tokens: [
        { idHex: "6e656f2e6e656f", expiration: 1979732129690 }, // neo.neo
        { idHex: Buffer.from("alice.neo").toString("hex"), expiration: 1900000000000, target: OWNER_ADDRESS },
      ],
    }) as unknown as typeof fetch;

    const domains = await fetchOwnedDomains(OWNER_ADDRESS, "neo-n3-mainnet", NNS_CONTRACT);

    expect(domains).toHaveLength(2);
    const neo = domains.find((d) => d.name === "neo.neo");
    expect(neo?.expiration).toBe(1979732129690);
    const alice = domains.find((d) => d.name === "alice.neo");
    expect(alice?.target).toBe(OWNER_ADDRESS);
  });

  it("returns [] for an address that owns no NNS tokens", async () => {
    globalThis.fetch = vi.fn(async () => ({
      json: async () => ({ result: { balance: [] } }),
    })) as unknown as typeof fetch;

    const domains = await fetchOwnedDomains(OWNER_ADDRESS, "neo-n3-mainnet", NNS_CONTRACT);
    expect(domains).toEqual([]);
  });

  it("returns [] without an address (no wallet) and never calls the RPC", async () => {
    const spy = vi.fn();
    globalThis.fetch = spy as unknown as typeof fetch;
    const domains = await fetchOwnedDomains("", "neo-n3-mainnet", NNS_CONTRACT);
    expect(domains).toEqual([]);
    expect(spy).not.toHaveBeenCalled();
  });
});

// Minimal ChainService stand-in for the hook. The hook reads chain.address,
// chain.detectNetwork (for fetchOwnedDomains) and chain.read (search/renew).
function makeChainMock(address: string | null) {
  const addr = createObservable<string | null>(address);
  return {
    address: addr,
    detectNetwork: vi.fn(async () => "neo-n3-mainnet"),
    read: vi.fn(async () => null),
    invoke: vi.fn(async () => ({ success: true })),
    ensureWallet: vi.fn(async () => address ?? ""),
  } as unknown as ChainService;
}

function t(key: string) {
  return key;
}

// Wrap a mock ChainService in the MiniApp framework SDK, mirroring how main.tsx
// passes ctx.framework to the hook. Arg builders + raw passthroughs preserve the
// same recorded calls the direct-chain hook made.
function makeApp(chain: ChainService) {
  return createMiniAppFramework(
    { services: { chain }, t } as never,
    { appId: "miniapp-neo-ns" },
  );
}

describe("useNeoNS.loadMyDomains populates from the iterator bypass", () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("loads the wallet's domains (the empty-list regression is fixed)", async () => {
    globalThis.fetch = mockNnsRpc({
      tokens: [{ idHex: "6e656f2e6e656f", expiration: 1979732129690 }],
    }) as unknown as typeof fetch;

    const chain = makeChainMock(OWNER_ADDRESS);
    const ns = useNeoNS({ app: makeApp(chain), t });

    await ns.loadMyDomains();

    const domains = ns.myDomains.get();
    expect(domains).toHaveLength(1);
    expect(domains[0].name).toBe("neo.neo");
    expect(domains[0].owner).toBe(OWNER_ADDRESS);
    expect(domains[0].expiry).toBe(1979732129690);
    expect(ns.domainCount.get()).toBe(1);
  });

  it("clears the list with no connected wallet", async () => {
    const chain = makeChainMock(null);
    const ns = useNeoNS({ app: makeApp(chain), t });
    await ns.loadMyDomains();
    expect(ns.myDomains.get()).toEqual([]);
  });
});

describe("useNeoNS.getRenewPrice discloses the renewal cost", () => {
  it("reads getPrice for the domain's base-name length in GAS", async () => {
    const chain = makeChainMock(OWNER_ADDRESS);
    (chain.read as ReturnType<typeof vi.fn>).mockResolvedValueOnce(200000000); // 2 GAS in datoshi
    const ns = useNeoNS({ app: makeApp(chain), t });

    const price = await ns.getRenewPrice({ name: "alice.neo", owner: OWNER_ADDRESS, expiry: 0 });

    expect(price).toBe(2);
    // getPrice is called with the base-name length (5 for "alice"), not the full
    // ".neo". arg.integer normalizes the length to its string form ("5"), the
    // same on-chain Integer the raw {value: 5} produced.
    expect(chain.read).toHaveBeenCalledWith(
      "getPrice",
      [{ type: "Integer", value: "5" }],
      { scriptHash: NNS_CONTRACT },
    );
  });
});
