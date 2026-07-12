import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createEventsComposable,
  createPaymentsComposable,
} from "../utils/wallet-sdk-composables";
import type { WalletSdkComposableDeps } from "../utils/wallet-sdk-composables";
import type { WalletSDK } from "../utils/wallet-sdk-types";
import { useAllEvents } from "../composables/useAllEvents";

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
  vi.restoreAllMocks();
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

describe("useEvents list pagination over N3Index", () => {
  it("accepts the current {data,paging} response and verifies its exact event", async () => {
    const expected = {
      id: "evt-1",
      event_name: "EscrowCreated",
      state: [{ value: "1" }],
      txid: "0xescrow",
      block_time: "2026-07-11T00:00:00Z",
      block_index: 123,
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          data: [expected],
          paging: { count: 1, limit: 1, offset: 0 },
        }),
      })),
    );

    const events = createEventsComposable(makeDeps());
    await expect(
      events.waitForEvent("0xescrow", "EscrowCreated", APP_ID, 1_000),
    ).resolves.toMatchObject({
      id: "evt-1",
      event_name: "EscrowCreated",
      tx_hash: "0xescrow",
      state: expected.state,
    });
  });

  it.each([
    ["null payload", { ok: true, json: async () => null }],
    ["malformed envelope", { ok: true, json: async () => ({ data: null }) }],
    ["non-200 response", { ok: false, json: async () => ({ data: [] }) }],
  ])("fails closed for %s", async (_label, response) => {
    vi.stubGlobal("fetch", vi.fn(async () => response));
    const events = createEventsComposable(makeDeps());
    await expect(
      events.list({ app_id: APP_ID, event_name: "EscrowCreated", limit: 1 }),
    ).resolves.toEqual({ events: [], total: 0 });
  });

  it("drops malformed event rows instead of exposing unverifiable matches", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          data: [
            null,
            {},
            { id: "missing-tx", event_name: "EscrowCreated", state: [] },
            { id: "missing-state", event_name: "EscrowCreated", txid: "0xtx" },
          ],
          paging: { count: 4, limit: 4, offset: 0 },
        }),
      })),
    );

    const events = createEventsComposable(makeDeps());
    await expect(
      events.list({ app_id: APP_ID, event_name: "EscrowCreated", limit: 4 }),
    ).resolves.toEqual({ events: [] });
  });

  it("falls back quietly when an app has no registered contract hash", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    warnSpy.mockClear();
    const fetchMock = vi.fn(async (url: string) => {
      expect(url).toContain("/api/activity/events?");
      expect(url).not.toContain("/indexer/v1/");
      return {
        ok: true,
        json: async () => ({
          events: [{ event_name: "Solved", tx_hash: "0xplatform" }],
          total: 1,
        }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    try {
      const events = createEventsComposable({
        ...makeDeps(),
        platformApi: "https://platform.example",
        loadCurrentMiniAppManifest: async () => ({
          id: APP_ID,
          contracts: {},
        }),
      });
      const result = await events.list({
        app_id: APP_ID,
        event_name: "Solved",
        limit: 25,
      });

      expect(result.events).toHaveLength(1);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(
        warnSpy.mock.calls.some((call) =>
          call.some((item) => String(item).includes("missing contract hash")),
        ),
      ).toBe(false);
    } finally {
      warnSpy.mockRestore();
    }
  });

  // The legacy N3Index endpoint returned a bare page array with no overall
  // count. list() must leave `total` undefined so useAllEvents keeps
  // paginating on full pages — synthesizing total = page length made
  // listAllEvents stop after the first 50 events for every app.
  it("paginates through two full pages instead of stopping at a synthesized total", async () => {
    const pageSize = 50;
    const makePage = (offset: number, count: number) =>
      Array.from({ length: count }, (_, i) => ({
        id: offset + i,
        event_name: "Burned",
        state: [],
        txid: `0xtx${offset + i}`,
        block_time: "2026-06-11T00:00:00Z",
        block_index: offset + i,
      }));
    const fetchMock = vi.fn(async (url: string) => {
      const offset = Number(new URL(url).searchParams.get("offset") ?? "0");
      // Two full pages, then an empty page that ends the walk.
      const body =
        offset < pageSize * 2 ? makePage(offset, pageSize) : makePage(offset, 0);
      return { ok: true, json: async () => body };
    });
    vi.stubGlobal("fetch", fetchMock);

    const events = createEventsComposable(makeDeps());
    const { listAllEvents } = useAllEvents(events.list, APP_ID);
    const all = await listAllEvents("Burned");

    expect(all).toHaveLength(pageSize * 2);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const requestedOffsets = fetchMock.mock.calls.map(([url]) =>
      Number(new URL(String(url)).searchParams.get("offset") ?? "0"),
    );
    expect(requestedOffsets).toEqual([0, 50, 100]);
    expect((all[0] as { tx_hash: string }).tx_hash).toBe("0xtx0");
    expect((all[99] as { tx_hash: string }).tx_hash).toBe("0xtx99");
  });

  it("ends pagination on a short final page", async () => {
    const makePage = (offset: number, count: number) =>
      Array.from({ length: count }, (_, i) => ({
        id: offset + i,
        event_name: "Claimed",
        state: [],
        txid: `0xtx${offset + i}`,
        block_time: "2026-06-11T00:00:00Z",
        block_index: offset + i,
      }));
    const fetchMock = vi.fn(async (url: string) => {
      const offset = Number(new URL(url).searchParams.get("offset") ?? "0");
      const body = offset === 0 ? makePage(0, 50) : makePage(50, 3);
      return { ok: true, json: async () => body };
    });
    vi.stubGlobal("fetch", fetchMock);

    const events = createEventsComposable(makeDeps());
    const { listAllEvents } = useAllEvents(events.list, APP_ID);
    const all = await listAllEvents("Claimed");

    expect(all).toHaveLength(53);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("usePayments fixed-8 amount handling", () => {
  function makePaymentWallet() {
    return {
      address: { value: "NPaymentSender" },
      connect: vi.fn(async () => undefined),
      getContractAddress: vi.fn(async () => CONTRACT),
      invokeContract: vi.fn(async () => ({ txid: "0xpay" })),
    } as unknown as WalletSDK;
  }

  it("converts decimal GAS amounts exactly to fixed-8 base units", async () => {
    const wallet = makePaymentWallet();
    const payments = createPaymentsComposable(APP_ID, {
      ...makeDeps(),
      useWallet: () => wallet,
    });

    await expect(payments.payGAS("1.25", "memo")).resolves.toMatchObject({
      txid: "0xpay",
    });

    expect(wallet.invokeContract).toHaveBeenCalledWith(
      expect.objectContaining({
        scriptHash: "0xd2a4cff31913016155e38e474a2c06d08be276cf",
        operation: "transfer",
        args: expect.arrayContaining([
          { type: "Integer", value: "125000000" },
        ]),
      }),
    );
  });

  it("rejects malformed or sub-fixed8 GAS amounts before opening the wallet", async () => {
    const wallet = makePaymentWallet();
    const payments = createPaymentsComposable(APP_ID, {
      ...makeDeps(),
      useWallet: () => wallet,
    });

    await expect(payments.payGAS("1abc", "memo")).rejects.toThrow(
      /Invalid amount/,
    );
    await expect(payments.payGAS("1.000000001", "memo")).rejects.toThrow(
      /Invalid amount/,
    );
    await expect(payments.payGAS("0.000000004", "memo")).rejects.toThrow(
      /Invalid amount/,
    );

    expect(wallet.connect).not.toHaveBeenCalled();
    expect(wallet.invokeContract).not.toHaveBeenCalled();
  });
});
