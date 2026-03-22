import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { NotificationPreferences, NotificationEvent, ChainHealthStatus } from "./types";
import { fetchJSON, fetchOK, toApiError } from "@/lib/fetch-client";

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

type PreferencesResponse = {
  preferences?: NotificationPreferences;
};

type EventsResponse = {
  events?: NotificationEvent[];
};

function errorMessage(err: unknown, fallback: string): string {
  return toApiError(err).message || fallback;
}

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
          const data = await fetchJSON<PreferencesResponse>(
            `/api/notifications/preferences?wallet=${encodeURIComponent(walletAddress)}`,
          );
          set({ preferences: data.preferences || { ...defaultPreferences, walletAddress }, loading: false });
        } catch (err) {
          set({ loading: false, error: errorMessage(err, "Load failed") });
        }
      },

      updatePreferences: async (prefs: Partial<NotificationPreferences>) => {
        const { preferences } = get();
        if (!preferences) return;
        set({ loading: true, error: null });
        try {
          await fetchOK("/api/notifications/preferences", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...preferences, ...prefs }),
          });
          set({ preferences: { ...preferences, ...prefs }, loading: false });
        } catch (err) {
          set({ loading: false, error: errorMessage(err, "Update failed") });
        }
      },

      bindEmail: async (email: string) => {
        const { preferences } = get();
        if (!preferences) return;
        set({ loading: true, error: null });
        try {
          await fetchOK("/api/notifications/bind-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ wallet: preferences.walletAddress, email }),
          });
          set({
            loading: false,
          });
        } catch (err) {
          set({ loading: false, error: errorMessage(err, "Bind failed") });
        }
      },

      verifyEmail: async (code: string) => {
        const { preferences } = get();
        if (!preferences) return false;
        try {
          await fetchOK("/api/notifications/verify-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ wallet: preferences.walletAddress, code }),
          });
          set({ preferences: { ...preferences, emailVerified: true } });
          return true;
        } catch (e: unknown) {
          console.warn("[notifications] verifyEmailCode failed:", e instanceof Error ? e.message : String(e));
          return false;
        }
      },

      loadEvents: async () => {
        const { preferences } = get();
        if (!preferences) return;
        try {
          const data = await fetchJSON<EventsResponse>(
            `/api/notifications/events?wallet=${encodeURIComponent(preferences.walletAddress)}`,
          );
          set({ events: data.events || [] });
        } catch (e: unknown) {
          console.warn("[notifications] loadEvents failed:", e instanceof Error ? e.message : String(e));
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
