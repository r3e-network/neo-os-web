import {
  calculateOneGateVaultLuckPercent,
  claimOneGateVaultReward,
  createInMemoryOneGateVaultRepository,
  formatFixed8Gas,
  hashClaimKey,
  normalizeClaimKey,
  type OneGateVaultPaymentService,
} from "@/lib/onegate-vault";

const CLAIM_KEY = "ogv_test_key_1234567890";
const WALLET = "NWMjW2tnPKSuSdHme5uYk86vFm8hyoHeJ3";
const OTHER_WALLET = "NRmZ6Ysfy4UmpgBqLJ41q6wPjFUu6wTVrL";

describe("OneGate Vault off-chain claim engine", () => {
  it("normalizes QR claim keys without accepting unsafe payloads", () => {
    expect(normalizeClaimKey(` ${CLAIM_KEY} `)).toBe(CLAIM_KEY);
    expect(normalizeClaimKey("pool:42")).toBe("pool:42");
    expect(normalizeClaimKey("../secret")).toBe("");
    expect(normalizeClaimKey("short")).toBe("");
  });

  it("reserves a claim key, sends GAS once, and returns the same transfer for duplicate claims", async () => {
    const repository = createInMemoryOneGateVaultRepository({
      campaigns: [
        {
          id: "campaign-1",
          network: "testnet",
          status: "active",
          minAmountFixed8: "100000000",
          maxAmountFixed8: "500000000",
          remainingAmountFixed8: "1000000000",
          maxClaims: 5,
          claimedCount: 0,
        },
      ],
      claimKeys: [
        {
          keyHash: hashClaimKey(CLAIM_KEY, "pepper"),
          campaignId: "campaign-1",
          network: "testnet",
          status: "unused",
        },
      ],
    });
    const payment: OneGateVaultPaymentService = {
      sendGas: jest.fn().mockResolvedValue({
        txHash: "0xreward",
        status: "paid",
      }),
    };

    const first = await claimOneGateVaultReward(
      { claimKey: CLAIM_KEY, address: WALLET, network: "testnet" },
      { repository, payment, keyPepper: "pepper", randomInt: () => 250000000n },
    );
    const second = await claimOneGateVaultReward(
      { claimKey: CLAIM_KEY, address: WALLET, network: "testnet" },
      { repository, payment, keyPepper: "pepper", randomInt: () => 400000000n },
    );

    expect(payment.sendGas).toHaveBeenCalledTimes(1);
    expect(first).toMatchObject({
      status: "paid",
      amountFixed8: "250000000",
      amount: "2.5",
      luckPercent: "5.00",
      txHash: "0xreward",
    });
    expect(second).toEqual(first);
  });

  it("calculates luck percentile against the 1-50 GAS reward range", () => {
    expect(calculateOneGateVaultLuckPercent("100000000")).toBe("2.00");
    expect(calculateOneGateVaultLuckPercent("4900000000")).toBe("98.00");
    expect(calculateOneGateVaultLuckPercent("4999500000")).toBe("99.99");
    expect(calculateOneGateVaultLuckPercent("5000000000")).toBe("100.00");
  });

  it("rejects campaigns outside the 1-50 GAS reward range", async () => {
    const repository = createInMemoryOneGateVaultRepository({
      campaigns: [
        {
          id: "campaign-1",
          network: "testnet",
          status: "active",
          minAmountFixed8: "50000000",
          maxAmountFixed8: "5100000000",
          remainingAmountFixed8: "10000000000",
          maxClaims: 5,
          claimedCount: 0,
        },
      ],
      claimKeys: [
        {
          keyHash: hashClaimKey(CLAIM_KEY, "pepper"),
          campaignId: "campaign-1",
          network: "testnet",
          status: "unused",
        },
      ],
    });

    await expect(
      claimOneGateVaultReward(
        { claimKey: CLAIM_KEY, address: WALLET, network: "testnet" },
        {
          repository,
          payment: { sendGas: jest.fn() },
          keyPepper: "pepper",
          randomInt: () => 100000000n,
        },
      ),
    ).rejects.toMatchObject({ code: "INVALID_REWARD_RANGE" });
  });

  it("does not let a different wallet reuse another user's claim key", async () => {
    const repository = createInMemoryOneGateVaultRepository({
      campaigns: [
        {
          id: "campaign-1",
          network: "mainnet",
          status: "active",
          minAmountFixed8: "100000000",
          maxAmountFixed8: "100000000",
          remainingAmountFixed8: "100000000",
          maxClaims: 1,
          claimedCount: 0,
        },
      ],
      claimKeys: [
        {
          keyHash: hashClaimKey(CLAIM_KEY, "pepper"),
          campaignId: "campaign-1",
          network: "mainnet",
          status: "paid",
          walletAddress: WALLET,
          amountFixed8: "100000000",
          txHash: "0xpaid",
        },
      ],
    });

    await expect(
      claimOneGateVaultReward(
        { claimKey: CLAIM_KEY, address: OTHER_WALLET, network: "mainnet" },
        {
          repository,
          payment: { sendGas: jest.fn() },
          keyPepper: "pepper",
          randomInt: () => 100000000n,
        },
      ),
    ).rejects.toMatchObject({ code: "CLAIM_KEY_USED" });
  });

  it("formats fixed8 GAS without floating point drift", () => {
    expect(formatFixed8Gas("1")).toBe("0.00000001");
    expect(formatFixed8Gas("250000000")).toBe("2.5");
    expect(formatFixed8Gas("123456789")).toBe("1.23456789");
  });
});
