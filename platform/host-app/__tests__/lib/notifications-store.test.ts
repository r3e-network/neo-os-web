/**
 * Notification Store Tests
 */

jest.mock("@/lib/security/wallet-auth-client", () => ({
  getWalletAuthHeaders: jest.fn().mockResolvedValue({
    "x-wallet-address": "NXtest",
    "x-wallet-publickey": "03aa",
    "x-wallet-signature": "deadbeef",
    "x-wallet-message": "{}",
  }),
}));

import { useNotificationStore } from "@/lib/notifications/store";

// Mock fetch
global.fetch = jest.fn();

describe("useNotificationStore", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useNotificationStore.setState({
      notifications: [],
      unreadCount: 0,
      loading: false,
      error: null,
    });
  });

  describe("fetchNotifications", () => {
    it("should fetch notifications for a wallet", async () => {
      const mockNotifications = [
        { id: "n1", message: "App approved", read: false },
        { id: "n2", message: "New review", read: true },
      ];

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            notifications: mockNotifications,
            unreadCount: 1,
          }),
      });

      await useNotificationStore.getState().fetchNotifications("NXwallet1");

      const state = useNotificationStore.getState();
      expect(state.notifications).toEqual(mockNotifications);
      expect(state.unreadCount).toBe(1);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
      expect(fetch).toHaveBeenCalledWith("/api/notifications", {
        headers: { "x-wallet-address": "NXwallet1" },
      });
    });

    it("should not fetch without wallet address", async () => {
      await useNotificationStore.getState().fetchNotifications("");

      expect(fetch).not.toHaveBeenCalled();
    });

    it("should handle non-ok response", async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await useNotificationStore.getState().fetchNotifications("NXwallet1");

      const state = useNotificationStore.getState();
      expect(state.error).toBeTruthy();
      expect(state.loading).toBe(false);
    });

    it("should handle network error", async () => {
      (fetch as jest.Mock).mockRejectedValueOnce(new Error("Network error"));

      await useNotificationStore.getState().fetchNotifications("NXwallet1");

      const state = useNotificationStore.getState();
      expect(state.error).toContain("Network error");
      expect(state.loading).toBe(false);
    });

    it("should handle missing data gracefully", async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(),
      });

      await useNotificationStore.getState().fetchNotifications("NXwallet1");

      const state = useNotificationStore.getState();
      expect(state.notifications).toEqual([]);
      expect(state.unreadCount).toBe(0);
    });
  });

  describe("markAsRead", () => {
    it("should mark specific notifications as read", async () => {
      useNotificationStore.setState({
        notifications: [
          { id: "n1", message: "msg1", read: false } as never,
          { id: "n2", message: "msg2", read: false } as never,
          { id: "n3", message: "msg3", read: false } as never,
        ],
        unreadCount: 3,
      });

      (fetch as jest.Mock).mockResolvedValueOnce({ ok: true });

      await useNotificationStore.getState().markAsRead("NXwallet1", ["n1", "n3"]);

      const state = useNotificationStore.getState();
      expect(state.notifications[0]).toHaveProperty("read", true);
      expect(state.notifications[1]).toHaveProperty("read", false);
      expect(state.notifications[2]).toHaveProperty("read", true);
      expect(state.unreadCount).toBe(1);
    });

    it("should not call API without wallet", async () => {
      await useNotificationStore.getState().markAsRead("", ["n1"]);
      expect(fetch).not.toHaveBeenCalled();
    });

    it("should not call API with empty ids", async () => {
      await useNotificationStore.getState().markAsRead("NXwallet1", []);
      expect(fetch).not.toHaveBeenCalled();
    });

    it("should handle API failure gracefully", async () => {
      const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

      useNotificationStore.setState({
        notifications: [{ id: "n1", message: "msg1", read: false } as never],
        unreadCount: 1,
      });

      (fetch as jest.Mock).mockRejectedValueOnce(new Error("fail"));

      await useNotificationStore.getState().markAsRead("NXwallet1", ["n1"]);

      // State should remain unchanged on error (catch swallows)
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });

  describe("markAllAsRead", () => {
    it("should mark all notifications as read", async () => {
      useNotificationStore.setState({
        notifications: [
          { id: "n1", message: "msg1", read: false } as never,
          { id: "n2", message: "msg2", read: false } as never,
        ],
        unreadCount: 2,
      });

      (fetch as jest.Mock).mockResolvedValueOnce({ ok: true });

      await useNotificationStore.getState().markAllAsRead("NXwallet1");

      const state = useNotificationStore.getState();
      expect(state.notifications.every((n) => n.read)).toBe(true);
      expect(state.unreadCount).toBe(0);
    });

    it("should not call API without wallet", async () => {
      await useNotificationStore.getState().markAllAsRead("");
      expect(fetch).not.toHaveBeenCalled();
    });

    it("should send correct payload", async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({ ok: true });

      await useNotificationStore.getState().markAllAsRead("NXwallet1");

      expect(fetch).toHaveBeenCalledWith(
        "/api/notifications",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ all: true }),
        }),
      );
    });
  });

  describe("clear", () => {
    it("should reset all state", () => {
      useNotificationStore.setState({
        notifications: [{ id: "n1", message: "msg", read: false } as never],
        unreadCount: 5,
        error: "some error",
      });

      useNotificationStore.getState().clear();

      const state = useNotificationStore.getState();
      expect(state.notifications).toEqual([]);
      expect(state.unreadCount).toBe(0);
      expect(state.error).toBeNull();
    });
  });
});
