import {
  calculateOneGateVaultLuckPercent,
  claimOneGateVaultReward,
  createInMemoryOneGateVaultRepository,
  createSupabaseOneGateVaultRepository,
  createTxProxyOneGateVaultPaymentService,
  formatFixed8Gas,
  hashClaimKey,
  normalizeClaimKey,
  normalizeOneGateVaultHash160,
  type OneGateVaultPaymentService,
} from "@/lib/onegate-vault";

const CLAIM_KEY = "ogv_test_key_1234567890";
const WALLET = "NWMjW2tnPKSuSdHme5uYk86vFm8hyoHeJ3";
const OTHER_WALLET = "NRmZ6Ysfy4UmpgBqLJ41q6wPjFUu6wTVrL";

function hash160NotificationValue(value: string): string {
  return Buffer.from(
    normalizeOneGateVaultHash160(value).replace(/^0x/i, ""),
    "hex",
  )
    .reverse()
    .toString("base64");
}

function successfulGasTransferAppLog(toAddress: string, amountFixed8: string) {
  return {
    executions: [
      {
        trigger: "Application",
        vmstate: "HALT",
        stack: [{ type: "Boolean", value: true }],
        notifications: [
          {
            contract: "0xd2a4cff31913016155e38e474a2c06d08be276cf",
            eventname: "Transfer",
            state: {
              type: "Array",
              value: [
                {
                  type: "ByteString",
                  value: hash160NotificationValue(
                    "0x***REMOVED***01234567",
                  ),
                },
                { type: "ByteString", value: hash160NotificationValue(toAddress) },
                { type: "Integer", value: amountFixed8 },
              ],
            },
          },
        ],
      },
    ],
  };
}

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

  it("rotates the txproxy request id when the same wallet retries a failed payout", async () => {
    const nowSpy = jest
      .spyOn(Date, "now")
      .mockReturnValueOnce(1000)
      .mockReturnValueOnce(2000);
    const randomInt = jest.fn().mockReturnValue(300000000n);
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
      sendGas: jest
        .fn()
        .mockRejectedValueOnce(new Error("GAS transfer returned false"))
        .mockResolvedValueOnce({
          txHash: "0xretry",
          status: "paid",
        }),
    };

    await expect(
      claimOneGateVaultReward(
        { claimKey: CLAIM_KEY, address: WALLET, network: "testnet" },
        { repository, payment, keyPepper: "pepper", randomInt },
      ),
    ).rejects.toMatchObject({ code: "PAYMENT_FAILED" });

    const retry = await claimOneGateVaultReward(
      { claimKey: CLAIM_KEY, address: WALLET, network: "testnet" },
      { repository, payment, keyPepper: "pepper", randomInt },
    );

    expect(randomInt).toHaveBeenCalledTimes(1);
    expect(payment.sendGas).toHaveBeenCalledTimes(2);
    const firstRequest = (payment.sendGas as jest.Mock).mock.calls[0][0].requestId;
    const retryRequest = (payment.sendGas as jest.Mock).mock.calls[1][0].requestId;
    expect(retryRequest).not.toBe(firstRequest);
    expect(retry).toMatchObject({
      status: "paid",
      amountFixed8: "300000000",
      txHash: "0xretry",
      requestId: retryRequest,
    });

    nowSpy.mockRestore();
  });

  it("keeps the same QR claim key isolated between testnet and mainnet", async () => {
    const keyHash = hashClaimKey(CLAIM_KEY, "pepper");
    const repository = createInMemoryOneGateVaultRepository({
      campaigns: [
        {
          id: "pool-testnet",
          network: "testnet",
          status: "active",
          minAmountFixed8: "100000000",
          maxAmountFixed8: "100000000",
          remainingAmountFixed8: "100000000",
          maxClaims: 1,
          claimedCount: 0,
        },
        {
          id: "pool-mainnet",
          network: "mainnet",
          status: "active",
          minAmountFixed8: "200000000",
          maxAmountFixed8: "200000000",
          remainingAmountFixed8: "200000000",
          maxClaims: 1,
          claimedCount: 0,
        },
      ],
      claimKeys: [
        {
          keyHash,
          campaignId: "pool-testnet",
          network: "testnet",
          status: "unused",
        },
        {
          keyHash,
          campaignId: "pool-mainnet",
          network: "mainnet",
          status: "unused",
        },
      ],
    });
    const payment: OneGateVaultPaymentService = {
      sendGas: jest
        .fn()
        .mockResolvedValueOnce({ txHash: "0xtestnet", status: "paid" })
        .mockResolvedValueOnce({ txHash: "0xmainnet", status: "paid" }),
    };

    const testnet = await claimOneGateVaultReward(
      { claimKey: CLAIM_KEY, address: WALLET, network: "testnet" },
      { repository, payment, keyPepper: "pepper" },
    );
    const mainnet = await claimOneGateVaultReward(
      { claimKey: CLAIM_KEY, address: WALLET, network: "mainnet" },
      { repository, payment, keyPepper: "pepper" },
    );

    expect(payment.sendGas).toHaveBeenCalledTimes(2);
    expect(testnet).toMatchObject({
      network: "testnet",
      amount: "1",
      txHash: "0xtestnet",
    });
    expect(mainnet).toMatchObject({
      network: "mainnet",
      amount: "2",
      txHash: "0xmainnet",
    });
  });

  it("requires the scanned pool and OneGate app id to match the server-side claim key", async () => {
    const repository = createInMemoryOneGateVaultRepository({
      campaigns: [
        {
          id: "pool-001",
          appId: "miniapp-gas-lucky-pool",
          oneGateAppId: "23",
          network: "mainnet",
          status: "active",
          minAmountFixed8: "100000000",
          maxAmountFixed8: "100000000",
          remainingAmountFixed8: "300000000",
          maxClaims: 3,
          claimedCount: 0,
        },
      ],
      claimKeys: [
        {
          keyHash: hashClaimKey(CLAIM_KEY, "pepper"),
          campaignId: "pool-001",
          claimKeyId: "ogv_001",
          network: "mainnet",
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

    await expect(
      claimOneGateVaultReward(
        {
          claimKey: CLAIM_KEY,
          address: WALLET,
          network: "mainnet",
          poolId: "pool-999",
          oneGateAppId: "23",
          appId: "miniapp-gas-lucky-pool",
        },
        {
          repository,
          payment,
          keyPepper: "pepper",
          randomInt: () => 100000000n,
        },
      ),
    ).rejects.toMatchObject({ code: "POOL_MISMATCH" });

    await expect(
      claimOneGateVaultReward(
        {
          claimKey: CLAIM_KEY,
          address: WALLET,
          network: "mainnet",
          poolId: "pool-001",
          appId: "miniapp-gas-lucky-pool",
        },
        {
          repository,
          payment,
          keyPepper: "pepper",
          randomInt: () => 100000000n,
        },
      ),
    ).rejects.toMatchObject({ code: "ONEGATE_APP_ID_REQUIRED" });

    await expect(
      claimOneGateVaultReward(
        {
          claimKey: CLAIM_KEY,
          address: WALLET,
          network: "mainnet",
          poolId: "pool-001",
          oneGateAppId: "wrong",
          appId: "miniapp-gas-lucky-pool",
        },
        {
          repository,
          payment,
          keyPepper: "pepper",
          randomInt: () => 100000000n,
        },
      ),
    ).rejects.toMatchObject({ code: "ONEGATE_APP_ID_MISMATCH" });

    const result = await claimOneGateVaultReward(
      {
        claimKey: CLAIM_KEY,
        address: WALLET,
        network: "mainnet",
        poolId: "pool-001",
        oneGateAppId: "23",
        appId: "miniapp-gas-lucky-pool",
      },
      {
        repository,
        payment,
        keyPepper: "pepper",
        randomInt: () => 100000000n,
      },
    );

    expect(payment.sendGas).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      status: "paid",
      amount: "1",
      txHash: "0xreward",
    });
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

  it("uses the network-scoped Morpheus edge txproxy path when a dedicated Vault tx proxy URL is not configured", async () => {
    const originalFetch = global.fetch;
    const originalEdgeApiBase = process.env.EDGE_API_BASE;
    const originalMorpheusEdgeBase = process.env.MORPHEUS_EDGE_BASE;
    const originalTxProxyUrl = process.env.TX_PROXY_URL;
    const originalVaultTxProxyUrl = process.env.ONEGATE_VAULT_TX_PROXY_URL;
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      text: jest.fn().mockResolvedValue(
        JSON.stringify({
          tx_hash: "0xedge",
          app_log: successfulGasTransferAppLog(WALLET, "100000000"),
        }),
      ),
    });
    global.fetch = fetchMock as never;
    delete process.env.TX_PROXY_URL;
    delete process.env.ONEGATE_VAULT_TX_PROXY_URL;
    delete process.env.EDGE_API_BASE;
    process.env.MORPHEUS_EDGE_BASE = "https://edge.example";

    try {
      const payment = createTxProxyOneGateVaultPaymentService({
        rewardSource: "0x***REMOVED***01234567",
      });
      const result = await payment.sendGas({
        requestId: "req-1",
        network: "mainnet",
        toAddress: WALLET,
        amountFixed8: "100000000",
      });

      expect(result).toEqual({ txHash: "0xedge", status: "paid" });
      expect(fetchMock).toHaveBeenCalledWith(
        "https://edge.example/mainnet/txproxy/invoke",
        expect.objectContaining({ method: "POST" }),
      );
      const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
      expect(JSON.parse(String(request.body))).toMatchObject({
        request_id: "req-1",
        network: "mainnet",
        intent: "gas-sponsor",
        method: "transfer",
        contract_hash: "0xd2a4cff31913016155e38e474a2c06d08be276cf",
        params: [
          {
            type: "Hash160",
            value: normalizeOneGateVaultHash160(
              "0x***REMOVED***01234567",
            ),
          },
          { type: "Hash160", value: normalizeOneGateVaultHash160(WALLET) },
          { type: "Integer", value: "100000000" },
          { type: "Any", value: null },
        ],
      });
    } finally {
      global.fetch = originalFetch;
      if (originalEdgeApiBase === undefined) delete process.env.EDGE_API_BASE;
      else process.env.EDGE_API_BASE = originalEdgeApiBase;
      if (originalMorpheusEdgeBase === undefined)
        delete process.env.MORPHEUS_EDGE_BASE;
      else process.env.MORPHEUS_EDGE_BASE = originalMorpheusEdgeBase;
      if (originalTxProxyUrl === undefined) delete process.env.TX_PROXY_URL;
      else process.env.TX_PROXY_URL = originalTxProxyUrl;
      if (originalVaultTxProxyUrl === undefined) {
        delete process.env.ONEGATE_VAULT_TX_PROXY_URL;
      } else {
        process.env.ONEGATE_VAULT_TX_PROXY_URL = originalVaultTxProxyUrl;
      }
    }
  });

  it("keeps txproxy payouts submitted until a GAS app log confirms payment", async () => {
    const originalFetch = global.fetch;
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      text: jest.fn().mockResolvedValue(
        JSON.stringify({
          tx_hash: "0xedge",
          status: "paid",
        }),
      ),
    });
    global.fetch = fetchMock as never;

    try {
      const payment = createTxProxyOneGateVaultPaymentService({
        txProxyUrl: "https://edge.example/txproxy",
        rewardSource: "0x***REMOVED***01234567",
      });
      const result = await payment.sendGas({
        requestId: "req-1",
        network: "testnet",
        toAddress: WALLET,
        amountFixed8: "100000000",
      });

      expect(result).toEqual({ txHash: "0xedge", status: "submitted" });
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("uses the campaign reward source for the GAS transfer sender", async () => {
    const originalFetch = global.fetch;
    const originalTxProxyUrl = process.env.ONEGATE_VAULT_TX_PROXY_URL;
    const originalRewardSource = process.env.ONEGATE_VAULT_REWARD_SOURCE;
    const originalRewardSourceHash =
      process.env.ONEGATE_VAULT_REWARD_SOURCE_HASH;
    const originalRewardWif = process.env.ONEGATE_VAULT_REWARD_WIF;
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      text: jest.fn().mockResolvedValue(
        JSON.stringify({
          tx_hash: "0xedge",
          app_log: successfulGasTransferAppLog(WALLET, "100000000"),
        }),
      ),
    });
    global.fetch = fetchMock as never;
    process.env.ONEGATE_VAULT_TX_PROXY_URL = "https://edge.example/txproxy";
    delete process.env.ONEGATE_VAULT_REWARD_SOURCE;
    delete process.env.ONEGATE_VAULT_REWARD_SOURCE_HASH;
    delete process.env.ONEGATE_VAULT_REWARD_WIF;

    try {
      const payment = createTxProxyOneGateVaultPaymentService();
      await payment.sendGas({
        requestId: "req-1",
        network: "testnet",
        toAddress: WALLET,
        amountFixed8: "100000000",
        rewardSource: "0x***REMOVED***01234567",
      });

      const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
      expect(JSON.parse(String(request.body))).toMatchObject({
        params: [
          {
            type: "Hash160",
            value: normalizeOneGateVaultHash160(
              "0x***REMOVED***01234567",
            ),
          },
          { type: "Hash160", value: normalizeOneGateVaultHash160(WALLET) },
          { type: "Integer", value: "100000000" },
          { type: "Any", value: null },
        ],
      });
    } finally {
      global.fetch = originalFetch;
      if (originalTxProxyUrl === undefined)
        delete process.env.ONEGATE_VAULT_TX_PROXY_URL;
      else process.env.ONEGATE_VAULT_TX_PROXY_URL = originalTxProxyUrl;
      if (originalRewardSource === undefined)
        delete process.env.ONEGATE_VAULT_REWARD_SOURCE;
      else process.env.ONEGATE_VAULT_REWARD_SOURCE = originalRewardSource;
      if (originalRewardSourceHash === undefined)
        delete process.env.ONEGATE_VAULT_REWARD_SOURCE_HASH;
      else
        process.env.ONEGATE_VAULT_REWARD_SOURCE_HASH =
          originalRewardSourceHash;
      if (originalRewardWif === undefined)
        delete process.env.ONEGATE_VAULT_REWARD_WIF;
      else process.env.ONEGATE_VAULT_REWARD_WIF = originalRewardWif;
    }
  });

  it("fails closed when no Vault reward source is configured", async () => {
    const originalTxProxyUrl = process.env.ONEGATE_VAULT_TX_PROXY_URL;
    const originalRewardSource = process.env.ONEGATE_VAULT_REWARD_SOURCE;
    const originalRewardSourceHash =
      process.env.ONEGATE_VAULT_REWARD_SOURCE_HASH;
    const originalRewardWif = process.env.ONEGATE_VAULT_REWARD_WIF;
    process.env.ONEGATE_VAULT_TX_PROXY_URL = "https://edge.example/txproxy";
    delete process.env.ONEGATE_VAULT_REWARD_SOURCE;
    delete process.env.ONEGATE_VAULT_REWARD_SOURCE_HASH;
    delete process.env.ONEGATE_VAULT_REWARD_WIF;

    try {
      const payment = createTxProxyOneGateVaultPaymentService();
      await expect(
        payment.sendGas({
          requestId: "req-1",
          network: "testnet",
          toAddress: WALLET,
          amountFixed8: "100000000",
        }),
      ).rejects.toMatchObject({
        code: "PAYMENT_NOT_CONFIGURED",
      });
    } finally {
      if (originalTxProxyUrl === undefined)
        delete process.env.ONEGATE_VAULT_TX_PROXY_URL;
      else process.env.ONEGATE_VAULT_TX_PROXY_URL = originalTxProxyUrl;
      if (originalRewardSource === undefined)
        delete process.env.ONEGATE_VAULT_REWARD_SOURCE;
      else process.env.ONEGATE_VAULT_REWARD_SOURCE = originalRewardSource;
      if (originalRewardSourceHash === undefined)
        delete process.env.ONEGATE_VAULT_REWARD_SOURCE_HASH;
      else
        process.env.ONEGATE_VAULT_REWARD_SOURCE_HASH =
          originalRewardSourceHash;
      if (originalRewardWif === undefined)
        delete process.env.ONEGATE_VAULT_REWARD_WIF;
      else process.env.ONEGATE_VAULT_REWARD_WIF = originalRewardWif;
    }
  });

  it("surfaces non-JSON txproxy failures with HTTP status for payout diagnosis", async () => {
    const originalFetch = global.fetch;
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: jest.fn().mockResolvedValue("<html>Not Found</html>"),
    });
    global.fetch = fetchMock as never;

    try {
      const payment = createTxProxyOneGateVaultPaymentService({
        txProxyUrl: "https://edge.example/txproxy",
        rewardSource: "0x***REMOVED***01234567",
      });

      await expect(
        payment.sendGas({
          requestId: "req-1",
          network: "testnet",
          toAddress: WALLET,
          amountFixed8: "100000000",
        }),
      ).rejects.toMatchObject({
        code: "PAYMENT_FAILED",
        message:
          "tx-proxy rejected OneGate Vault payout (404): Not Found",
      });
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("rejects txproxy transactions whose GAS transfer returned false", async () => {
    const originalFetch = global.fetch;
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      text: jest.fn().mockResolvedValue(
        JSON.stringify({
          tx_hash:
            "0x03ccf25f24885badb04486b00b7ba21f557e44f81f9404a9514d86eae5a87c03",
          app_log: {
            executions: [
              {
                trigger: "Application",
                vmstate: "HALT",
                stack: [{ type: "Boolean", value: false }],
                notifications: [],
              },
            ],
          },
        }),
      ),
    });
    global.fetch = fetchMock as never;

    try {
      const payment = createTxProxyOneGateVaultPaymentService({
        txProxyUrl: "https://edge.example/txproxy",
        rewardSource: "0x***REMOVED***01234567",
      });

      await expect(
        payment.sendGas({
          requestId: "req-1",
          network: "testnet",
          toAddress: WALLET,
          amountFixed8: "100000000",
        }),
      ).rejects.toMatchObject({
        code: "PAYMENT_FAILED",
        message: "GAS transfer returned false",
      });
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("reserves Supabase claims through the hardened v3 RPC with server entropy and launch identity", async () => {
    const rpc = jest.fn().mockResolvedValue({
      data: [
        {
          key_hash: "hash",
          campaign_id: "campaign-1",
          network: "testnet",
          status: "pending",
          wallet_address: WALLET,
          amount_fixed8: "300000000",
          tx_hash: null,
          request_id: "req-1",
        },
      ],
      error: null,
    });
    const repository = createSupabaseOneGateVaultRepository({ rpc } as never);

    await repository.reserveClaim({
      keyHash: "hash",
      address: WALLET,
      network: "testnet",
      requestId: "req-1",
      poolId: "pool-001",
      oneGateAppId: "23",
      appId: "miniapp-gas-lucky-pool",
      randomInt: () => 100000000n,
    });

    expect(rpc).toHaveBeenCalledWith(
      "onegate_vault_reserve_claim_v3",
      expect.objectContaining({
        p_key_hash: "hash",
        p_wallet_address: WALLET,
        p_network: "testnet",
        p_request_id: "req-1",
        p_random_u64: expect.stringMatching(/^\d+$/),
        p_pool_id: "pool-001",
        p_onegate_app_id: "23",
        p_app_id: "miniapp-gas-lucky-pool",
      }),
    );
  });

  it("guards Supabase claim status transitions by request id and current status", async () => {
    const chain = {
      update: jest.fn(() => chain),
      eq: jest.fn(() => chain),
      in: jest.fn(() => chain),
      select: jest.fn(() => chain),
      maybeSingle: jest
        .fn()
        .mockResolvedValue({ data: { key_hash: "hash" }, error: null }),
    };
    const repository = createSupabaseOneGateVaultRepository({
      from: jest.fn(() => chain),
    } as never);

    await repository.markSubmitted({
      keyHash: "hash",
      network: "testnet",
      requestId: "req-1",
      txHash: "0xreward",
    });

    expect(chain.eq).toHaveBeenCalledWith("key_hash", "hash");
    expect(chain.eq).toHaveBeenCalledWith("network", "testnet");
    expect(chain.eq).toHaveBeenCalledWith("request_id", "req-1");
    expect(chain.in).toHaveBeenCalledWith("status", [
      "pending",
      "submitted",
      "failed",
    ]);
    expect(chain.select).toHaveBeenCalledWith("key_hash,network");

    await repository.markFailed({
      keyHash: "hash",
      network: "testnet",
      requestId: "req-1",
      errorMessage: "GAS transfer returned false",
    });

    expect(chain.in).toHaveBeenCalledWith("status", [
      "pending",
      "submitted",
      "failed",
    ]);
  });
});
