import { getNeoRPCURL, neoRpcCall } from "@/lib/explorer-rpc";

describe("explorer-rpc: getNeoRPCURL", () => {
  const originalMainnet = process.env.NEO_RPC_MAINNET;
  const originalTestnet = process.env.NEO_RPC_TESTNET;

  afterEach(() => {
    // Restore the original process env between cases so env-resolution tests
    // do not leak into each other (or into the rest of the suite).
    if (originalMainnet === undefined) {
      delete process.env.NEO_RPC_MAINNET;
    } else {
      process.env.NEO_RPC_MAINNET = originalMainnet;
    }
    if (originalTestnet === undefined) {
      delete process.env.NEO_RPC_TESTNET;
    } else {
      process.env.NEO_RPC_TESTNET = originalTestnet;
    }
  });

  it("resolves the mainnet endpoint from NEO_RPC_MAINNET", () => {
    process.env.NEO_RPC_MAINNET = "https://mainnet-rpc.example.test";
    process.env.NEO_RPC_TESTNET = "https://testnet-rpc.example.test";

    expect(getNeoRPCURL("mainnet")).toBe("https://mainnet-rpc.example.test");
  });

  it("resolves the testnet endpoint from NEO_RPC_TESTNET", () => {
    process.env.NEO_RPC_MAINNET = "https://mainnet-rpc.example.test";
    process.env.NEO_RPC_TESTNET = "https://testnet-rpc.example.test";

    expect(getNeoRPCURL("testnet")).toBe("https://testnet-rpc.example.test");
  });

  it("falls back to the n3index mainnet gateway when env is unset", () => {
    delete process.env.NEO_RPC_MAINNET;

    expect(getNeoRPCURL("mainnet")).toBe("https://api.n3index.dev/mainnet");
  });

  it("falls back to the n3index testnet gateway when env is unset", () => {
    delete process.env.NEO_RPC_TESTNET;

    expect(getNeoRPCURL("testnet")).toBe("https://api.n3index.dev/testnet");
  });

  it("treats an empty-string env value as unset and uses the fallback", () => {
    // `process.env.X || fallback` means empty string must NOT be used as a URL.
    process.env.NEO_RPC_MAINNET = "";
    process.env.NEO_RPC_TESTNET = "";

    expect(getNeoRPCURL("mainnet")).toBe("https://api.n3index.dev/mainnet");
    expect(getNeoRPCURL("testnet")).toBe("https://api.n3index.dev/testnet");
  });

  it("routes any non-mainnet network to the testnet endpoint", () => {
    process.env.NEO_RPC_MAINNET = "https://mainnet-rpc.example.test";
    process.env.NEO_RPC_TESTNET = "https://testnet-rpc.example.test";

    expect(getNeoRPCURL("testnet")).toBe("https://testnet-rpc.example.test");
    // Defensive: the implementation only special-cases "mainnet"; everything
    // else (including an unexpected value) must resolve to testnet.
    expect(getNeoRPCURL("staging" as unknown as "testnet")).toBe(
      "https://testnet-rpc.example.test",
    );
  });
});

describe("explorer-rpc: neoRpcCall", () => {
  const mockFetch = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
    global.fetch = mockFetch;
    process.env.NEO_RPC_MAINNET = "https://mainnet-rpc.example.test";
    process.env.NEO_RPC_TESTNET = "https://testnet-rpc.example.test";
  });

  it("returns the JSON-RPC result on a successful 2xx response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ jsonrpc: "2.0", id: 1, result: { count: 42 } }),
    });

    await expect(
      neoRpcCall<{ count: number }>("mainnet", "getblockcount", []),
    ).resolves.toEqual({ count: 42 });
  });

  it("issues a JSON-RPC 2.0 POST to the resolved network endpoint", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ result: "ok" }),
    });

    await neoRpcCall("testnet", "getblock", [102, true]);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("https://testnet-rpc.example.test");
    expect(init).toEqual(
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(JSON.parse(init.body)).toEqual({
      jsonrpc: "2.0",
      method: "getblock",
      params: [102, true],
      id: 1,
    });
    // Recent hardening wires an abort signal for the request timeout.
    expect(init.signal).toBeDefined();
  });

  it("throws with the HTTP status when the response is not ok", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: async () => ({}),
    });

    await expect(
      neoRpcCall("mainnet", "getblockcount", []),
    ).rejects.toThrow("RPC error: 503");
  });

  it("does not parse the body when the HTTP response fails", async () => {
    const json = jest.fn(async () => ({ result: "should-not-read" }));
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500, json });

    await expect(neoRpcCall("mainnet", "getblockcount", [])).rejects.toThrow(
      "RPC error: 500",
    );
    // The non-2xx guard returns before reading the payload.
    expect(json).not.toHaveBeenCalled();
  });

  it("throws the JSON-RPC error message when the payload carries an error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        jsonrpc: "2.0",
        id: 1,
        error: { code: -32601, message: "Method not found" },
      }),
    });

    await expect(
      neoRpcCall("mainnet", "doesNotExist", []),
    ).rejects.toThrow("Method not found");
  });

  it("falls back to the JSON-RPC error code when no message is present", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ error: { code: -32000 } }),
    });

    await expect(neoRpcCall("mainnet", "getblock", [])).rejects.toThrow(
      "-32000",
    );
  });

  it("falls back to a generic message when the error object is empty", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ error: {} }),
    });

    await expect(neoRpcCall("mainnet", "getblock", [])).rejects.toThrow(
      "RPC error",
    );
  });

  it("propagates an AbortError when the request times out", async () => {
    // Simulate AbortSignal.timeout firing: fetch rejects with an AbortError.
    mockFetch.mockRejectedValueOnce(
      new DOMException("The operation timed out.", "TimeoutError"),
    );

    await expect(
      neoRpcCall("mainnet", "getblockcount", [], { timeoutMs: 5 }),
    ).rejects.toThrow(/timed out/i);
  });

  it("passes an abort signal even when a custom timeout is supplied", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ result: 1 }),
    });

    await neoRpcCall("mainnet", "getblockcount", [], { timeoutMs: 1234 });

    const init = mockFetch.mock.calls[0][1];
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("returns undefined-typed result when the payload omits a result field", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ jsonrpc: "2.0", id: 1 }),
    });

    await expect(
      neoRpcCall("mainnet", "getblockcount", []),
    ).resolves.toBeUndefined();
  });
});
