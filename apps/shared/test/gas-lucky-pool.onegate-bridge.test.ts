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

describe("OneGate Vault runtime logic - OneGate provider discovery", () => {
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
            "Compatible Neo wallet not detected. Please open in OneGate or connect NeoLine.",
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
            "Compatible Neo wallet not detected. Please open in OneGate or connect NeoLine.",
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
            "Compatible Neo wallet not detected. Please open in OneGate or connect NeoLine.",
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

  it("claims through a read-only OneGate NEP-21 provider global", async () => {
    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "paid",
        claimKey: CLAIM_KEY,
        address: ONEGATE_OWNER,
        amountFixed8: "120000000",
        luckPercent: "2.40",
        txHash: "0xonegatereadonly",
      }),
    });
    globalThis.fetch = fetchMock as any;
    const provider = {
      name: "OneGate",
      dapiVersion: "1.0",
      compatibility: ["NEP-21"],
      getAccounts: vi.fn().mockResolvedValue([{ address: ONEGATE_OWNER }]),
    };
    Object.defineProperty(window, "NEP21Provider", {
      configurable: true,
      value: provider,
      writable: false,
    });
    const chain = {
      ensureWallet: vi
        .fn()
        .mockRejectedValue(
          new Error(
            "Compatible Neo wallet not detected. Please open in OneGate or connect NeoLine.",
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
    expect(pool.lastTxid.get()).toBe("0xonegatereadonly");
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
            "Compatible Neo wallet not detected. Please open in OneGate or connect NeoLine.",
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
            "Compatible Neo wallet not detected. Please open in OneGate or connect NeoLine.",
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
    expect(JSON.stringify(diagnosticBody)).not.toContain(
      "onegate.space/app/23?key=",
    );
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
            "Compatible Neo wallet not detected. Please open in OneGate or connect NeoLine.",
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
            "Compatible Neo wallet not detected. Please open in OneGate or connect NeoLine.",
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
            "Compatible Neo wallet not detected. Please open in OneGate or connect NeoLine.",
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
});
