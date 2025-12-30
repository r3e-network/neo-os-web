import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { NotificationPreferences, NotificationEvent, ChainHealthStatus, DigestFrequency } from "./types";

interface NotificationState {
  preferences: NotificationPreferences | null;
  events: NotificationEvent[];
  chainHealth: ChainHealthStatus | null;
  loading: boolean;
  error: string | null;
}

interface NotificationActions {
  loadPreferences: (walletAddress: string) => Promise<void>;
  updatePreferences: (prefs: Partial<NotificationPreferences>) => Promise<void>;
  bindEmail: (email: string) => Promise<void>;
  verifyEmail: (code: string) => Promise<boolean>;
  loadEvents: () => Promise<void>;
  markAsRead: (eventId: string) => void;
  clearError: () => void;
}

type NotificationStore = NotificationState & NotificationActions;

const defaultPreferences: NotificationPreferences = {
  walletAddress: "",
  email: null,
  emailVerified: false,
  notifyMiniappResults: true,
  notifyBalanceChanges: true,
  notifyChainAlerts: false,
  digestFrequency: "instant",
};

export const useNotificationStore = create<NotificationStore>()(
  persist(
    (set, get) => ({
      preferences: null,
      events: [],
      chainHealth: null,
      loading: false,
      error: null,

      loadPreferences: async (walletAddress: string) => {
        set({ loading: true, error: null });
        try {
          const res = await fetch(`/api/notifications/preferences?wallet=${walletAddress}`);
          if (!res.ok) throw new Error("Failed to load preferences");
          const data = await res.json();
          set({ preferences: data.preferences || { ...defaultPreferences, walletAddress }, loading: false });
        } catch (err) {
          set({ loading: false, error: err instanceof Error ? err.message : "Load failed" });
        }
      },

      updatePreferences: async (prefs: Partial<NotificationPreferences>) => {
        const { preferences } = get();
        if (!preferences) return;
        set({ loading: true });
        try {
          const res = await fetch("/api/notifications/preferences", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...preferences, ...prefs }),
          });
          if (!res.ok) throw new Error("Update failed");
          set({ preferences: { ...preferences, ...prefs }, loading: false });
        } catch (err) {
          set({ loading: false, error: err instanceof Error ? err.message : "Update failed" });
        }
      },

      bindEmail: async (email: string) => {
        const { preferences } = get();
        if (!preferences) return;
        set({ loading: true });
        try {
          const res = await fetch("/api/notifications/bind-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ wallet: preferences.walletAddress, email }),
          });
          if (!res.ok) throw new Error("Bind failed");
          set({
            preferences: { ...preferences, email, emailVerified: false },
            loading: false,
          });
        } catch (err) {
          set({ loading: false, error: err instanceof Error ? err.message : "Bind failed" });
        }
      },

      verifyEmail: async (code: string) => {
        const { preferences } = get();
        if (!preferences) return false;
        try {
          const res = await fetch("/api/notifications/verify-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ wallet: preferences.walletAddress, code }),
          });
          if (!res.ok) return false;
          set({ preferences: { ...preferences, emailVerified: true } });
          return true;
        } catch {
          return false;
        }
      },

      loadEvents: async () => {
        const { preferences } = get();
        if (!preferences) return;
        try {
          const res = await fetch(`/api/notifications/events?wallet=${preferences.walletAddress}`);
          if (!res.ok) return;
          const data = await res.json();
          set({ events: data.events || [] });
        } catch {
          // Silent fail for events
        }
      },

      markAsRead: (eventId: string) => {
        const { events } = get();
        set({
          events: events.map((e) => (e.id === eventId ? { ...e, read: true } : e)),
        });
      },

      clearError: () => set({ error: null }),
    }),
    { name: "notification-store" },
  ),
);
