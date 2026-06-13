/**
 * useActivityFeed polling tests.
 *
 * Regressions covered:
 * - polling must PAUSE while the document is hidden (a backgrounded tab used
 *   to keep re-downloading both activity endpoints every interval forever)
 * - a refresh fires as soon as the tab becomes visible again
 * - the dead incremental-fetch cursors were removed: no cursor/after_id param
 *   is sent (the endpoints' after_id means "older than", so wiring the stored
 *   newest-id into it would have paginated backwards)
 */

import { renderHook, act, waitFor } from "@testing-library/react";
import { useActivityFeed } from "../../hooks/useActivityFeed";
import { useRealtimeNotifications } from "../../hooks/useRealtimeNotifications";
import type { MiniAppNotification } from "../../components/types";

jest.mock("../../hooks/useRealtimeNotifications", () => ({
  useRealtimeNotifications: jest.fn(() => ({
    notifications: [],
    loading: false,
    isConnected: false,
    error: null,
    reconnect: jest.fn(),
  })),
}));

const useRealtimeNotificationsMock =
  useRealtimeNotifications as jest.MockedFunction<
    typeof useRealtimeNotifications
  >;

jest.mock("../../lib/fetch-client", () => ({
  fetchJSON: jest.fn(),
  toApiError: (err: unknown) => ({
    message: err instanceof Error ? err.message : String(err),
  }),
}));

jest.mock("../../lib/rpc-helpers", () => ({
  getRpcNetwork: jest.fn(() => "testnet"),
}));

import { fetchJSON } from "../../lib/fetch-client";

const fetchJSONMock = fetchJSON as jest.MockedFunction<typeof fetchJSON>;

const POLL_INTERVAL = 5000;

function setVisibilityState(state: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => state,
  });
}

function emptyPayloads() {
  fetchJSONMock.mockImplementation(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/api/activity/events")) return { events: [] };
    return { transactions: [] };
  });
}

async function flushFetches() {
  // Drain the microtask queue so in-flight fetch promises settle.
  await act(async () => {
    await Promise.resolve();
  });
}

describe("useActivityFeed polling", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    fetchJSONMock.mockReset();
    emptyPayloads();
    setVisibilityState("visible");
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("fetches events and transactions initially and on each poll tick while visible", async () => {
    renderHook(() =>
      useActivityFeed({ appId: "miniapp-demo", pollInterval: POLL_INTERVAL }),
    );
    await flushFetches();
    expect(fetchJSONMock).toHaveBeenCalledTimes(2); // events + transactions

    await act(async () => {
      jest.advanceTimersByTime(POLL_INTERVAL);
    });
    await flushFetches();
    expect(fetchJSONMock).toHaveBeenCalledTimes(4);
  });

  it("never sends a cursor param (after_id paginates older, not newer)", async () => {
    renderHook(() =>
      useActivityFeed({ appId: "miniapp-demo", pollInterval: POLL_INTERVAL }),
    );
    await flushFetches();
    await act(async () => {
      jest.advanceTimersByTime(POLL_INTERVAL);
    });
    await flushFetches();

    for (const [url] of fetchJSONMock.mock.calls) {
      expect(String(url)).not.toContain("after_id");
      expect(String(url)).not.toContain("since_id");
    }
  });

  it("pauses polling while the document is hidden", async () => {
    renderHook(() =>
      useActivityFeed({ appId: "miniapp-demo", pollInterval: POLL_INTERVAL }),
    );
    await flushFetches();
    expect(fetchJSONMock).toHaveBeenCalledTimes(2);

    setVisibilityState("hidden");
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await act(async () => {
      jest.advanceTimersByTime(POLL_INTERVAL * 3);
    });
    await flushFetches();

    // No additional fetches while hidden.
    expect(fetchJSONMock).toHaveBeenCalledTimes(2);
  });

  it("refreshes immediately when the document becomes visible again", async () => {
    renderHook(() =>
      useActivityFeed({ appId: "miniapp-demo", pollInterval: POLL_INTERVAL }),
    );
    await flushFetches();
    expect(fetchJSONMock).toHaveBeenCalledTimes(2);

    setVisibilityState("hidden");
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await act(async () => {
      jest.advanceTimersByTime(POLL_INTERVAL);
    });
    expect(fetchJSONMock).toHaveBeenCalledTimes(2);

    setVisibilityState("visible");
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await flushFetches();

    // Immediate catch-up fetch without waiting for the next tick.
    expect(fetchJSONMock).toHaveBeenCalledTimes(4);
  });

  it("merges fetched events into the activity list", async () => {
    fetchJSONMock.mockImplementation(async (input: RequestInfo | URL) => {
    const url = String(input);
      if (url.includes("/api/activity/events")) {
        return {
          events: [
            {
              id: 7,
              event_name: "Claimed",
              app_id: "miniapp-demo",
              network: "testnet",
              tx_hash: "0xabc",
              created_at: "2026-06-11T00:00:00.000Z",
            },
          ],
        };
      }
      return { transactions: [] };
    });

    const { result } = renderHook(() =>
      useActivityFeed({ appId: "miniapp-demo", pollInterval: 0 }),
    );
    await flushFetches();

    await waitFor(() => {
      expect(result.current.activities).toHaveLength(1);
    });
    expect(result.current.activities[0]).toMatchObject({
      id: "evt-7",
      type: "event",
      title: "Claimed",
      network: "testnet",
    });
  });
});

// The detail page used to mount useRealtimeNotifications a second time (once
// here, once at the page level) on the same channel + /news fetch. The realtime
// feed is now surfaced from this hook so a single subscription serves both the
// merged activity list and the news tab.
describe("useActivityFeed realtime surfacing", () => {
  beforeEach(() => {
    fetchJSONMock.mockReset();
    emptyPayloads();
    useRealtimeNotificationsMock.mockReset();
    useRealtimeNotificationsMock.mockImplementation(() => ({
      notifications: [],
      loading: false,
      isConnected: false,
      error: null,
      reconnect: jest.fn(),
    }));
  });

  it("surfaces the realtime notifications, loading and connection status", () => {
    const newsNotification: MiniAppNotification = {
      id: "n-1",
      app_id: "miniapp-demo",
      title: "Reward live",
      content: "A reward landed",
      notification_type: "info",
      source: "contract",
      network: "testnet",
      created_at: "2026-06-12T00:00:00.000Z",
    };
    useRealtimeNotificationsMock.mockImplementation(() => ({
      notifications: [newsNotification],
      loading: true,
      isConnected: true,
      error: null,
      reconnect: jest.fn(),
    }));

    const { result } = renderHook(() =>
      useActivityFeed({ appId: "miniapp-demo", pollInterval: 0 }),
    );

    expect(result.current.notifications).toEqual([newsNotification]);
    expect(result.current.notificationsLoading).toBe(true);
    expect(result.current.notificationsConnected).toBe(true);
  });

  it("subscribes to realtime by default (newsEnabled defaults to enabled)", () => {
    renderHook(() =>
      useActivityFeed({
        appId: "miniapp-demo",
        network: "testnet",
        pollInterval: 0,
      }),
    );

    expect(useRealtimeNotificationsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        appId: "miniapp-demo",
        network: "testnet",
        enabled: true,
      }),
    );
  });

  it("gates the single realtime subscription on newsEnabled", () => {
    renderHook(() =>
      useActivityFeed({
        appId: "miniapp-demo",
        pollInterval: 0,
        enabled: true,
        newsEnabled: false,
      }),
    );

    expect(useRealtimeNotificationsMock).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: false }),
    );
  });
});
