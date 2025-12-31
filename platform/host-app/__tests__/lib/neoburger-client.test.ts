/**
 * NeoBurger Client Tests
 */

import { getNeoBurgerStats, NEOBURGER_CONTRACT } from "@/lib/neoburger/client";

// Mock fetch
global.fetch = jest.fn();

describe("NeoBurger Client", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should export correct contract address", () => {
    expect(NEOBURGER_CONTRACT).toBe("0x48c40d4666f93408be1bef038b6722404d9a4c2a");
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

    const stats = await getNeoBurgerStats("mainnet");

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

    await expect(getNeoBurgerStats("mainnet")).rejects.toThrow("RPC error");
  });

  it("should throw on contract execution failure", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      json: () =>
        Promise.resolve({
          result: { state: "FAULT" },
        }),
    });

    await expect(getNeoBurgerStats("mainnet")).rejects.toThrow("Contract execution failed");
  });
});
