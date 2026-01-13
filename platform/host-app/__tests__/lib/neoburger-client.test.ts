/**
 * NeoBurger Client Tests
 */

import { getNeoBurgerStats, getNeoBurgerContract } from "@/lib/neoburger/client";

// Mock fetch
global.fetch = jest.fn();

describe("NeoBurger Client", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return correct contract address for mainnet", () => {
    expect(getNeoBurgerContract("neo-n3-mainnet")).toBe("0x48c40d4666f93408be1bef038b6722404d9a4c2a");
  });

  it("should return null for non-Neo N3 chains", () => {
    expect(getNeoBurgerContract("neox-mainnet")).toBeNull();
    expect(getNeoBurgerContract("ethereum-mainnet")).toBeNull();
  });

  it("should fetch stats from mainnet", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      json: () =>
        Promise.resolve({
          result: {
            state: "HALT",
            stack: [{ type: "Integer", value: "1250000000000000" }],
          },
        }),
    });

    const stats = await getNeoBurgerStats("neo-n3-mainnet");

    expect(stats).toHaveProperty("apr");
    expect(stats).toHaveProperty("totalStakedFormatted");
    expect(global.fetch).toHaveBeenCalled();
  });

  it("should throw on RPC error", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      json: () =>
        Promise.resolve({
          error: { message: "RPC error" },
        }),
    });

    await expect(getNeoBurgerStats("neo-n3-mainnet")).rejects.toThrow("RPC error");
  });

  it("should throw on contract execution failure", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      json: () =>
        Promise.resolve({
          result: { state: "FAULT" },
        }),
    });

    await expect(getNeoBurgerStats("neo-n3-mainnet")).rejects.toThrow("Contract execution failed");
  });
});
