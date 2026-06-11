import { afterEach, describe, expect, it, vi } from "vitest";
import { createEventsComposable } from "../utils/wallet-sdk-composables";
import type { WalletSdkComposableDeps } from "../utils/wallet-sdk-composables";
import type { WalletSDK } from "../utils/wallet-sdk-types";

const APP_ID = "miniapp-test-events";
const CONTRACT = `0x${"ab".repeat(20)}`;

function makeDeps(): WalletSdkComposableDeps {
  return {
    platformApi: "",
    useWallet: () => ({}) as unknown as WalletSDK,
    // jsdom URL has no ?network → mainnet; the app id is not in the static
    // registry, so the manifest fallback supplies the contract hash and the
    // N3Index fetch path activates.
    loadCurrentMiniAppManifest: async () => ({
      id: APP_ID,
      contracts: { "neo-n3-mainnet": CONTRACT },
    }),
    errorCodes: {
      ELIGIBILITY_CHECK_FAILED: "ELIGIBILITY_CHECK_FAILED",
      PLATFORM_API_NOT_CONFIGURED: "PLATFORM_API_NOT_CONFIGURED",
      WALLET_NOT_CONNECTED: "WALLET_NOT_CONNECTED",
      SPONSORSHIP_REQUEST_FAILED: "SPONSORSHIP_REQUEST_FAILED",
      PAYMENT_INVALID_AMOUNT: "PAYMENT_INVALID_AMOUNT",
      MINIAPP_CONTRACT_UNAVAILABLE: "MINIAPP_CONTRACT_UNAVAILABLE",
    },
  };
}

type FetchInit = { signal?: AbortSignal } & Record<string, unknown>;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("useEvents waitForEvent abort handling", () => {
  it("aborts an in-flight N3Index fetch instead of waiting on a hung connection", async () => {
    // A hung indexer connection: the fetch settles ONLY via its AbortSignal.
    // Without signal propagation into fetch, waitForEvent would hang forever.
    const fetchMock = vi.fn(
      (_url: string, init?: FetchInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            "abort",
            () => reject(new Error("request aborted")),
            { once: true },
          );
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const events = createEventsComposable(makeDeps());
    const controller = new AbortController();
    const wait = events.waitForEvent(
      "0xtx",
      "Settled",
      APP_ID,
      60_000,
      controller.signal,
    );
    // Let the poll issue its fetch, then cancel mid-flight.
    await new Promise((resolve) => setTimeout(resolve, 20));
    controller.abort();

    await expect(wait).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(
      (fetchMock.mock.calls[0]?.[1] as FetchInit | undefined)?.signal,
    ).toBeInstanceOf(AbortSignal);
  });

  it("does not leak abort listeners on the caller signal across poll cycles", async () => {
    vi.useFakeTimers();
    const emptyResponse = { ok: true, json: async () => [] };
    vi.stubGlobal("fetch", vi.fn(async () => emptyResponse));

    const events = createEventsComposable(makeDeps());
    const controller = new AbortController();
    const addSpy = vi.spyOn(controller.signal, "addEventListener");
    const removeSpy = vi.spyOn(controller.signal, "removeEventListener");

    const wait = events.waitForEvent(
      "0xtx",
      "Settled",
      APP_ID,
      9_000,
      controller.signal,
    );
    await vi.advanceTimersByTimeAsync(10_000);
    await expect(wait).resolves.toBeNull();

    const abortAdds = addSpy.mock.calls.filter(([event]) => event === "abort");
    const abortRemoves = removeSpy.mock.calls.filter(
      ([event]) => event === "abort",
    );
    expect(abortAdds.length).toBeGreaterThan(0);
    // Every listener registered during polling/fetching must be removed once
    // the timer wins — previously one listener per cycle stayed behind.
    expect(abortRemoves.length).toBe(abortAdds.length);
  });
});
