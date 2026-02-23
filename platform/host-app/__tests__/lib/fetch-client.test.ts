import { fetchJSON, fetchOK, RequestError, toApiError } from "@/lib/fetch-client";

describe("fetch-client", () => {
  const mockFetch = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
    global.fetch = mockFetch;
  });

  it("returns parsed JSON payload on success", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ value: 42 }),
    });

    await expect(fetchJSON<{ value: number }>("/api/test")).resolves.toEqual({ value: 42 });
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

    await expect(fetchOK("/api/test", { method: "POST" })).resolves.toBeUndefined();
  });

  it("converts unknown errors to API-safe error shape", () => {
    const err = new RequestError("failed", "BAD", 500);
    expect(toApiError(err)).toEqual({ message: "failed", code: "BAD" });
    expect(toApiError(new Error("boom"))).toEqual({ message: "boom", code: "NETWORK_ERROR" });
  });
});
