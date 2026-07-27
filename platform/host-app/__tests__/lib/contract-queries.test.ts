import { MINIAPP_CONTRACTS } from "@shared/constants/rpc";

describe("host chain contract queries", () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it("maps LastSurvivor getCurrentRound to host stats", async () => {
    const invokeRead = jest.fn().mockResolvedValue({
      stack: [
        {
          type: "Map",
          value: [
            {
              key: { type: "ByteString", value: Buffer.from("pot").toString("base64") },
              value: { type: "Integer", value: "300000000" },
            },
            {
              key: { type: "ByteString", value: Buffer.from("totalKeys").toString("base64") },
              value: { type: "Integer", value: "21" },
            },
            {
              key: { type: "ByteString", value: Buffer.from("remainingTime").toString("base64") },
              value: { type: "Integer", value: "1800" },
            },
          ],
        },
      ],
    });

    jest.doMock("../../lib/chain/rpc-client", () => ({
      invokeRead,
    }));

    const { getContractStats } = require("../../lib/chain/contract-queries");
    const stats = await getContractStats(
      MINIAPP_CONTRACTS.testnet["miniapp-last-survivor"],
      "testnet",
      "miniapp-last-survivor",
    );

    expect(invokeRead).toHaveBeenCalledWith(
      MINIAPP_CONTRACTS.testnet["miniapp-last-survivor"],
      "getCurrentRound",
      [],
      "testnet",
    );
    expect(stats).toEqual({
      totalValueLocked: "3",
      totalTransactions: 21,
      uniqueUsers: 0,
    });
  });

  it("sources getFlagshipApps contract hashes from the shared registry", () => {
    jest.doMock("../../lib/chain/rpc-client", () => ({
      invokeRead: jest.fn(),
    }));

    const { getFlagshipApps } = require("../../lib/chain/contract-queries");

    for (const network of ["mainnet", "testnet"] as const) {
      const apps = getFlagshipApps(network);
      // Every resolved flagship hash equals the shared registry entry (no
      // hardcoded literals can drift from the deployed standalone contracts).
      expect(apps["miniapp-last-survivor"].contract).toBe(
        MINIAPP_CONTRACTS[network]["miniapp-last-survivor"],
      );
      expect(apps["miniapp-self-loan"].contract).toBe(
        MINIAPP_CONTRACTS[network]["miniapp-self-loan"],
      );
      expect(apps["miniapp-fogplay"].contract).toBe(
        MINIAPP_CONTRACTS[network]["miniapp-fogplay"],
      );
      expect(apps["miniapp-gasbox"].contract).toBe(
        MINIAPP_CONTRACTS[network]["miniapp-gasbox"],
      );
    }
  });

  it("reads SelfLoan aggregate getters from the standalone ABI", async () => {
    const integerStack = (value: string) => ({ stack: [{ type: "Integer", value }] });
    const invokeRead = jest
      .fn()
      .mockImplementation((_hash: string, method: string) => {
        switch (method) {
          case "totalLoans":
            return Promise.resolve(integerStack("4"));
          case "totalBorrowed":
            return Promise.resolve(integerStack("500000000"));
          case "totalRepaid":
            return Promise.resolve(integerStack("200000000"));
          case "pool":
            return Promise.resolve(integerStack("900000000"));
          default:
            return Promise.resolve({ stack: [] });
        }
      });

    jest.doMock("../../lib/chain/rpc-client", () => ({ invokeRead }));

    const { getContractStats } = require("../../lib/chain/contract-queries");
    const stats = await getContractStats(
      MINIAPP_CONTRACTS.mainnet["miniapp-self-loan"],
      "mainnet",
      "miniapp-self-loan",
    );

    expect(invokeRead).toHaveBeenCalledWith(
      MINIAPP_CONTRACTS.mainnet["miniapp-self-loan"],
      "totalLoans",
      [],
      "mainnet",
    );
    expect(stats).toEqual({
      totalValueLocked: "9",
      totalTransactions: 4,
      uniqueUsers: 0,
    });
  });

  it("reads FogPlay bankroll/lastBetId from the standalone CoinFlipV2 ABI", async () => {
    const integerStack = (value: string) => ({ stack: [{ type: "Integer", value }] });
    const invokeRead = jest
      .fn()
      .mockImplementation((_hash: string, method: string) => {
        if (method === "bankroll") return Promise.resolve(integerStack("1000000000"));
        if (method === "lastBetId") return Promise.resolve(integerStack("42"));
        return Promise.resolve({ stack: [] });
      });

    jest.doMock("../../lib/chain/rpc-client", () => ({ invokeRead }));

    const { getCoinFlipState } = require("../../lib/chain/contract-queries");
    const state = await getCoinFlipState(
      MINIAPP_CONTRACTS.mainnet["miniapp-fogplay"],
      "mainnet",
    );

    expect(invokeRead).toHaveBeenCalledWith(
      MINIAPP_CONTRACTS.mainnet["miniapp-fogplay"],
      "bankroll",
      [],
      "mainnet",
    );
    expect(state).toEqual({
      bankroll: 1000000000n,
      lastBetId: 42n,
    });
  });
});
