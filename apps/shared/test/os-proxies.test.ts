/**
 * Unit tests for the OS service proxy layer.
 *
 * Covers EdgeClient (transport), OSServiceProxy (base class),
 * and a representative sample of concrete proxies:
 *   StorageProxy, CheckinProxy, GameProxy, PaymentProxy
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EdgeClient } from "../services/os/EdgeClient";
import { StorageProxy } from "../services/os/StorageProxy";
import { CheckinProxy } from "../services/os/CheckinProxy";
import { GameProxy, type PoolConfig } from "../services/os/GameProxy";
import { PaymentProxy } from "../services/os/PaymentProxy";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a mock Response that resolves to the given JSON body. */
function mockResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    statusText: ok ? "OK" : "Internal Server Error",
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

// ---------------------------------------------------------------------------
// EdgeClient
// ---------------------------------------------------------------------------

describe("EdgeClient", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("should construct URL from baseUrl + endpoint", async () => {
    fetchSpy.mockResolvedValue(mockResponse({ result: true }));
    const client = new EdgeClient("app-1", "https://edge.example.com");

    await client.call("os-storage-get", { key: "foo" });

    const [url] = fetchSpy.mock.calls[0];
    expect(url).toBe("https://edge.example.com/os-storage-get");
  });

  it("should inject appId into request body", async () => {
    fetchSpy.mockResolvedValue(mockResponse({ ok: true }));
    const client = new EdgeClient("app-1", "https://edge.example.com");

    await client.call("os-storage-get", { key: "bar" });

    const [, init] = fetchSpy.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.appId).toBe("app-1");
    expect(body.key).toBe("bar");
  });

  it("should include auth token in headers when set", async () => {
    fetchSpy.mockResolvedValue(mockResponse({ ok: true }));
    const client = new EdgeClient("app-1", "https://edge.example.com");
    client.setAuthToken("secret-token-123");

    await client.call("os-storage-get");

    const [, init] = fetchSpy.mock.calls[0];
    expect(init.headers["Authorization"]).toBe("Bearer secret-token-123");
  });

  it("should work without auth token (no Authorization header)", async () => {
    fetchSpy.mockResolvedValue(mockResponse({ ok: true }));
    const client = new EdgeClient("app-1", "https://edge.example.com");

    await client.call("os-storage-get");

    const [, init] = fetchSpy.mock.calls[0];
    expect(init.headers["Authorization"]).toBeUndefined();
    expect(init.headers["Content-Type"]).toBe("application/json");
  });

  it("should return parsed JSON on success", async () => {
    const payload = { value: 42, nested: { a: true } };
    fetchSpy.mockResolvedValue(mockResponse(payload));
    const client = new EdgeClient("app-1", "https://edge.example.com");

    const result = await client.call("os-storage-get");
    expect(result).toEqual(payload);
  });

  it("should throw on non-OK response with error message from body", async () => {
    fetchSpy.mockResolvedValue(
      mockResponse({ message: "key not found" }, false, 404),
    );
    const client = new EdgeClient("app-1", "https://edge.example.com");

    await expect(client.call("os-storage-get")).rejects.toThrow(
      "OS service error (os-storage-get): key not found",
    );
  });

  it("should throw with statusText when error body is not JSON", async () => {
    const res = {
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      json: () => Promise.reject(new Error("not json")),
    } as unknown as Response;
    fetchSpy.mockResolvedValue(res);
    const client = new EdgeClient("app-1", "https://edge.example.com");

    await expect(client.call("os-something")).rejects.toThrow(
      "OS service error (os-something): Internal Server Error",
    );
  });

  it("should use POST method for all calls", async () => {
    fetchSpy.mockResolvedValue(mockResponse({}));
    const client = new EdgeClient("app-1", "https://edge.example.com");

    await client.call("os-test");

    const [, init] = fetchSpy.mock.calls[0];
    expect(init.method).toBe("POST");
  });

  it("should fall back to /api/edge when no baseUrl is provided", async () => {
    fetchSpy.mockResolvedValue(mockResponse({}));
    const client = new EdgeClient("app-1");

    await client.call("os-test");

    const [url] = fetchSpy.mock.calls[0];
    expect(url).toBe("/api/edge/os-test");
  });

  it("should pass empty params as body with just appId", async () => {
    fetchSpy.mockResolvedValue(mockResponse({}));
    const client = new EdgeClient("my-app", "https://edge.example.com");

    await client.call("ping");

    const [, init] = fetchSpy.mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({ appId: "my-app" });
  });
});

// ---------------------------------------------------------------------------
// OSServiceProxy (tested indirectly through a concrete proxy)
// ---------------------------------------------------------------------------

describe("OSServiceProxy (via StorageProxy)", () => {
  let edgeCallSpy: ReturnType<typeof vi.fn>;
  let edge: EdgeClient;
  let proxy: StorageProxy;

  beforeEach(() => {
    edge = new EdgeClient("proxy-app", "https://edge.example.com");
    edgeCallSpy = vi.fn().mockResolvedValue({});
    edge.call = edgeCallSpy;
    proxy = new StorageProxy("proxy-app", edge);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should prefix method calls with servicePrefix", async () => {
    await proxy.get("some-key");

    expect(edgeCallSpy).toHaveBeenCalledWith("os-storage-get", { key: "some-key" });
  });

  it("should pass params to EdgeClient.call", async () => {
    await proxy.set("k", "v");

    expect(edgeCallSpy).toHaveBeenCalledWith("os-storage-set", {
      key: "k",
      value: "v",
    });
  });
});

// ---------------------------------------------------------------------------
// StorageProxy
// ---------------------------------------------------------------------------

describe("StorageProxy", () => {
  let edgeCallSpy: ReturnType<typeof vi.fn>;
  let storage: StorageProxy;

  beforeEach(() => {
    const edge = new EdgeClient("storage-app", "https://edge.example.com");
    edgeCallSpy = vi.fn().mockResolvedValue({});
    edge.call = edgeCallSpy;
    storage = new StorageProxy("storage-app", edge);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("get() should call os-storage-get with key", async () => {
    await storage.get("user:settings");

    expect(edgeCallSpy).toHaveBeenCalledOnce();
    expect(edgeCallSpy).toHaveBeenCalledWith("os-storage-get", {
      key: "user:settings",
    });
  });

  it("set() should call os-storage-set with key and value", async () => {
    await storage.set("user:settings", { theme: "dark" });

    expect(edgeCallSpy).toHaveBeenCalledWith("os-storage-set", {
      key: "user:settings",
      value: { theme: "dark" },
    });
  });

  it("delete() should call os-storage-delete with key", async () => {
    await storage.delete("old-key");

    expect(edgeCallSpy).toHaveBeenCalledWith("os-storage-delete", {
      key: "old-key",
    });
  });

  it("list() should call os-storage-list with prefix and limit", async () => {
    await storage.list("user:", 50);

    expect(edgeCallSpy).toHaveBeenCalledWith("os-storage-list", {
      prefix: "user:",
      limit: 50,
    });
  });

  it("list() should default limit to 100", async () => {
    await storage.list("all:");

    expect(edgeCallSpy).toHaveBeenCalledWith("os-storage-list", {
      prefix: "all:",
      limit: 100,
    });
  });

  it("grantReadAccess() should call os-storage-grant-access", async () => {
    await storage.grantReadAccess("other-app", "shared:");

    expect(edgeCallSpy).toHaveBeenCalledWith("os-storage-grant-access", {
      readerAppId: "other-app",
      keyPrefix: "shared:",
    });
  });

  it("readShared() should call os-storage-read-shared", async () => {
    await storage.readShared("owner-app", "public-key");

    expect(edgeCallSpy).toHaveBeenCalledWith("os-storage-read-shared", {
      ownerAppId: "owner-app",
      key: "public-key",
    });
  });

  it("get() should return the value from EdgeClient", async () => {
    edgeCallSpy.mockResolvedValue({ data: "hello" });

    const result = await storage.get("k");
    expect(result).toEqual({ data: "hello" });
  });
});

// ---------------------------------------------------------------------------
// CheckinProxy
// ---------------------------------------------------------------------------

describe("CheckinProxy", () => {
  let edgeCallSpy: ReturnType<typeof vi.fn>;
  let checkin: CheckinProxy;

  beforeEach(() => {
    const edge = new EdgeClient("checkin-app", "https://edge.example.com");
    edgeCallSpy = vi.fn().mockResolvedValue({});
    edge.call = edgeCallSpy;
    checkin = new CheckinProxy("checkin-app", edge);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("checkIn() should call os-checkin-checkin", async () => {
    await checkin.checkIn();

    expect(edgeCallSpy).toHaveBeenCalledOnce();
    expect(edgeCallSpy).toHaveBeenCalledWith("os-checkin-checkin", {});
  });

  it("getStreak() should call os-checkin-streak", async () => {
    const streakData = {
      currentStreak: 5,
      highestStreak: 12,
      totalCheckins: 42,
      lastCheckinTime: Date.now(),
      unclaimedRewards: "1.5",
      totalClaimed: "10.0",
    };
    edgeCallSpy.mockResolvedValue(streakData);

    const result = await checkin.getStreak();

    expect(edgeCallSpy).toHaveBeenCalledWith("os-checkin-streak", {});
    expect(result).toEqual(streakData);
  });

  it("claimRewards() should call os-checkin-claim", async () => {
    await checkin.claimRewards();

    expect(edgeCallSpy).toHaveBeenCalledOnce();
    expect(edgeCallSpy).toHaveBeenCalledWith("os-checkin-claim", {});
  });
});

// ---------------------------------------------------------------------------
// GameProxy
// ---------------------------------------------------------------------------

describe("GameProxy", () => {
  let edgeCallSpy: ReturnType<typeof vi.fn>;
  let game: GameProxy;

  beforeEach(() => {
    const edge = new EdgeClient("game-app", "https://edge.example.com");
    edgeCallSpy = vi.fn().mockResolvedValue({});
    edge.call = edgeCallSpy;
    game = new GameProxy("game-app", edge);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("createPool() should call os-game-create with config", async () => {
    const config: PoolConfig = {
      poolType: 0,
      maxPlayers: 10,
      entryFee: "5.0",
      duration: 3600,
    };
    edgeCallSpy.mockResolvedValue("pool-abc");

    const poolId = await game.createPool(config);

    expect(edgeCallSpy).toHaveBeenCalledWith("os-game-create", { config });
    expect(poolId).toBe("pool-abc");
  });

  it("joinPool() should call os-game-join with poolId", async () => {
    await game.joinPool("pool-abc");

    expect(edgeCallSpy).toHaveBeenCalledWith("os-game-join", {
      poolId: "pool-abc",
    });
  });

  it("placeBet() should call os-game-bet with poolId and amount", async () => {
    await game.placeBet("pool-abc", "2.5");

    expect(edgeCallSpy).toHaveBeenCalledWith("os-game-bet", {
      poolId: "pool-abc",
      amount: "2.5",
    });
  });

  it("getPoolState() should call os-game-status with poolId", async () => {
    const state = {
      poolId: "pool-abc",
      appId: "game-app",
      status: "active" as const,
      playerCount: 5,
      totalBets: "25.0",
    };
    edgeCallSpy.mockResolvedValue(state);

    const result = await game.getPoolState("pool-abc");

    expect(edgeCallSpy).toHaveBeenCalledWith("os-game-status", {
      poolId: "pool-abc",
    });
    expect(result).toEqual(state);
  });

  it("settle() should call os-game-settle with poolId and results", async () => {
    const results = { winner: "player-1", scores: [100, 80] };

    await game.settle("pool-abc", results);

    expect(edgeCallSpy).toHaveBeenCalledWith("os-game-settle", {
      poolId: "pool-abc",
      results,
    });
  });
});

// ---------------------------------------------------------------------------
// PaymentProxy
// ---------------------------------------------------------------------------

describe("PaymentProxy", () => {
  let edgeCallSpy: ReturnType<typeof vi.fn>;
  let payment: PaymentProxy;

  beforeEach(() => {
    const edge = new EdgeClient("pay-app", "https://edge.example.com");
    edgeCallSpy = vi.fn().mockResolvedValue({});
    edge.call = edgeCallSpy;
    payment = new PaymentProxy("pay-app", edge);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("deposit() should call os-payment-deposit with amount", async () => {
    edgeCallSpy.mockResolvedValue({ invocation: { txid: "0xabc" } });

    const result = await payment.deposit("10.0");

    expect(edgeCallSpy).toHaveBeenCalledWith("os-payment-deposit", {
      amount: "10.0",
      memo: undefined,
    });
    expect(result).toEqual({ invocation: { txid: "0xabc" } });
  });

  it("deposit() should pass optional memo", async () => {
    edgeCallSpy.mockResolvedValue({ invocation: {} });

    await payment.deposit("5.0", "subscription fee");

    expect(edgeCallSpy).toHaveBeenCalledWith("os-payment-deposit", {
      amount: "5.0",
      memo: "subscription fee",
    });
  });

  it("withdraw() should call os-payment-withdraw with amount", async () => {
    await payment.withdraw("3.0");

    expect(edgeCallSpy).toHaveBeenCalledWith("os-payment-withdraw", {
      amount: "3.0",
    });
  });

  it("getBalance() should call os-payment-balance", async () => {
    edgeCallSpy.mockResolvedValue("42.5");

    const balance = await payment.getBalance();

    expect(edgeCallSpy).toHaveBeenCalledWith("os-payment-balance", {});
    expect(balance).toBe("42.5");
  });

  it("transfer() should call os-payment-transfer with to and amount", async () => {
    await payment.transfer("recipient-app", "7.0");

    expect(edgeCallSpy).toHaveBeenCalledWith("os-payment-transfer", {
      to: "recipient-app",
      amount: "7.0",
    });
  });
});
