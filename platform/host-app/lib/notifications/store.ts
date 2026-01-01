/**
 * Notification Store - Zustand store for notifications
 */

import { create } from "zustand";
import type { Notification } from "@/pages/api/notifications";

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
}

interface NotificationActions {
  fetchNotifications: (wallet: string) => Promise<void>;
  markAsRead: (wallet: string, ids: string[]) => Promise<void>;
  markAllAsRead: (wallet: string) => Promise<void>;
  clear: () => void;
}

type NotificationStore = NotificationState & NotificationActions;

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  loading: false,
  error: null,

  fetchNotifications: async (wallet: string) => {
    if (!wallet) return;
    set({ loading: true, error: null });

    try {
      const res = await fetch("/api/notifications", {
        headers: { "x-wallet-address": wallet },
      });

      if (!res.ok) throw new Error("Failed to fetch");

      const data = await res.json();
      set({
        notifications: data.notifications || [],
        unreadCount: data.unreadCount || 0,
        loading: false,
      });
    } catch (err) {
      set({ error: String(err), loading: false });
    }
  },

  markAsRead: async (wallet: string, ids: string[]) => {
    if (!wallet || ids.length === 0) return;

    try {
      await fetch("/api/notifications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-wallet-address": wallet,
        },
        body: JSON.stringify({ ids }),
      });

      // Update local state
      set((state) => ({
        notifications: state.notifications.map((n) => (ids.includes(n.id) ? { ...n, read: true } : n)),
        unreadCount: Math.max(0, state.unreadCount - ids.length),
      }));
    } catch {
      // Silent fail
    }
  },

  markAllAsRead: async (wallet: string) => {
    if (!wallet) return;

    try {
      await fetch("/api/notifications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-wallet-address": wallet,
        },
        body: JSON.stringify({ all: true }),
      });

      set((state) => ({
        notifications: state.notifications.map((n) => ({ ...n, read: true })),
        unreadCount: 0,
      }));
    } catch {
      // Silent fail
    }
  },

  clear: () => set({ notifications: [], unreadCount: 0, error: null }),
}));
