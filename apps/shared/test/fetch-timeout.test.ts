import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_FETCH_TIMEOUT_MS,
  FetchTimeoutError,
  fetchWithTimeout,
} from "../utils/fetch-timeout";

type FetchInit = { signal?: AbortSignal } & Record<string, unknown>;

/** A fetch stub that never resolves until its signal aborts. */
function hangingFetch() {
  return vi.fn(
    (_url: string, init?: FetchInit) =>
      new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal;
        if (signal?.aborted) {
          reject(new Error("aborted before dispatch"));
          return;
        }
        signal?.addEventListener("abort", () => reject(new Error("request aborted")), {
          once: true,
        });
      }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("fetchWithTimeout", () => {
  it("passes through the response and request init on success", async () => {
    const response = { ok: true, json: async () => ({ value: 1 }) };
    const fetchMock = vi.fn(async () => response);
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchWithTimeout("https://example.test/api", {
        method: "POST",
        body: "{}",
      }),
    ).resolves.toBe(response);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.test/api",
      expect.objectContaining({
        method: "POST",
        body: "{}",
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it("rejects with FetchTimeoutError when the deadline expires", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", hangingFetch());

    const promise = fetchWithTimeout("https://example.test/slow", {
      timeoutMs: 5_000,
    });
    const assertion = expect(promise).rejects.toThrowError(FetchTimeoutError);
    await vi.advanceTimersByTimeAsync(5_000);
    await assertion;
    await expect(
      (async () => {
        vi.stubGlobal("fetch", hangingFetch());
        const p = fetchWithTimeout("https://example.test/slow", { timeoutMs: 1_000 });
        const rejection = p.catch((e) => e);
        await vi.advanceTimersByTimeAsync(1_000);
        return rejection;
      })(),
    ).resolves.toMatchObject({
      name: "FetchTimeoutError",
      message: "Request to https://example.test/slow timed out after 1000ms",
      timeoutMs: 1_000,
    });
  });

  it("uses the 10s default deadline when timeoutMs is omitted", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", hangingFetch());

    const promise = fetchWithTimeout("https://example.test/slow");
    const assertion = expect(promise).rejects.toThrowError(FetchTimeoutError);
    await vi.advanceTimersByTimeAsync(DEFAULT_FETCH_TIMEOUT_MS);
    await assertion;
  });

  it("propagates a caller abort unchanged (not as FetchTimeoutError)", async () => {
    vi.stubGlobal("fetch", hangingFetch());
    const controller = new AbortController();

    const promise = fetchWithTimeout("https://example.test/api", {
      signal: controller.signal,
    });
    controller.abort();
    await expect(promise).rejects.toThrow("request aborted");
    await expect(promise).rejects.not.toThrowError(FetchTimeoutError);
  });

  it("aborts immediately when the caller signal is already aborted", async () => {
    vi.stubGlobal("fetch", hangingFetch());
    const controller = new AbortController();
    controller.abort();

    await expect(
      fetchWithTimeout("https://example.test/api", { signal: controller.signal }),
    ).rejects.toThrow("aborted before dispatch");
  });

  it("removes its abort listener from the caller signal after settling", async () => {
    const response = { ok: true };
    vi.stubGlobal("fetch", vi.fn(async () => response));
    const controller = new AbortController();
    const addSpy = vi.spyOn(controller.signal, "addEventListener");
    const removeSpy = vi.spyOn(controller.signal, "removeEventListener");

    await fetchWithTimeout("https://example.test/api", {
      signal: controller.signal,
    });
    const abortAdds = addSpy.mock.calls.filter(([event]) => event === "abort");
    const abortRemoves = removeSpy.mock.calls.filter(
      ([event]) => event === "abort",
    );
    expect(abortAdds.length).toBeGreaterThan(0);
    expect(abortRemoves.length).toBe(abortAdds.length);
  });
});
