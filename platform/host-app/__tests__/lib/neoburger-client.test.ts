/**
 * NeoBurger Client Tests
 */

import { getNeoBurgerStats, getNeoBurgerContract } from "@/lib/neoburger/client";

// Mock fetch
global.fetch = jest.fn();

describe("NeoBurger Client", () => {
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it("should return correct contract address for mainnet", () => {
    expect(getNeoBurgerContract("neo-n3-mainnet")).toBe("0x48c40d4666f93408be1bef038b6722404d9a4c2a");
  });

  it("should return correct contract address for testnet", () => {
    expect(getNeoBurgerContract("neo-n3-testnet")).toBe("0x833b3d6854d5bc44cab40ab9b46560d25c72562c");
  });

  it("should return null for non-Neo N3 chains", () => {
    expect(getNeoBurgerContract("neox-mainnet")).toBeNull();
    expect(getNeoBurgerContract("ethereum-mainnet")).toBeNull();
  });

  it("should fetch stats from mainnet", async () => {
    const rpcResponse = {
      json: () =>
        Promise.resolve({
          result: {
            state: "HALT",
            stack: [{ type: "Integer", value: "1250000000000000" }],
          },
        }),
    };
    const priceResponse = {
      ok: true,
      json: () =>
        Promise.resolve([
          { symbol: "NEO", usd_price: 10 },
          { symbol: "GAS", usd_price: 5 },
        ]),
    };
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes("flamingo.finance")) {
        return Promise.resolve(priceResponse);
      }
      return Promise.resolve(rpcResponse);
    });

    const stats = await getNeoBurgerStats("neo-n3-mainnet");

    expect(stats).toHaveProperty("apr");
    expect(stats).toHaveProperty("totalStakedFormatted");
    expect(global.fetch).toHaveBeenCalled();
  });

  it("should throw on RPC error", async () => {
    const rpcResponse = {
      json: () =>
        Promise.resolve({
          error: { message: "RPC error" },
        }),
    };
    const priceResponse = {
      ok: true,
      json: () =>
        Promise.resolve([
          { symbol: "NEO", usd_price: 10 },
          { symbol: "GAS", usd_price: 5 },
        ]),
    };
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes("flamingo.finance")) {
        return Promise.resolve(priceResponse);
      }
      return Promise.resolve(rpcResponse);
    });

    await expect(getNeoBurgerStats("neo-n3-mainnet")).rejects.toThrow("RPC error");
  });

  it("should throw on contract execution failure", async () => {
    const rpcResponse = {
      json: () =>
        Promise.resolve({
          result: { state: "FAULT" },
        }),
    };
    const priceResponse = {
      ok: true,
      json: () =>
        Promise.resolve([
          { symbol: "NEO", usd_price: 10 },
          { symbol: "GAS", usd_price: 5 },
        ]),
    };
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes("flamingo.finance")) {
        return Promise.resolve(priceResponse);
      }
      return Promise.resolve(rpcResponse);
    });

    await expect(getNeoBurgerStats("neo-n3-mainnet")).rejects.toThrow("Contract execution failed");
  });
});
