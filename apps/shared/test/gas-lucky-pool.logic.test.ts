import { afterEach, describe, expect, it, vi } from "vitest";

import { useGasLuckyPool as useGasLuckyPoolImpl } from "../../gas-lucky-pool/src/composables/useGasLuckyPool";
import { parseMiniAppLaunchContext } from "@shared/utils/launch-params";
import { addressToScriptHash } from "@shared/utils/neo";
import { createMiniAppFramework } from "@shared/react";
import type { ChainService } from "@shared/services/ChainService";

const OWNER = "NWMjW2tnPKSuSdHme5uYk86vFm8hyoHeJ3";
const ONEGATE_OWNER = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";
const CLAIM_KEY = "ogv_test_key_1234567890";

function t(key: string) {
  return key;
}

/**
 * Wrap a mock chain in the framework SDK the composable consumes. The chain
 * layer is a behavior-preserving passthrough, so recorded calls are unchanged.
 */
function makeApp(chain: unknown) {
  return createMiniAppFramework(
    { services: { chain: chain as ChainService }, t } as never,
    { appId: "miniapp-gas-lucky-pool" },
  );
}

function useGasLuckyPool(
  options: Parameters<typeof useGasLuckyPoolImpl>[0],
) {
  return useGasLuckyPoolImpl({
    ...options,
    paidLaneEnabled: options.paidLaneEnabled ?? true,
    oneGateClaimEnabled: options.oneGateClaimEnabled ?? true,
  });
}

function launch(poolId = "42") {
  return parseMiniAppLaunchContext(
    `https://neomini.app/miniapps/gas-lucky-pool/index.html?source=onegate&operation=claimPool&network=testnet&poolId=${poolId}`,
    "miniapp-gas-lucky-pool",
  );
}

function keyLaunch(claimKey = CLAIM_KEY, extraParams = "") {
  return parseMiniAppLaunchContext(
    `https://onegate.space/app/23?key=${claimKey}&pool=pool-001&network=testnet${extraParams}`,
    "miniapp-gas-lucky-pool",
  );
}

describe("OneGate Vault runtime logic", () => {
  afterEach(() => {
    vi.useRealTimers();
    delete (window as any).OneGate;
    delete (window as any).OneGateDapiProvider;
    delete (window as any).Neo;
    delete (window as any).NEP21Provider;
    delete (window as any).NEP21Providers;
    delete (window as any).__OneGateBridge;
    delete (window as any).__OneGateDapiCallback;
    delete (window as any).webkit;
  });

  it("fails closed before wallet, chain, or backend work when the paid lane is disabled", async () => {
    const chain = {
      ensureWallet: vi.fn(),
      invoke: vi.fn(),
      invokeWithPayment: vi.fn(),
      readArray: vi.fn(),
      listEvents: vi.fn(),
    };
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const pool = useGasLuckyPool({
      app: makeApp(chain as any),
      launchContext: keyLaunch(),
      t,
      paidLaneEnabled: false,
      oneGateClaimEnabled: false,
    });

    await expect(
      pool.createPool({
        totalAmount: "10",
        minClaim: "1",
        maxClaim: "5",
        maxClaims: "5",
        expiryHours: "24",
      }),
    ).rejects.toThrow("gameFiMaintenanceBody");
    await expect(pool.claimPool({ claimKey: CLAIM_KEY })).rejects.toThrow(
      "gameFiMaintenanceBody",
    );
    await expect(pool.loadAll()).rejects.toThrow("gameFiMaintenanceBody");

    expect(chain.ensureWallet).not.toHaveBeenCalled();
    expect(chain.invoke).not.toHaveBeenCalled();
    expect(chain.invokeWithPayment).not.toHaveBeenCalled();
    expect(chain.readArray).not.toHaveBeenCalled();
    expect(chain.listEvents).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("loads only recent pool and claim events instead of walking the whole event history", async () => {
    const chain = {
      readArray: vi.fn().mockResolvedValue([]),
      listEvents: vi.fn().mockResolvedValue([]),
      listAllEvents: vi
        .fn()
        .mockRejectedValue(new Error("unbounded history fetch")),
    };
    const pool = useGasLuckyPool({
      app: makeApp(chain as any),
      launchContext: launch(),
      t,
    });

    await pool.loadAll();

    // The framework's readArray passthrough forwards the optional `options`
    // argument explicitly (undefined here); ChainService.readArray defaults it to
    // undefined, so the on-chain read is identical — only the recorded trailing
    // arg is added by the passthrough.
    expect(chain.readArray).toHaveBeenCalledWith(
      "getRangeGasPool",
      [
        { type: "String", value: "miniapp-gas-lucky-pool" },
        { type: "Integer", value: "42" },
      ],
      undefined,
    );
    expect(chain.listEvents).toHaveBeenCalledWith("RangeGasPoolCreated", {
      limit: 10,
    });
    expect(chain.listEvents).toHaveBeenCalledWith("RangeGasPoolClaimed", {
      limit: 12,
    });
    expect(chain.listAllEvents).not.toHaveBeenCalled();
  });

  it("does not show a startup error when read-only preload runs before a wallet is injected", async () => {
    const chain = {
      readArray: vi
        .fn()
        .mockRejectedValue(new Error("Compatible Neo wallet not detected.")),
      listEvents: vi.fn().mockResolvedValue([]),
    };
    const pool = useGasLuckyPool({
      app: makeApp(chain as any),
      launchContext: launch(),
      t,
    });

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
    const pool = useGasLuckyPool({
      app: makeApp(chain as any),
      launchContext: launch(""),
      t,
    });

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
    const pool = useGasLuckyPool({
      app: makeApp(chain as any),
      launchContext: launch("42"),
      t,
    });

    const initialUrl = new URL(pool.currentShareUrl.get());
    expect(initialUrl.origin + initialUrl.pathname).toBe(
      "https://onegate.space/app/23",
    );
    expect(initialUrl.searchParams.get("network")).toBe("testnet");
    expect(initialUrl.searchParams.get("pool")).toBe("42");
    expect(initialUrl.searchParams.has("operation")).toBe(false);
    expect(initialUrl.searchParams.has("appId")).toBe(false);

    pool.setPoolId("88");

    expect(new URL(pool.currentShareUrl.get()).searchParams.get("pool")).toBe(
      "88",
    );
  });

  it("keeps scanned key and reward pool in compact OneGate claim URLs", () => {
    const chain = {};
    const pool = useGasLuckyPool({
      app: makeApp(chain as any),
      launchContext: keyLaunch(),
      t,
    });

    const initialUrl = new URL(pool.currentShareUrl.get());
    expect(initialUrl.origin + initialUrl.pathname).toBe(
      "https://onegate.space/app/23",
    );
    expect(initialUrl.searchParams.get("key")).toBe(CLAIM_KEY);
    expect(initialUrl.searchParams.get("pool")).toBe("pool-001");
    expect(initialUrl.searchParams.get("network")).toBe("testnet");
    expect(initialUrl.searchParams.get("source")).toBe("onegate");
    expect(initialUrl.searchParams.get("operation")).toBe("claimOneGateVault");
    expect(initialUrl.searchParams.get("oneGateAppId")).toBe("23");
    expect(initialUrl.searchParams.has("claimKey")).toBe(false);
    expect(initialUrl.searchParams.has("appId")).toBe(false);

    pool.setClaimKey("ogv_next_key_abcdef");

    expect(new URL(pool.currentShareUrl.get()).searchParams.get("key")).toBe(
      "ogv_next_key_abcdef",
    );
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

    expect(chain.invoke).not.toHaveBeenCalled();
    expect(chain.ensureWallet).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/onegate-vault/claim",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          claimKey: CLAIM_KEY,
          address: OWNER,
          network: "testnet",
          poolId: "pool-001",
          oneGateAppId: "23",
          appId: "miniapp-gas-lucky-pool",
        }),
      }),
    );
    expect(pool.lastSuccessType.get()).toBe("claim");
    expect(pool.lastClaimKey.get()).toBe(CLAIM_KEY);
    expect(pool.lastClaimAmount.get()).toBe(350000000n);
    expect(pool.lastClaimLuckPercent.get()).toBe("7.00");
    expect(pool.lastTxid.get()).toBe("0xreward");
    expect(pool.claimProgress.get()).toBe("paid");
  });

  it("claims a scanned key with the OneGate provider address instead of a launch wallet param", async () => {
    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "paid",
        claimKey: CLAIM_KEY,
        address: ONEGATE_OWNER,
        amountFixed8: "120000000",
        luckPercent: "2.40",
        txHash: "0xonegate",
      }),
    });
    globalThis.fetch = fetchMock as any;
    (window as any).OneGateDapiProvider = {
      getAccounts: vi.fn().mockResolvedValue([{ address: ONEGATE_OWNER }]),
    };
    const chain = {
      ensureWallet: vi
        .fn()
        .mockRejectedValue(
          new Error(
            "Compatible Neo wallet not detected. Please install a NEP-21 dAPI wallet or NeoLine extension.",
          ),
        ),
      invoke: vi.fn(),
    };
    const pool = useGasLuckyPool({
      app: makeApp(chain as any),
      launchContext: keyLaunch(CLAIM_KEY, `&walletAddress=${OWNER}`),
      t,
    });

    try {
      await pool.claimPool();
    } finally {
      globalThis.fetch = originalFetch;
    }

    expect(chain.ensureWallet).not.toHaveBeenCalled();
    expect(chain.invoke).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/onegate-vault/claim",
      expect.objectContaining({
        body: JSON.stringify({
          claimKey: CLAIM_KEY,
          address: ONEGATE_OWNER,
          network: "testnet",
          poolId: "pool-001",
          oneGateAppId: "23",
          appId: "miniapp-gas-lucky-pool",
        }),
      }),
    );
    expect(pool.lastSuccessType.get()).toBe("claim");
    expect(pool.lastClaimAmount.get()).toBe(120000000n);
    expect(pool.lastTxid.get()).toBe("0xonegate");
  });

  it("starts OneGate NEP-21 discovery when a scanned vault page initializes", async () => {
    vi.useFakeTimers();
    const provider = {
      name: "OneGate",
      dapiVersion: "1.0",
      compatibility: ["NEP-21"],
      getAccounts: vi.fn().mockResolvedValue([{ address: ONEGATE_OWNER }]),
    };
    const chain = {
      ensureWallet: vi
        .fn()
        .mockRejectedValue(new Error("generic wallet unavailable")),
      invoke: vi.fn(),
    };
    let requestCount = 0;
    const emitProviderOnce = () => {
      requestCount += 1;
      if (requestCount !== 1) return;
      setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent("Neo.DapiProvider.ready", {
            detail: { provider },
          }),
        );
      }, 0);
    };
    window.addEventListener("Neo.DapiProvider.request", emitProviderOnce);

    const pool = useGasLuckyPool({
      app: makeApp(chain as any),
      launchContext: keyLaunch(CLAIM_KEY, `&walletAddress=${OWNER}`),
      t,
    });
    await vi.advanceTimersByTimeAsync(1);
    window.removeEventListener("Neo.DapiProvider.request", emitProviderOnce);

    expect(pool.currentClaimKey.get()).toBe(CLAIM_KEY);
    expect(requestCount).toBe(1);
  });

  it("builds future claim QR links with explicit OneGate claim context", () => {
    const chain = {
      ensureWallet: vi.fn(),
      invoke: vi.fn(),
      readArray: vi.fn(),
      listEvents: vi.fn(),
    };
    const pool = useGasLuckyPool({
      app: makeApp(chain as any),
      launchContext: keyLaunch(),
      t,
    });
    const url = new URL(pool.buildClaimUrl(CLAIM_KEY));

    expect(url.origin + url.pathname).toBe("https://onegate.space/app/23");
    expect(url.searchParams.get("source")).toBe("onegate");
    expect(url.searchParams.get("operation")).toBe("claimOneGateVault");
    expect(url.searchParams.get("oneGateAppId")).toBe("23");
    expect(url.searchParams.get("key")).toBe(CLAIM_KEY);
    expect(url.searchParams.get("pool")).toBe("pool-001");
    expect(url.searchParams.get("network")).toBe("testnet");
  });

  it("claims a scanned key with a OneGate dAPI hash-only account instead of showing a missing wallet error", async () => {
    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "paid",
        claimKey: CLAIM_KEY,
        address: ONEGATE_OWNER,
        amountFixed8: "120000000",
        luckPercent: "2.40",
        txHash: "0xonegatehash",
      }),
    });
    globalThis.fetch = fetchMock as any;
    (window as any).OneGateDapiProvider = {
      getAccounts: vi
        .fn()
        .mockResolvedValue([{ hash: addressToScriptHash(ONEGATE_OWNER) }]),
    };
    const chain = {
      ensureWallet: vi
        .fn()
        .mockRejectedValue(
          new Error(
            "Compatible Neo wallet not detected. Please install a NEP-21 dAPI wallet or NeoLine extension.",
          ),
        ),
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
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/onegate-vault/claim",
      expect.objectContaining({
        body: JSON.stringify({
          claimKey: CLAIM_KEY,
          address: ONEGATE_OWNER,
          network: "testnet",
          poolId: "pool-001",
          oneGateAppId: "23",
          appId: "miniapp-gas-lucky-pool",
        }),
      }),
    );
    expect(pool.lastSuccessType.get()).toBe("claim");
    expect(pool.lastTxid.get()).toBe("0xonegatehash");
  });

  it("does not open OneGate pickAddress during scanned-key claims", async () => {
    vi.useFakeTimers();
    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "diag_pick", stored: true }),
    });
    globalThis.fetch = fetchMock as any;
    const pickAddress = vi.fn().mockResolvedValue(ONEGATE_OWNER);
    (window as any).OneGateDapiProvider = {
      getAccounts: vi.fn().mockResolvedValue([]),
      pickAddress,
    };
    const chain = {
      ensureWallet: vi
        .fn()
        .mockRejectedValue(
          new Error(
            "Compatible Neo wallet not detected. Please install a NEP-21 dAPI wallet or NeoLine extension.",
          ),
        ),
      invoke: vi.fn(),
    };
    const pool = useGasLuckyPool({
      app: makeApp(chain as any),
      launchContext: keyLaunch(),
      t,
    });

    try {
      const claimPromise = pool.claimPool();
      const rejection = expect(claimPromise).rejects.toThrow(/ogvdiag/);
      await vi.advanceTimersByTimeAsync(10_000);
      await rejection;
    } finally {
      globalThis.fetch = originalFetch;
    }

    expect(pickAddress).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/onegate-vault/diagnostics",
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetchMock).not.toHaveBeenCalledWith(
      "/api/onegate-vault/claim",
      expect.anything(),
    );
    expect(pool.lastError.get()).toContain("provider=nep21");
    expect(pool.lastError.get()).toContain("accounts:empty");
    expect(pool.lastError.get()).not.toContain("pick");
  });

  it("never uses raw OneGate bridge fallback for scanned keys", async () => {
    vi.useFakeTimers();
    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "diag_1", stored: true }),
    });
    globalThis.fetch = fetchMock as any;
    const bridgeInvoke = vi.fn();
    (window as any).__OneGateBridge = { invoke: bridgeInvoke };
    const chain = {
      ensureWallet: vi
        .fn()
        .mockRejectedValue(
          new Error(
            "Compatible Neo wallet not detected. Please install a NEP-21 dAPI wallet or NeoLine extension.",
          ),
        ),
      invoke: vi.fn(),
    };
    const pool = useGasLuckyPool({
      app: makeApp(chain as any),
      launchContext: keyLaunch(),
      t,
    });

    try {
      const claimPromise = pool.claimPool();
      const rejection = expect(claimPromise).rejects.toThrow(/ogvdiag/);
      await vi.advanceTimersByTimeAsync(10_000);
      await rejection;
    } finally {
      globalThis.fetch = originalFetch;
    }

    expect(bridgeInvoke).not.toHaveBeenCalled();
    expect(chain.ensureWallet).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/onegate-vault/diagnostics",
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetchMock).not.toHaveBeenCalledWith(
      "/api/onegate-vault/claim",
      expect.anything(),
    );
    expect(pool.lastError.get()).toContain("provider=none");
    expect(pool.lastError.get()).not.toContain("getAccounts:sent");
    expect(pool.lastError.get()).not.toContain("callback:install");
  });

  it("waits for OneGate provider injection without raw bridge fallback", async () => {
    vi.useFakeTimers();
    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "paid",
        claimKey: CLAIM_KEY,
        address: ONEGATE_OWNER,
        amountFixed8: "120000000",
        luckPercent: "2.40",
        txHash: "0xonegateprovider-race",
      }),
    });
    globalThis.fetch = fetchMock as any;
    const bridgeInvoke = vi.fn();
    (window as any).__OneGateBridge = { invoke: bridgeInvoke };
    const provider = {
      name: "OneGate",
      getAccounts: vi.fn().mockResolvedValue([{ address: ONEGATE_OWNER }]),
    };
    const chain = {
      ensureWallet: vi
        .fn()
        .mockRejectedValue(
          new Error(
            "Compatible Neo wallet not detected. Please install a NEP-21 dAPI wallet or NeoLine extension.",
          ),
        ),
      invoke: vi.fn(),
    };
    const pool = useGasLuckyPool({
      app: makeApp(chain as any),
      launchContext: keyLaunch(),
      t,
    });

    const claimPromise = pool.claimPool();
    setTimeout(() => {
      (window as any).OneGateDapiProvider = provider;
      window.dispatchEvent(
        new CustomEvent("Neo.DapiProvider.ready", {
          detail: { provider },
        }),
      );
    }, 600);
    await vi.advanceTimersByTimeAsync(1_200);

    try {
      await claimPromise;
    } finally {
      globalThis.fetch = originalFetch;
    }

    expect(bridgeInvoke).not.toHaveBeenCalled();
    expect(chain.ensureWallet).not.toHaveBeenCalled();
    expect(provider.getAccounts).toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/onegate-vault/claim",
      expect.objectContaining({
        body: JSON.stringify({
          claimKey: CLAIM_KEY,
          address: ONEGATE_OWNER,
          network: "testnet",
          poolId: "pool-001",
          oneGateAppId: "23",
          appId: "miniapp-gas-lucky-pool",
        }),
      }),
    );
    expect(pool.lastSuccessType.get()).toBe("claim");
    expect(pool.lastTxid.get()).toBe("0xonegateprovider-race");
  });

  it("does not use raw bridge fallback on iPhone OneGate scans", async () => {
    vi.useFakeTimers();
    const originalFetch = globalThis.fetch;
    const originalUserAgent = navigator.userAgent;
    Object.defineProperty(navigator, "userAgent", {
      configurable: true,
      value:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 OneGate",
    });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "paid",
        claimKey: CLAIM_KEY,
        address: ONEGATE_OWNER,
        amountFixed8: "120000000",
        luckPercent: "2.40",
        txHash: "0xonegate-ios-provider-only",
      }),
    });
    globalThis.fetch = fetchMock as any;
    const bridgeInvoke = vi.fn();
    (window as any).__OneGateBridge = { invoke: bridgeInvoke };
    const provider = {
      name: "OneGate",
      getAccounts: vi.fn().mockResolvedValue([{ address: ONEGATE_OWNER }]),
    };
    const chain = {
      ensureWallet: vi
        .fn()
        .mockRejectedValue(
          new Error(
            "Compatible Neo wallet not detected. Please install a NEP-21 dAPI wallet or NeoLine extension.",
          ),
        ),
      invoke: vi.fn(),
    };
    const pool = useGasLuckyPool({
      app: makeApp(chain as any),
      launchContext: keyLaunch(),
      t,
    });

    const claimPromise = pool.claimPool();
    setTimeout(() => {
      (window as any).OneGateDapiProvider = provider;
      window.dispatchEvent(
        new CustomEvent("Neo.DapiProvider.ready", {
          detail: { provider },
        }),
      );
    }, 2_000);
    await vi.advanceTimersByTimeAsync(2_400);

    try {
      await claimPromise;
    } finally {
      globalThis.fetch = originalFetch;
      Object.defineProperty(navigator, "userAgent", {
        configurable: true,
        value: originalUserAgent,
      });
    }

    expect(bridgeInvoke).not.toHaveBeenCalled();
    expect(provider.getAccounts).toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/onegate-vault/claim",
      expect.objectContaining({
        body: JSON.stringify({
          claimKey: CLAIM_KEY,
          address: ONEGATE_OWNER,
          network: "testnet",
          poolId: "pool-001",
          oneGateAppId: "23",
          appId: "miniapp-gas-lucky-pool",
        }),
      }),
    );
    expect(pool.lastSuccessType.get()).toBe("claim");
    expect(pool.lastTxid.get()).toBe("0xonegate-ios-provider-only");
  });

  it("adds safe OneGate diagnostics to the missing-address error", async () => {
    vi.useFakeTimers();
    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "diag_1", stored: true }),
    });
    globalThis.fetch = fetchMock as any;
    const chain = {
      ensureWallet: vi
        .fn()
        .mockRejectedValue(
          new Error(
            "Compatible Neo wallet not detected. Please install a NEP-21 dAPI wallet or NeoLine extension.",
          ),
        ),
      invoke: vi.fn(),
    };
    const pool = useGasLuckyPool({
      app: makeApp(chain as any),
      launchContext: keyLaunch(),
      t,
    });

    try {
      const claimPromise = pool.claimPool();
      const rejection = expect(claimPromise).rejects.toThrow(/ogvdiag/);
      await vi.advanceTimersByTimeAsync(10_000);
      await rejection;
    } finally {
      globalThis.fetch = originalFetch;
    }

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/onegate-vault/diagnostics",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }),
    );
    const diagnosticBody = JSON.parse(
      String(fetchMock.mock.calls[0]?.[1]?.body ?? "{}"),
    );
    expect(diagnosticBody).toEqual(
      expect.objectContaining({
        eventType: "missing_address",
        network: "testnet",
        poolId: "pool-001",
        oneGateAppId: "23",
        appId: "miniapp-gas-lucky-pool",
      }),
    );
    expect(JSON.stringify(diagnosticBody)).not.toContain(CLAIM_KEY);
    expect(JSON.stringify(diagnosticBody)).not.toContain(ONEGATE_OWNER);
    expect(JSON.stringify(diagnosticBody)).not.toContain("onegate.space/app/23?key=");
    expect(pool.lastError.get()).toContain("provider=none");
    expect(pool.lastError.get()).toContain("bridge=provider-only");
    expect(pool.lastError.get()).toContain("wallet=skipped");
    expect(pool.lastError.get()).not.toContain(CLAIM_KEY);
  });

  it("claims with OneGate default account auth when provider getAccounts fails", async () => {
    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "paid",
        claimKey: CLAIM_KEY,
        address: ONEGATE_OWNER,
        amountFixed8: "120000000",
        luckPercent: "2.40",
        txHash: "0xonegateauth",
      }),
    });
    globalThis.fetch = fetchMock as any;
    const getAccounts = vi
      .fn()
      .mockRejectedValue(new Error("provider accounts unavailable"));
    const authenticate = vi.fn().mockResolvedValue({
      Address: ONEGATE_OWNER,
      Network: 894710606,
    });
    (window as any).OneGateDapiProvider = {
      name: "OneGate",
      getAccounts,
      authenticate,
    };
    const chain = {
      ensureWallet: vi
        .fn()
        .mockRejectedValue(
          new Error(
            "Compatible Neo wallet not detected. Please install a NEP-21 dAPI wallet or NeoLine extension.",
          ),
        ),
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

    expect(getAccounts).toHaveBeenCalled();
    expect(authenticate).toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/onegate-vault/claim",
      expect.objectContaining({
        body: JSON.stringify({
          claimKey: CLAIM_KEY,
          address: ONEGATE_OWNER,
          network: "testnet",
          poolId: "pool-001",
          oneGateAppId: "23",
          appId: "miniapp-gas-lucky-pool",
        }),
      }),
    );
    expect(pool.lastSuccessType.get()).toBe("claim");
    expect(pool.lastTxid.get()).toBe("0xonegateauth");
  });

  it("claims a scanned key with OneGate master PascalCase account fields", async () => {
    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "paid",
        claimKey: CLAIM_KEY,
        address: ONEGATE_OWNER,
        amountFixed8: "120000000",
        luckPercent: "2.40",
        txHash: "0xonegatepascal",
      }),
    });
    globalThis.fetch = fetchMock as any;
    (window as any).OneGateDapiProvider = {
      getAccounts: vi.fn().mockResolvedValue([
        {
          Address: ONEGATE_OWNER,
          Hash: addressToScriptHash(ONEGATE_OWNER),
          IsDefault: true,
        },
      ]),
    };
    const chain = {
      ensureWallet: vi
        .fn()
        .mockRejectedValue(
          new Error(
            "Compatible Neo wallet not detected. Please install a NEP-21 dAPI wallet or NeoLine extension.",
          ),
        ),
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
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/onegate-vault/claim",
      expect.objectContaining({
        body: JSON.stringify({
          claimKey: CLAIM_KEY,
          address: ONEGATE_OWNER,
          network: "testnet",
          poolId: "pool-001",
          oneGateAppId: "23",
          appId: "miniapp-gas-lucky-pool",
        }),
      }),
    );
    expect(pool.lastSuccessType.get()).toBe("claim");
    expect(pool.lastTxid.get()).toBe("0xonegatepascal");
  });

  it("keeps requesting delayed OneGate dAPI injection on scanned key links without using generic wallets", async () => {
    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "paid",
        claimKey: CLAIM_KEY,
        address: ONEGATE_OWNER,
        amountFixed8: "120000000",
        luckPercent: "2.40",
        txHash: "0xonegatedelayed",
      }),
    });
    globalThis.fetch = fetchMock as any;
    const chain = {
      ensureWallet: vi
        .fn()
        .mockRejectedValue(
          new Error(
            "Compatible Neo wallet not detected. Please install a NEP-21 dAPI wallet or NeoLine extension.",
          ),
        ),
      invoke: vi.fn(),
    };
    let requestCount = 0;
    const injectProvider = () => {
      requestCount += 1;
      if (requestCount < 3) return;
      (window as any).OneGateDapiProvider = {
        getAccounts: vi.fn().mockResolvedValue([{ address: ONEGATE_OWNER }]),
      };
      window.dispatchEvent(
        new CustomEvent("Neo.DapiProvider.ready", {
          detail: { provider: (window as any).OneGateDapiProvider },
        }),
      );
    };
    window.addEventListener("Neo.DapiProvider.request", injectProvider);
    const pool = useGasLuckyPool({
      app: makeApp(chain as any),
      launchContext: keyLaunch(),
      t,
    });

    try {
      await pool.claimPool();
    } finally {
      window.removeEventListener("Neo.DapiProvider.request", injectProvider);
      globalThis.fetch = originalFetch;
    }

    expect(chain.ensureWallet).not.toHaveBeenCalled();
    expect(requestCount).toBeGreaterThan(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/onegate-vault/claim",
      expect.objectContaining({
        body: JSON.stringify({
          claimKey: CLAIM_KEY,
          address: ONEGATE_OWNER,
          network: "testnet",
          poolId: "pool-001",
          oneGateAppId: "23",
          appId: "miniapp-gas-lucky-pool",
        }),
      }),
    );
    expect(pool.lastSuccessType.get()).toBe("claim");
    expect(pool.lastTxid.get()).toBe("0xonegatedelayed");
  });

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

  it("rejects over-precision top-ups before wallet submission", async () => {
    const chain = {
      ensureWallet: vi.fn().mockResolvedValue(OWNER),
      invokeWithPayment: vi.fn(),
      readArray: vi.fn().mockResolvedValue([]),
      listEvents: vi.fn().mockResolvedValue([]),
    };
    const pool = useGasLuckyPool({
      app: makeApp(chain as any),
      launchContext: launch("42"),
      t,
    });

    await expect(
      pool.topUpPool({ poolId: "42", amount: "2.000000001" }),
    ).rejects.toThrow("invalidTopUpAmount");

    expect(chain.ensureWallet).not.toHaveBeenCalled();
    expect(chain.invokeWithPayment).not.toHaveBeenCalled();
  });
});
