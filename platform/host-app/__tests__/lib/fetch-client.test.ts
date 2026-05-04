import {
  DEFAULT_FETCH_TIMEOUT_MS,
  fetchJSON,
  fetchOK,
  RequestError,
  toApiError,
} from "@/lib/fetch-client";

describe("fetch-client", () => {
  const mockFetch = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
    global.fetch = mockFetch;
    sessionStorage.clear();
  });

  it("returns parsed JSON payload on success", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ value: 42 }),
    });

    await expect(fetchJSON<{ value: number }>("/api/test")).resolves.toEqual({
      value: 42,
    });
  });

  it("throws RequestError with API code on non-2xx response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      statusText: "Bad Request",
      json: async () => ({ error: "invalid payload", code: "INVALID_INPUT" }),
    });

    await expect(fetchJSON("/api/test")).rejects.toEqual(
      expect.objectContaining({
        name: "RequestError",
        message: "invalid payload",
        code: "INVALID_INPUT",
        status: 400,
      }),
    );
  });

  it("supports empty-body success responses for fetchOK", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => {
        throw new Error("no body");
      },
    });

    await expect(
      fetchOK("/api/test", { method: "POST" }),
    ).resolves.toBeUndefined();
  });

  it("adds wallet session bearer token to client API requests", async () => {
    sessionStorage.setItem("sb-access-token", "wallet-jwt");
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ value: 42 }),
    });

    await fetchJSON<{ value: number }>("/api/test");

    const init = mockFetch.mock.calls[0][1] as RequestInit;
    expect(new Headers(init.headers).get("Authorization")).toBe(
      "Bearer wallet-jwt",
    );
  });

  it("uses a 10 second default request timeout for user-facing API calls", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ value: 42 }),
    });

    await fetchJSON<{ value: number }>("/api/test");

    const init = mockFetch.mock.calls[0][1] as RequestInit;
    expect(DEFAULT_FETCH_TIMEOUT_MS).toBe(10_000);
    expect(init.signal).toBeDefined();
  });

  it("does not override an explicit Authorization header", async () => {
    sessionStorage.setItem("sb-access-token", "wallet-jwt");
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ value: 42 }),
    });

    await fetchJSON<{ value: number }>("/api/test", {
      headers: { Authorization: "Bearer explicit-token" },
    });

    const init = mockFetch.mock.calls[0][1] as RequestInit;
    expect(new Headers(init.headers).get("Authorization")).toBe(
      "Bearer explicit-token",
    );
  });

  it("does not attach wallet token to external absolute URLs", async () => {
    sessionStorage.setItem("sb-access-token", "wallet-jwt");
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ value: 42 }),
    });

    await fetchJSON<{ value: number }>("https://example.com/api/test");

    const init = mockFetch.mock.calls[0][1] as RequestInit;
    expect(new Headers(init.headers).get("Authorization")).toBeNull();
  });

  it("does not override Authorization from a Request input", async () => {
    sessionStorage.setItem("sb-access-token", "wallet-jwt");
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ value: 42 }),
    });

    const originalRequest = global.Request;
    class TestRequest {
      readonly url: string;
      readonly headers: Headers;

      constructor(input: string, init?: RequestInit) {
        this.url = input;
        this.headers = new Headers(init?.headers);
      }
    }
    Object.defineProperty(global, "Request", {
      value: TestRequest,
      configurable: true,
    });
    try {
      const request = new Request(`${window.location.origin}/api/test`, {
        headers: { Authorization: "Bearer request-token" },
      });
      await fetchJSON<{ value: number }>(request);
    } finally {
      Object.defineProperty(global, "Request", {
        value: originalRequest,
        configurable: true,
      });
    }

    const init = mockFetch.mock.calls[0][1] as RequestInit;
    expect(new Headers(init.headers).get("Authorization")).toBe(
      "Bearer request-token",
    );
  });

  it("continues API requests if sessionStorage is unavailable", async () => {
    const storageSpy = jest
      .spyOn(Storage.prototype, "getItem")
      .mockImplementationOnce(() => {
        throw new Error("blocked");
      });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ value: 42 }),
    });

    await expect(fetchJSON<{ value: number }>("/api/test")).resolves.toEqual({
      value: 42,
    });
    const init = mockFetch.mock.calls[0][1] as RequestInit;
    expect(new Headers(init.headers).get("Authorization")).toBeNull();
    storageSpy.mockRestore();
  });

  it("converts unknown errors to API-safe error shape", () => {
    const err = new RequestError("failed", "BAD", 500);
    expect(toApiError(err)).toEqual({ message: "failed", code: "BAD" });
    expect(toApiError(new Error("boom"))).toEqual({
      message: "boom",
      code: "NETWORK_ERROR",
    });
  });
});
