import { describe, expect, it, vi } from "vitest";

import {
  CLAIM_KEY,
  ONEGATE_OWNER,
  OWNER,
  addressToScriptHash,
  keyLaunch,
  launch,
  makeApp,
  t,
  useGasLuckyPool,
} from "./gas-lucky-pool.logic.test-utils";

describe("OneGate Vault runtime logic - status polling and pool actions", () => {
  it("polls scanned key status with pool and OneGate identity when payout is submitted asynchronously", async () => {
    const originalFetch = globalThis.fetch;
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: "submitted",
          claimKey: CLAIM_KEY,
          address: OWNER,
          requestId: "ogv_req",
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: "paid",
          claimKey: CLAIM_KEY,
          address: OWNER,
          amountFixed8: "4900000000",
          luckPercent: "98.00",
          txHash: "0xpaid",
          requestId: "ogv_req",
        }),
      });
    globalThis.fetch = fetchMock as any;
    (window as any).OneGateDapiProvider = {
      getAccounts: vi.fn().mockResolvedValue([{ address: OWNER }]),
    };
    const chain = {
      ensureWallet: vi
        .fn()
        .mockRejectedValue(new Error("generic wallet unavailable")),
      invoke: vi.fn(),
    };
    const pool = useGasLuckyPool({
      app: makeApp(chain as any),
      launchContext: keyLaunch(),
      t,
    });

    try {
      await pool.claimPool();
    } finally {
      globalThis.fetch = originalFetch;
    }

    expect(chain.ensureWallet).not.toHaveBeenCalled();
    const statusUrl = new URL(
      fetchMock.mock.calls[1][0] as string,
      "https://neomini.app",
    );
    expect(statusUrl.pathname).toBe("/api/onegate-vault/status");
    expect(statusUrl.searchParams.get("claimKey")).toBe(CLAIM_KEY);
    expect(statusUrl.searchParams.get("address")).toBe(OWNER);
    expect(statusUrl.searchParams.get("network")).toBe("testnet");
    expect(statusUrl.searchParams.get("poolId")).toBe("pool-001");
    expect(statusUrl.searchParams.get("oneGateAppId")).toBe("23");
    expect(statusUrl.searchParams.get("appId")).toBe("miniapp-gas-lucky-pool");
    expect(pool.lastSuccessType.get()).toBe("claim");
    expect(pool.lastClaimAmount.get()).toBe(4900000000n);
    expect(pool.lastClaimLuckPercent.get()).toBe("98.00");
    expect(pool.lastTxid.get()).toBe("0xpaid");
    expect(pool.claimProgress.get()).toBe("paid");
  });

  it("claims the pool id supplied by a OneGate scan and records the congratulations state", async () => {
    const chain = {
      ensureWallet: vi.fn().mockResolvedValue(OWNER),
      invoke: vi.fn().mockResolvedValue({
        txid: "0xclaim",
        success: true,
        event: {
          state: [
            { value: "miniapp-gas-lucky-pool" },
            { value: "42" },
            { value: OWNER },
            { value: "350000000" },
          ],
        },
      }),
      readArray: vi.fn().mockResolvedValue([]),
      listEvents: vi.fn().mockResolvedValue([]),
    };
    const pool = useGasLuckyPool({
      app: makeApp(chain as any),
      launchContext: launch("42"),
      t,
    });

    await pool.claimPool();

    expect(chain.invoke).toHaveBeenCalledWith(
      "claimRangeGasPool",
      [
        { type: "String", value: "miniapp-gas-lucky-pool" },
        { type: "Integer", value: "42" },
        { type: "Hash160", value: OWNER },
      ],
      { waitForEvent: "RangeGasPoolClaimed", waitTimeoutMs: 30_000 },
    );
    expect(pool.lastSuccessType.get()).toBe("claim");
    expect(pool.lastClaimPoolId.get()).toBe("42");
    expect(pool.lastClaimAmount.get()).toBe(350000000n);
    expect(pool.lastTxid.get()).toBe("0xclaim");
  });

  it("lets the pool creator recover remaining GAS and records the refund amount", async () => {
    const chain = {
      invoke: vi.fn().mockResolvedValue({
        txid: "0xrefund",
        success: true,
        event: {
          state: [
            { value: "miniapp-gas-lucky-pool" },
            { value: "42" },
            { value: OWNER },
            { value: "625000000" },
          ],
        },
      }),
      readArray: vi
        .fn()
        .mockResolvedValue([
          OWNER,
          "1000000000",
          "100000000",
          "500000000",
          "5",
          "3",
          "0",
          "",
          "0",
          "1767225600",
          false,
        ]),
    };
    const pool = useGasLuckyPool({
      app: makeApp(chain as any),
      launchContext: launch("42"),
      t,
    });

    await pool.refundPool("42");

    expect(chain.invoke).toHaveBeenCalledWith(
      "refundRangeGasPool",
      [
        { type: "String", value: "miniapp-gas-lucky-pool" },
        { type: "Integer", value: "42" },
      ],
      { waitForEvent: "RangeGasPoolRefunded", waitTimeoutMs: 30_000 },
    );
    expect(pool.lastSuccessType.get()).toBe("refund");
    expect(pool.lastRefundPoolId.get()).toBe("42");
    expect(pool.lastRefundAmount.get()).toBe(625000000n);
    expect(pool.lastTxid.get()).toBe("0xrefund");
  });

  it("lets the pool creator top up an active pool with more GAS", async () => {
    const chain = {
      ensureWallet: vi.fn().mockResolvedValue(OWNER),
      invokeWithPayment: vi.fn().mockResolvedValue({
        txid: "0xfund",
        success: true,
        event: {
          state: [
            { value: "miniapp-gas-lucky-pool" },
            { value: "42" },
            { value: OWNER },
            { value: "250000000" },
            { value: "1250000000" },
            { value: "875000000" },
          ],
        },
      }),
      readArray: vi
        .fn()
        .mockResolvedValue([
          OWNER,
          "1250000000",
          "100000000",
          "500000000",
          "5",
          "2",
          "875000000",
          "",
          "0",
          "1767225600",
          true,
        ]),
      listEvents: vi.fn().mockResolvedValue([]),
    };
    const pool = useGasLuckyPool({
      app: makeApp(chain as any),
      launchContext: launch("42"),
      t,
    });

    await pool.topUpPool({ poolId: "42", amount: "2.5" });

    expect(chain.invokeWithPayment).toHaveBeenCalledWith(
      "250000000",
      "gas-lucky-pool:fund:42",
      "fundRangeGasPool",
      [
        { type: "String", value: "miniapp-gas-lucky-pool" },
        { type: "Integer", value: "42" },
        { type: "Hash160", value: OWNER },
        { type: "Integer", value: "250000000" },
      ],
      { waitForEvent: "RangeGasPoolFunded", waitTimeoutMs: 30_000 },
    );
    expect(pool.lastSuccessType.get()).toBe("fund");
    expect(pool.lastFundPoolId.get()).toBe("42");
    expect(pool.lastFundAmount.get()).toBe(250000000n);
    expect(pool.lastTxid.get()).toBe("0xfund");
  });
});
