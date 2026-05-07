/**
 * Unit tests for useRealtimeNotifications hook
 * Target: ≥90% coverage
 */

import { renderHook, waitFor, act } from "@testing-library/react";
import { useRealtimeNotifications } from "../../hooks/useRealtimeNotifications";
import { supabase } from "../../lib/supabase";
import { MiniAppNotification } from "../../components";
import { REALTIME_SUBSCRIBE_STATES } from "@supabase/supabase-js";

// Mock query builder for initial fetch
const mockQueryBuilder = {
  select: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  then: jest.fn(),
};

// Default: resolve with empty data
mockQueryBuilder.limit.mockImplementation(function (
  this: typeof mockQueryBuilder,
) {
  // Return a thenable that resolves with empty data
  const thenable = {
    ...this,
    then: (
      resolve: (value: { data: MiniAppNotification[]; error: null }) => void,
    ) => {
      resolve({ data: [], error: null });
      return thenable;
    },
  };
  return thenable;
});

// Mock Supabase client
jest.mock("../../lib/supabase", () => ({
  supabase: {
    channel: jest.fn(),
    removeChannel: jest.fn(),
    from: jest.fn(() => mockQueryBuilder),
  },
  isSupabaseConfigured: true,
}));

// Mock logger to always output (bypass NODE_ENV check)
jest.mock("../../lib/logger", () => ({
  logger: {
    debug: (message: string, ...args: unknown[]) =>
      console.log(`[DEBUG] ${message}`, ...args),
    info: (message: string, ...args: unknown[]) =>
      console.log(`[INFO] ${message}`, ...args),
    warn: (message: string, ...args: unknown[]) =>
      console.warn(`[WARN] ${message}`, ...args),
    error: (message: string, error?: unknown) =>
      console.error(`[ERROR] ${message}`, error),
  },
}));

describe("useRealtimeNotifications", () => {
  let mockChannel: any;
  let subscribeCallback: any;
  let insertHandler: any;
  let consoleErrorSpy: jest.SpyInstance;
  let consoleLogSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;
  let fetchMock: jest.Mock;
  let originalFetch: typeof global.fetch | undefined;
  const originalConsoleError = console.error;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation((...args) => {
        const message = args[0];
        if (
          typeof message === "string" &&
          message.startsWith("[ERROR] Realtime notifications: Channel error")
        ) {
          return;
        }
        originalConsoleError(...args);
      });
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    originalFetch = global.fetch;
    fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ items: [] }),
    } as Response);
    global.fetch = fetchMock as unknown as typeof global.fetch;

    // Mock channel object
    mockChannel = {
      on: jest.fn(),
      subscribe: jest.fn(),
    };

    // Setup mock channel chain
    mockChannel.on.mockReturnValue(mockChannel);
    mockChannel.subscribe.mockImplementation((callback: any) => {
      subscribeCallback = callback;
      return mockChannel;
    });

    (supabase.channel as jest.Mock).mockReturnValue(mockChannel);
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    if (originalFetch) global.fetch = originalFetch;
    else Reflect.deleteProperty(global, "fetch");
  });

  describe("Subscription Lifecycle", () => {
    it("should initialize with empty notifications and disconnected state", () => {
      const { result } = renderHook(() =>
        useRealtimeNotifications({ skipInitialFetch: true }),
      );

      expect(result.current.notifications).toEqual([]);
      expect(result.current.isConnected).toBe(false);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe(null);
    });

    it("should create channel with correct configuration", () => {
      renderHook(() => useRealtimeNotifications({ skipInitialFetch: true }));

      expect(supabase.channel).toHaveBeenCalledWith(
        "miniapp-notifications-channel",
      );
      expect(mockChannel.on).toHaveBeenCalledWith(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "miniapp_notifications",
        },
        expect.any(Function),
      );
      expect(mockChannel.subscribe).toHaveBeenCalledWith(expect.any(Function));
    });

    it("should use user-scoped channel name when userId is provided", () => {
      renderHook(() =>
        useRealtimeNotifications({ userId: "user-42", skipInitialFetch: true }),
      );

      expect(supabase.channel).toHaveBeenCalledWith("notifications:user-42");
      expect(mockChannel.on).toHaveBeenCalledWith(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "miniapp_notifications",
          filter: "user_id=eq.user-42",
        },
        expect.any(Function),
      );
    });

    it("should set isConnected to true when subscription succeeds", async () => {
      const { result } = renderHook(() =>
        useRealtimeNotifications({ skipInitialFetch: true }),
      );

      act(() => {
        subscribeCallback(REALTIME_SUBSCRIBE_STATES.SUBSCRIBED, null);
      });

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
        expect(result.current.error).toBe(null);
      });
    });

    it("should cleanup channel on unmount", () => {
      const { unmount } = renderHook(() =>
        useRealtimeNotifications({ skipInitialFetch: true }),
      );

      unmount();

      expect(supabase.removeChannel).toHaveBeenCalledWith(mockChannel);
    });

    it("should not subscribe when enabled is false", () => {
      const { result } = renderHook(() =>
        useRealtimeNotifications({ enabled: false, skipInitialFetch: true }),
      );

      expect(supabase.channel).not.toHaveBeenCalled();
      expect(result.current.isConnected).toBe(false);
    });
  });

  describe("Notification Handling", () => {
    it("should add new notification to state on INSERT event", async () => {
      const { result } = renderHook(() =>
        useRealtimeNotifications({ skipInitialFetch: true }),
      );

      // Capture the insert handler
      const onCallArgs = mockChannel.on.mock.calls[0];
      insertHandler = onCallArgs[2];

      const mockNotification: MiniAppNotification = {
        id: "1",
        app_id: "test-app",
        title: "Test Notification",
        content: "Test content",
        notification_type: "info",
        source: "contract",
        created_at: new Date().toISOString(),
      };

      act(() => {
        insertHandler({ new: mockNotification });
      });

      await waitFor(() => {
        expect(result.current.notifications).toHaveLength(1);
        expect(result.current.notifications[0]).toEqual(mockNotification);
      });
    });

    it("should invoke onNotification callback when new notification arrives", async () => {
      const mockCallback = jest.fn();
      renderHook(() =>
        useRealtimeNotifications({
          onNotification: mockCallback,
          skipInitialFetch: true,
        }),
      );

      const onCallArgs = mockChannel.on.mock.calls[0];
      insertHandler = onCallArgs[2];

      const mockNotification: MiniAppNotification = {
        id: "2",
        app_id: "test-app",
        title: "Callback Test",
        content: "Content",
        notification_type: "info",
        source: "contract",
        created_at: new Date().toISOString(),
      };

      act(() => {
        insertHandler({ new: mockNotification });
      });

      await waitFor(() => {
        expect(mockCallback).toHaveBeenCalledWith(mockNotification);
      });
    });

    it("should filter notifications by appId when specified", async () => {
      const mockCallback = jest.fn();
      const { result } = renderHook(() =>
        useRealtimeNotifications({
          appId: "app-1",
          onNotification: mockCallback,
          skipInitialFetch: true,
        }),
      );

      const onCallArgs = mockChannel.on.mock.calls[0];
      insertHandler = onCallArgs[2];

      const notification1: MiniAppNotification = {
        id: "1",
        app_id: "app-1",
        title: "Matching App",
        content: "Content",
        notification_type: "info",
        source: "contract",
        created_at: new Date().toISOString(),
      };

      const notification2: MiniAppNotification = {
        id: "2",
        app_id: "app-2",
        title: "Different App",
        content: "Content",
        notification_type: "info",
        source: "contract",
        created_at: new Date().toISOString(),
      };

      act(() => {
        insertHandler({ new: notification1 });
        insertHandler({ new: notification2 });
      });

      await waitFor(() => {
        expect(result.current.notifications).toHaveLength(1);
        expect(result.current.notifications[0].app_id).toBe("app-1");
        expect(mockCallback).toHaveBeenCalledTimes(1);
        expect(mockCallback).toHaveBeenCalledWith(notification1);
      });
    });

    it("should keep only 50 most recent notifications", async () => {
      const { result } = renderHook(() =>
        useRealtimeNotifications({ skipInitialFetch: true }),
      );

      const onCallArgs = mockChannel.on.mock.calls[0];
      insertHandler = onCallArgs[2];

      // Insert 60 notifications
      act(() => {
        for (let i = 0; i < 60; i++) {
          const notification: MiniAppNotification = {
            id: `${i}`,
            app_id: "test-app",
            title: `Notification ${i}`,
            content: "Content",
            notification_type: "info",
            source: "contract",
            created_at: new Date().toISOString(),
          };
          insertHandler({ new: notification });
        }
      });

      await waitFor(() => {
        expect(result.current.notifications).toHaveLength(50);
        // Most recent should be first (id: '59')
        expect(result.current.notifications[0].id).toBe("59");
        // Oldest in the list should be id: '10'
        expect(result.current.notifications[49].id).toBe("10");
      });
    });

    it("should handle errors during notification processing", async () => {
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();
      const mockCallback = jest.fn().mockImplementation(() => {
        throw new Error("Callback error");
      });

      const { result } = renderHook(() =>
        useRealtimeNotifications({
          onNotification: mockCallback,
          skipInitialFetch: true,
        }),
      );

      const onCallArgs = mockChannel.on.mock.calls[0];
      insertHandler = onCallArgs[2];

      const notification: MiniAppNotification = {
        id: "1",
        app_id: "test-app",
        title: "Error Test",
        content: "Content",
        notification_type: "info",
        source: "contract",
        created_at: new Date().toISOString(),
      };

      // Callback will throw error
      act(() => {
        insertHandler({ new: notification });
      });

      await waitFor(() => {
        // The hook should catch the error and set it in state
        expect(result.current.error).not.toBe(null);
        expect(consoleErrorSpy).toHaveBeenCalled();
      });
    });
  });

  describe("Error Handling and Reconnection", () => {
    it("should set error state on CHANNEL_ERROR", async () => {
      const { result } = renderHook(() =>
        useRealtimeNotifications({ skipInitialFetch: true }),
      );

      const testError = new Error("Channel connection failed");

      act(() => {
        subscribeCallback(REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR, testError);
      });

      await waitFor(() => {
        expect(result.current.isConnected).toBe(false);
        expect(result.current.error).toEqual(testError);
      });
    });

    it("should retry connection with exponential backoff on CHANNEL_ERROR", async () => {
      consoleLogSpy.mockClear();
      renderHook(() => useRealtimeNotifications({ skipInitialFetch: true }));

      // First error
      act(() => {
        subscribeCallback(
          REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR,
          new Error("Test"),
        );
      });

      await waitFor(() => {
        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining("[DEBUG] Reconnecting in 1000ms (attempt 1)"),
        );
      });

      // Advance timer and trigger second error
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      await waitFor(() => {
        expect(supabase.channel).toHaveBeenCalledTimes(2);
      });

      // Trigger another error
      act(() => {
        subscribeCallback(
          REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR,
          new Error("Test"),
        );
      });

      await waitFor(() => {
        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining("[DEBUG] Reconnecting in 2000ms (attempt 2)"),
        );
      });
    });

    it("should cap retry delay at 30 seconds", async () => {
      consoleLogSpy.mockClear();
      renderHook(() => useRealtimeNotifications({ skipInitialFetch: true }));

      // Simulate 10 failed attempts
      for (let i = 0; i < 10; i++) {
        act(() => {
          subscribeCallback(
            REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR,
            new Error("Test"),
          );
        });

        if (i < 9) {
          act(() => {
            jest.runOnlyPendingTimers();
          });
        }
      }

      await waitFor(() => {
        // After many retries, delay should be capped at 30000ms
        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining("[DEBUG] Reconnecting in 30000ms"),
        );
      });
    });

    it("should handle TIMED_OUT status and retry", async () => {
      const { result } = renderHook(() =>
        useRealtimeNotifications({ skipInitialFetch: true }),
      );

      act(() => {
        subscribeCallback(REALTIME_SUBSCRIBE_STATES.TIMED_OUT, null);
      });

      await waitFor(() => {
        expect(result.current.isConnected).toBe(false);
        expect(result.current.error?.message).toBe("Subscription timed out");
      });

      // Should schedule retry - run all pending timers
      await act(async () => {
        jest.runAllTimers();
      });

      expect(supabase.channel).toHaveBeenCalledTimes(2);
    });

    it("should handle CLOSED status", async () => {
      consoleLogSpy.mockClear();
      const { result } = renderHook(() =>
        useRealtimeNotifications({ skipInitialFetch: true }),
      );

      act(() => {
        subscribeCallback(REALTIME_SUBSCRIBE_STATES.CLOSED, null);
      });

      await waitFor(() => {
        expect(result.current.isConnected).toBe(false);
        expect(consoleLogSpy).toHaveBeenCalledWith(
          "[DEBUG] Realtime notifications: Channel closed",
        );
      });
    });

    it("should reset retry count on successful message", async () => {
      const { result } = renderHook(() =>
        useRealtimeNotifications({ skipInitialFetch: true }),
      );

      // First connect successfully
      act(() => {
        subscribeCallback(REALTIME_SUBSCRIBE_STATES.SUBSCRIBED, null);
      });

      const onCallArgs = mockChannel.on.mock.calls[0];
      insertHandler = onCallArgs[2];

      // Simulate some errors to increase retry count
      act(() => {
        subscribeCallback(
          REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR,
          new Error("Test"),
        );
      });

      act(() => {
        jest.advanceTimersByTime(1000);
      });

      // Now send a successful message
      const notification: MiniAppNotification = {
        id: "1",
        app_id: "test-app",
        title: "Reset Test",
        content: "Content",
        notification_type: "info",
        source: "contract",
        created_at: new Date().toISOString(),
      };

      act(() => {
        insertHandler({ new: notification });
      });

      // Trigger another error - should start from delay 1000ms again
      consoleLogSpy.mockClear();

      act(() => {
        subscribeCallback(
          REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR,
          new Error("Test"),
        );
      });

      await waitFor(() => {
        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining("[DEBUG] Reconnecting in 1000ms (attempt 1)"),
        );
      });
    });
  });

  describe("Manual Reconnection", () => {
    it("should provide reconnect function that resets retry count", async () => {
      const { result } = renderHook(() =>
        useRealtimeNotifications({ skipInitialFetch: true }),
      );

      // Simulate error to increase retry count
      act(() => {
        subscribeCallback(
          REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR,
          new Error("Test"),
        );
      });

      act(() => {
        jest.advanceTimersByTime(1000);
      });

      // Manual reconnect
      act(() => {
        result.current.reconnect();
      });

      // Should create new channel
      await waitFor(() => {
        expect(supabase.channel).toHaveBeenCalled();
      });

      // Trigger error after manual reconnect - should use initial delay
      consoleLogSpy.mockClear();

      act(() => {
        subscribeCallback(
          REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR,
          new Error("Test"),
        );
      });

      await waitFor(() => {
        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining("[DEBUG] Reconnecting in 1000ms (attempt 1)"),
        );
      });
    });

    it("should cleanup existing channel before reconnecting", () => {
      const { result } = renderHook(() =>
        useRealtimeNotifications({ skipInitialFetch: true }),
      );

      act(() => {
        result.current.reconnect();
      });

      expect(supabase.removeChannel).toHaveBeenCalledWith(mockChannel);
    });
  });

  describe("Cleanup and Memory Management", () => {
    it("should clear retry timeout on unmount", () => {
      const { unmount } = renderHook(() =>
        useRealtimeNotifications({ skipInitialFetch: true }),
      );

      // Trigger error to schedule retry
      act(() => {
        subscribeCallback(
          REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR,
          new Error("Test"),
        );
      });

      const clearTimeoutSpy = jest.spyOn(global, "clearTimeout");

      unmount();

      // Should not attempt to reconnect after unmount
      act(() => {
        jest.advanceTimersByTime(5000);
      });

      expect(supabase.channel).toHaveBeenCalledTimes(1); // Only initial call

      clearTimeoutSpy.mockRestore();
    });

    it("should not update state after unmount", async () => {
      const { result, unmount } = renderHook(() =>
        useRealtimeNotifications({ skipInitialFetch: true }),
      );

      const onCallArgs = mockChannel.on.mock.calls[0];
      insertHandler = onCallArgs[2];

      unmount();

      const notification: MiniAppNotification = {
        id: "1",
        app_id: "test-app",
        title: "After Unmount",
        content: "Content",
        notification_type: "info",
        source: "contract",
        created_at: new Date().toISOString(),
      };

      // This should not cause state update warnings
      act(() => {
        insertHandler({ new: notification });
      });

      // State should remain empty
      expect(result.current.notifications).toEqual([]);
    });
  });

  describe("Initial Fetch", () => {
    it("should fetch existing notifications on mount when skipInitialFetch is false", async () => {
      const mockNotifications: MiniAppNotification[] = [
        {
          id: "existing-1",
          app_id: "test-app",
          title: "Existing Notification",
          content: "Already in database",
          notification_type: "info",
          source: "contract",
          created_at: new Date().toISOString(),
        },
      ];

      // Override the mock to return data
      const mockFrom = supabase.from as jest.Mock;
      const mockSelect = jest.fn().mockReturnThis();
      const mockOrder = jest.fn().mockReturnThis();
      const mockLimit = jest
        .fn()
        .mockResolvedValue({ data: mockNotifications, error: null });

      mockFrom.mockReturnValue({
        select: mockSelect,
        order: mockOrder,
        limit: mockLimit,
        eq: jest.fn().mockReturnThis(),
      });
      // Chain: select -> order -> limit (limit returns the promise)
      mockSelect.mockReturnValue({
        order: mockOrder,
        eq: jest.fn().mockReturnThis(),
        limit: mockLimit,
      });
      mockOrder.mockReturnValue({
        order: mockOrder,
        eq: jest.fn().mockReturnThis(),
        limit: mockLimit,
      });

      const { result } = renderHook(() => useRealtimeNotifications());

      await waitFor(() => {
        expect(result.current.notifications).toHaveLength(1);
        expect(result.current.notifications[0].id).toBe("existing-1");
        expect(result.current.loading).toBe(false);
      });
    });

    it("should not fetch when skipInitialFetch is true", () => {
      renderHook(() => useRealtimeNotifications({ skipInitialFetch: true }));

      expect(supabase.from).not.toHaveBeenCalled();
    });

    it("should fetch app-scoped initial notifications through the host news API", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [
            {
              id: "api-1",
              app_id: "my-app",
              title: "API notification",
              content: "Loaded through host API",
              notification_type: "info",
              source: "contract",
              created_at: new Date().toISOString(),
            },
          ],
        }),
      } as Response);

      const { result } = renderHook(() =>
        useRealtimeNotifications({ appId: "my-app" }),
      );

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(
          "/api/app/my-app/news?limit=50",
          expect.objectContaining({ method: "GET" }),
        );
        expect(result.current.notifications).toHaveLength(1);
        expect(result.current.notifications[0].id).toBe("api-1");
      });
      expect(supabase.from).not.toHaveBeenCalledWith("miniapp_notifications");
    });

    it("should include network when fetching app-scoped notifications", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ items: [] }),
      } as Response);

      renderHook(() =>
        useRealtimeNotifications({ appId: "my-app", network: "testnet" }),
      );

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(
          "/api/app/my-app/news?limit=50&network=testnet",
          expect.objectContaining({ method: "GET" }),
        );
      });
    });
  });
});
