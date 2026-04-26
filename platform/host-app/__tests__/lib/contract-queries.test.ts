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

  it("parses struct return values for coin flip bet limits", async () => {
    const invokeRead = jest.fn().mockResolvedValue({
      stack: [
        {
          type: "Struct",
          value: [
            { type: "Integer", value: "10000000000" },
            { type: "Integer", value: "100000000000" },
            { type: "Integer", value: "30000" },
            { type: "Integer", value: "20" },
          ],
        },
      ],
    });

    jest.doMock("../../lib/chain/rpc-client", () => ({
      invokeRead,
    }));

    const { getCoinFlipState } = require("../../lib/chain/contract-queries");
    const state = await getCoinFlipState();

    expect(state).toEqual({
      maxBet: 10000000000n,
      dailyLimit: 100000000000n,
      cooldownSeconds: 30000n,
      maxConsecutive: 20n,
    });
  });
});
