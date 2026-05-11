describe("host chain contract queries", () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it("maps doomsday platform stats to host stats", async () => {
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
              key: { type: "ByteString", value: Buffer.from("totalKeysSold").toString("base64") },
              value: { type: "Integer", value: "21" },
            },
            {
              key: { type: "ByteString", value: Buffer.from("totalPlayers").toString("base64") },
              value: { type: "Integer", value: "7" },
            },
          ],
        },
      ],
    });

    jest.doMock("../../lib/chain/rpc-client", () => ({
      invokeRead,
    }));

    const { getContractStats } = require("../../lib/chain/contract-queries");
    const stats = await getContractStats("0x1021e9e5c17285e706c293a39c525de13100ed92", "testnet", "miniapp-last-survivor");

    expect(stats).toEqual({
      totalValueLocked: "3",
      totalTransactions: 21,
      uniqueUsers: 7,
    });
  });

  it("uses deployed platform contracts for testnet platform-backed flagship apps", async () => {
    jest.doMock("../../lib/chain/rpc-client", () => ({
      invokeRead: jest.fn(),
    }));

    const { getFlagshipApps } = require("../../lib/chain/contract-queries");
    const apps = getFlagshipApps("testnet");

    expect(apps["miniapp-last-survivor"].contract).toBe("0x740671b10330ef6669ab8b2724437eb8d5e7a34c");
    expect(apps["miniapp-self-loan"].contract).toBe("0x39d4584ddb0731e48e611647931993ee033bf373");
  });

  it("parses platform map return values for coin flip bet limits", async () => {
    const entry = (key: string, value: string) => ({
      key: { type: "ByteString", value: Buffer.from(key).toString("base64") },
      value: { type: "Integer", value },
    });
    const invokeRead = jest.fn().mockResolvedValue({
      stack: [
        {
          type: "Map",
          value: [
            entry("maxBet", "10000000000"),
            entry("dailyLimit", "100000000000"),
            entry("cooldownMs", "30000"),
            entry("maxConsecutive", "20"),
          ],
        },
      ],
    });

    jest.doMock("../../lib/chain/rpc-client", () => ({
      invokeRead,
    }));

    const { getCoinFlipState } = require("../../lib/chain/contract-queries");
    const state = await getCoinFlipState();

    expect(invokeRead).toHaveBeenCalledWith(
      "0xa7840a8d5404bbe297a00756a29cc267d6fa6cc7",
      "getCoinFlipBetLimits",
      [{ type: "String", value: "miniapp-fogplay" }],
      "mainnet",
    );
    expect(state).toEqual({
      maxBet: 10000000000n,
      dailyLimit: 100000000000n,
      cooldownSeconds: 30000n,
      maxConsecutive: 20n,
    });
  });
});
