import { describe, expect, it, vi } from "vitest";

import { useGasLuckyPool } from "../../gas-lucky-pool/src/composables/useGasLuckyPool";
import { parseMiniAppLaunchContext } from "@shared/utils/launch-params";

const OWNER = "NWMjW2tnPKSuSdHme5uYk86vFm8hyoHeJ3";
const CLAIM_KEY = "ogv_test_key_1234567890";

function t(key: string) {
  return key;
}

function launch(poolId = "42") {
  return parseMiniAppLaunchContext(
    `https://neomini.app/miniapps/gas-lucky-pool/index.html?source=onegate&operation=claimPool&network=testnet&poolId=${poolId}`,
    "miniapp-gas-lucky-pool",
  );
}

function keyLaunch(claimKey = CLAIM_KEY) {
  return parseMiniAppLaunchContext(
    `https://neomini.app/miniapps/gas-lucky-pool/index.html?source=onegate&operation=claimPool&network=testnet&claimKey=${claimKey}`,
    "miniapp-gas-lucky-pool",
  );
}

describe("OneGate Vault runtime logic", () => {
  it("loads only recent pool and claim events instead of walking the whole event history", async () => {
    const chain = {
      readArray: vi.fn().mockResolvedValue([]),
      listEvents: vi.fn().mockResolvedValue([]),
      listAllEvents: vi.fn().mockRejectedValue(new Error("unbounded history fetch")),
    };
    const pool = useGasLuckyPool({ chain: chain as any, launchContext: launch(), t });

    await pool.loadAll();

    expect(chain.readArray).toHaveBeenCalledWith("getRangeGasPool", [
      { type: "String", value: "miniapp-gas-lucky-pool" },
      { type: "Integer", value: "42" },
    ]);
    expect(chain.listEvents).toHaveBeenCalledWith("RangeGasPoolCreated", { limit: 10 });
    expect(chain.listEvents).toHaveBeenCalledWith("RangeGasPoolClaimed", { limit: 12 });
    expect(chain.listAllEvents).not.toHaveBeenCalled();
  });

  it("does not show a startup error when read-only preload runs before a wallet is injected", async () => {
    const chain = {
      readArray: vi.fn().mockRejectedValue(new Error("Compatible Neo wallet not detected.")),
      listEvents: vi.fn().mockResolvedValue([]),
    };
    const pool = useGasLuckyPool({ chain: chain as any, launchContext: launch(), t });

    await pool.loadAll();

    expect(pool.currentPool.get()).toBeNull();
    expect(pool.lastError.get()).toBe("");
  });

  it("surfaces and withdraws prepaid GAS credit that remains after a failed create step", async () => {
    const chain = {
      ensureWallet: vi.fn().mockResolvedValue(OWNER),
      read: vi.fn().mockResolvedValue("250000000"),
      invoke: vi.fn().mockResolvedValue({ txid: "0xabc", success: true }),
    };
    const pool = useGasLuckyPool({ chain: chain as any, launchContext: launch(""), t });

    await pool.loadGasCredit();
    expect(pool.gasCredit.get()).toBe(250000000n);
    expect(pool.gasCreditGas.get()).toBe(2.5);

    await pool.withdrawGasCredit();

    expect(chain.invoke).toHaveBeenCalledWith(
      "withdrawGasCredit",
      [
        { type: "Hash160", value: OWNER },
        { type: "Integer", value: "250000000" },
      ],
      { waitForEvent: "GasCreditWithdrawn", waitTimeoutMs: 30_000 },
    );
  });

  it("keeps the OneGate claim URL aligned with the selected pool and network", () => {
    const chain = {};
    const pool = useGasLuckyPool({ chain: chain as any, launchContext: launch("42"), t });

    expect(pool.currentShareUrl.get()).toContain("operation=claimPool");
    expect(pool.currentShareUrl.get()).toContain("network=testnet");
    expect(pool.currentShareUrl.get()).toContain("poolId=42");

    pool.setPoolId("88");

    expect(pool.currentShareUrl.get()).toContain("poolId=88");
  });

  it("uses the scanned claim key in OneGate URLs instead of exposing an on-chain pool id", () => {
    const chain = {};
    const pool = useGasLuckyPool({ chain: chain as any, launchContext: keyLaunch(), t });

    expect(pool.currentShareUrl.get()).toContain("operation=claimPool");
    expect(pool.currentShareUrl.get()).toContain("network=testnet");
    expect(pool.currentShareUrl.get()).toContain(`claimKey=${CLAIM_KEY}`);
    expect(pool.currentShareUrl.get()).not.toContain("poolId=");

    pool.setClaimKey("ogv_next_key_abcdef");

    expect(pool.currentShareUrl.get()).toContain("claimKey=ogv_next_key_abcdef");
  });

  it("claims a scanned key through the backend and does not invoke the old pool contract", async () => {
    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "paid",
        claimKey: CLAIM_KEY,
        address: OWNER,
        amount: "3.5",
        amountFixed8: "350000000",
        luckPercent: "7.00",
        txHash: "0xreward",
      }),
    });
    globalThis.fetch = fetchMock as any;
    const chain = {
      ensureWallet: vi.fn().mockResolvedValue(OWNER),
      invoke: vi.fn(),
    };
    const pool = useGasLuckyPool({ chain: chain as any, launchContext: keyLaunch(), t });

    try {
      await pool.claimPool();
    } finally {
      globalThis.fetch = originalFetch;
    }

    expect(chain.invoke).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/onegate-vault/claim",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          claimKey: CLAIM_KEY,
          address: OWNER,
          network: "testnet",
        }),
      }),
    );
    expect(pool.lastSuccessType.get()).toBe("claim");
    expect(pool.lastClaimKey.get()).toBe(CLAIM_KEY);
    expect(pool.lastClaimAmount.get()).toBe(350000000n);
    expect(pool.lastClaimLuckPercent.get()).toBe("7.00");
    expect(pool.lastTxid.get()).toBe("0xreward");
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
    const pool = useGasLuckyPool({ chain: chain as any, launchContext: launch("42"), t });

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
      readArray: vi.fn().mockResolvedValue([
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
    const pool = useGasLuckyPool({ chain: chain as any, launchContext: launch("42"), t });

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
      readArray: vi.fn().mockResolvedValue([
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
    const pool = useGasLuckyPool({ chain: chain as any, launchContext: launch("42"), t });

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
