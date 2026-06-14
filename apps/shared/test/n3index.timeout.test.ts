import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getContractEvents,
  waitForTransactionStatus,
} from "../utils/n3index";
import {
  DEFAULT_FETCH_TIMEOUT_MS,
  FetchTimeoutError,
} from "../utils/fetch-timeout";

const CONTRACT = "0xd2a4cff31913016155e38e474a2c06d08be276cf";

type FetchInit = { signal?: AbortSignal } & Record<string, unknown>;

/** A fetch stub that never resolves until its abort signal fires. */
function hangingFetch() {
  return vi.fn(
    (_url: string, init?: FetchInit) =>
      new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal;
        if (signal?.aborted) {
          reject(new Error("aborted before dispatch"));
          return;
        }
        signal?.addEventListener(
          "abort",
          () => reject(new Error("request aborted")),
          { once: true },
        );
      }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("n3index apiFetch timeout (B1)", () => {
  it("never-resolving indexer request times out instead of hanging forever", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", hangingFetch());

    const promise = getContractEvents("testnet", CONTRACT, { tx_hash: "0xabc" });
    const assertion = expect(promise).rejects.toBeInstanceOf(FetchTimeoutError);

    // Without the timeout this fetch would never settle. Advancing past the
    // per-request deadline makes the bare-fetch hang surface as a timeout.
    await vi.advanceTimersByTimeAsync(DEFAULT_FETCH_TIMEOUT_MS);
    await assertion;
  });

  it("a hung first poll resolves the deposit poller to a recoverable 'unreachable'", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", hangingFetch());

    // The deposit-confirmation poller calls getContractEvents -> apiFetch. A
    // single hung connection used to block inside `await fetch`, so the poll
    // deadline check never ran and the loop hung forever. With the per-request
    // timeout the first poll throws before any successful read, which the poller
    // maps to "unreachable" — a recoverable outcome the caller falls back on.
    const settled = waitForTransactionStatus(
      "testnet",
      "0xdeadbeef",
      CONTRACT,
      30_000,
      3_000,
    );

    await vi.advanceTimersByTimeAsync(DEFAULT_FETCH_TIMEOUT_MS);
    const result = await settled;

    expect(result).toEqual({ status: "unreachable", events: null });
    // Crucially this resolved well inside the 30s poll deadline — the
    // 10s request timeout fired first.
  });
});
