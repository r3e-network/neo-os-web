/**
 * Resilience tests for the OS edge transport (EdgeClient).
 *
 * The edge client now routes every request through fetchWithTimeout and wraps
 * the HTTP read in retryAsync, so a transient OS-edge blip (timeout, network
 * drop, 429, 5xx) retries with bounded backoff instead of hard-failing the UI.
 * These tests pin that contract:
 *
 *   - a transient failure followed by success → caller sees success (retried)
 *   - a deterministic 4xx → fails fast, NOT retried (re-issuing can't help)
 *   - a request that always fails transiently → exhausts the bounded attempts
 *   - the wallet-intent submission runs exactly ONCE even when the HTTP read
 *     was retried (a retried transport blip must never re-pop a signing request)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EdgeClient } from "../services/os/EdgeClient";

// Mirror os-proxies.test.ts: the wallet adapter is mocked so we can assert how
// many times the (post-fetch, non-retried) signing path runs.
const walletMock = vi.hoisted(() => ({
  address: { value: null as string | null },
  connect: vi.fn(async () => {
    walletMock.address.value = "NMockSender";
  }),
  invokeContract: vi.fn(async () => ({ txid: "0xwalletintent" })),
  invokeWithConfirmation: vi.fn(async () => ({ txid: "0xwalletintent" })),
}));

vi.mock("../utils/wallet-sdk", () => ({
  useWallet: () => walletMock,
}));

/** Build a mock Response that resolves to the given JSON body. */
function mockResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    statusText: ok ? "OK" : "Service Unavailable",
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

describe("EdgeClient resilience", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Fake timers so retryAsync's backoff sleeps resolve instantly and
    // deterministically — no real wall-clock delay in the suite.
    vi.useFakeTimers();
    fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    window.sessionStorage.clear();
    window.localStorage.clear();
    walletMock.address.value = null;
    walletMock.connect.mockClear();
    walletMock.invokeContract.mockClear();
    walletMock.invokeWithConfirmation.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("retries a transient 5xx blip and resolves once the edge recovers", async () => {
    const payload = { value: 7 };
    fetchSpy
      .mockResolvedValueOnce(mockResponse({ message: "upstream down" }, false, 503))
      .mockResolvedValueOnce(mockResponse(payload, true, 200));
    const client = new EdgeClient("app-1", "https://edge.example.com");

    const promise = client.call("os-storage-get", { key: "foo" });
    // Flush the backoff timer between attempt 1 (503) and attempt 2 (200).
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toEqual(payload);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("retries a network-layer failure (fetch rejects with TypeError)", async () => {
    const payload = { ok: true, data: { streak: 3 } };
    fetchSpy
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(mockResponse(payload, true, 200));
    const client = new EdgeClient("app-1", "https://edge.example.com");

    const promise = client.call("os-checkin-streak");
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toEqual({ streak: 3 });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("does NOT retry a deterministic 4xx — fails fast after one attempt", async () => {
    fetchSpy.mockResolvedValue(mockResponse({ message: "key not found" }, false, 404));
    const client = new EdgeClient("app-1", "https://edge.example.com");

    const promise = client.call("os-storage-get");
    const assertion = expect(promise).rejects.toThrow(
      "OS service error (os-storage-get): key not found",
    );
    await vi.runAllTimersAsync();
    await assertion;

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("exhausts the bounded attempts when the edge stays down", async () => {
    fetchSpy.mockResolvedValue(mockResponse({ message: "still down" }, false, 502));
    const client = new EdgeClient("app-1", "https://edge.example.com");

    const promise = client.call("os-storage-get");
    const assertion = expect(promise).rejects.toThrow(/still down/);
    await vi.runAllTimersAsync();
    await assertion;

    // EDGE_RETRY_ATTEMPTS = 3 → one initial + two retries.
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it("submits the wallet intent exactly once even when the HTTP read was retried", async () => {
    const intent = {
      contract: "0xabc",
      operation: "claimRewards",
      args: [{ type: "Hash160", value: "SENDER" }],
    };
    fetchSpy
      .mockResolvedValueOnce(mockResponse({ message: "upstream down" }, false, 503))
      .mockResolvedValueOnce(mockResponse({ ok: true, data: intent }, true, 200));
    const client = new EdgeClient("app-1", "https://edge.example.com");

    const promise = client.call("os-checkin-claim");
    await vi.runAllTimersAsync();
    const result = await promise;

    // The transport blip retried (2 fetches) but the signing path — which is
    // deliberately outside the retry — ran exactly once.
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(walletMock.invokeWithConfirmation).toHaveBeenCalledOnce();
    expect(result).toEqual({
      ...intent,
      txid: "0xwalletintent",
      tx: "0xwalletintent",
    });
  });
});
