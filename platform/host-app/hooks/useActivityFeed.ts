import { useState, useEffect, useCallback, useMemo } from "react";
import type { MiniAppNotification, OnChainActivity } from "../components/types";
import { logger } from "../lib/logger";
import { fetchJSON, toApiError } from "@/lib/fetch-client";
import { useRealtimeNotifications } from "./useRealtimeNotifications";
import { getRpcNetwork } from "@/lib/rpc-helpers";
import type { NeoNetwork } from "@/lib/neo-network";

interface UseActivityFeedOptions {
  appId?: string;
  network?: NeoNetwork;
  pollInterval?: number;
  maxItems?: number;
  enabled?: boolean;
  /**
   * Gates the realtime notifications subscription (one Supabase channel + one
   * `/api/app/{id}/news` fetch). Defaults to `enabled` so the activity feed
   * keeps merging live notifications on its own; the detail page narrows it to
   * the news-tab gate so a single subscription serves both the activity merge
   * and the news tab without a duplicate page-level subscription.
   */
  newsEnabled?: boolean;
}

interface ActivityFeedState {
  activities: OnChainActivity[];
  loading: boolean;
  error: string | null;
  isConnected: boolean;
  /** Raw realtime notifications behind the merged activity list. */
  notifications: MiniAppNotification[];
  /** True while the initial notifications fetch is in flight. */
  notificationsLoading: boolean;
  /** Realtime (Supabase) notifications channel connection status. */
  notificationsConnected: boolean;
}

const DEFAULT_POLL_INTERVAL = 5000;
const DEFAULT_MAX_ITEMS = 100;

function isExpectedFetchAbort(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const name = err.name.toLowerCase();
  const message = err.message.toLowerCase();
  return (
    name === "aborterror" ||
    name === "timeouterror" ||
    message.includes("signal timed out") ||
    message.includes("operation was aborted")
  );
}

export function useActivityFeed(options: UseActivityFeedOptions = {}): ActivityFeedState {
  const {
    appId,
    network = getRpcNetwork(),
    pollInterval = DEFAULT_POLL_INTERVAL,
    maxItems = DEFAULT_MAX_ITEMS,
    enabled = true,
    newsEnabled = enabled,
  } = options;

  // Realtime notifications via WebSocket (replaces REST polling for
  // notifications). A single subscription drives both the merged activity list
  // and the surfaced news feed; the caller gates it via `newsEnabled`.
  const {
    notifications: realtimeNotifications,
    loading: notificationsLoading,
    isConnected: notificationsConnected,
  } = useRealtimeNotifications({
    appId,
    network,
    enabled: newsEnabled,
  });

  const [activities, setActivities] = useState<OnChainActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const fetchActivities = useCallback(
    async (isInitial = false) => {
      if (!enabled) return;

      try {
        const params = new URLSearchParams();
        if (appId) params.set("app_id", appId);
        params.set("network", network);
        params.set("limit", "50");

        const fetchMaybe = async <T,>(url: string): Promise<T | null> => {
          try {
            return await fetchJSON<T>(url);
          } catch (_e: unknown) {
            if (!isExpectedFetchAbort(_e)) {
              console.warn("[useActivityFeed] fetch failed:", _e instanceof Error ? _e.message : String(_e));
            }
            return null;
          }
        };

        // Fetch events and transactions in parallel
        // NOTE: Notifications are now delivered via Supabase Realtime WebSocket
        // (useRealtimeNotifications) instead of REST polling here.
        const [eventsData, txData] = await Promise.all([
          fetchMaybe<{ events?: Array<Record<string, unknown>> }>(`/api/activity/events?${params}`),
          fetchMaybe<{ transactions?: Array<Record<string, unknown>> }>(`/api/activity/transactions?${params}`),
        ]);

        const newActivities: OnChainActivity[] = [];

        // Process events
        if (eventsData) {
          const events = eventsData.events || [];
          for (const evt of events) {
            newActivities.push(transformEvent(evt));
          }
        }

        // Process transactions
        if (txData) {
          const txs = txData.transactions || [];
          for (const tx of txs) {
            newActivities.push(transformTransaction(tx));
          }
        }

        // Sort by timestamp descending
        newActivities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        // Merge with existing activities (dedupe by id)
        setActivities((prev) => {
          const merged = isInitial ? newActivities : mergeActivities(prev, newActivities);
          return merged.slice(0, maxItems);
        });

        setIsConnected(true);
        setError(null);
      } catch (err) {
        const msg = toApiError(err).message || "Failed to fetch activities";
        logger.error("Activity feed error:", err);
        setError(msg);
        setIsConnected(false);
      } finally {
        setLoading(false);
      }
    },
    [appId, enabled, maxItems, network],
  );

  // Initial fetch
  useEffect(() => {
    if (enabled) {
      fetchActivities(true);
    }
  }, [enabled, fetchActivities]);

  // Polling — paused while the document is hidden so a backgrounded tab does
  // not keep re-downloading both activity endpoints every interval. A refresh
  // fires immediately when the tab becomes visible again.
  useEffect(() => {
    if (!enabled || pollInterval <= 0) return;

    let active = true;
    const isHidden = () =>
      typeof document !== "undefined" && document.visibilityState === "hidden";

    const interval = setInterval(() => {
      if (!active || isHidden()) return;
      fetchActivities(false);
    }, pollInterval);

    const handleVisibilityChange = () => {
      if (!active || isHidden()) return;
      fetchActivities(false);
    };

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }

    return () => {
      active = false;
      clearInterval(interval);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      }
    };
  }, [enabled, pollInterval, fetchActivities]);

  // Merge realtime notifications into the activity list
  const mergedActivities = useMemo(() => {
    const notifActivities = realtimeNotifications.map((notif) =>
      transformNotification(notif as unknown as Record<string, unknown>),
    );
    const combined = mergeActivities(activities, notifActivities);
    return combined.slice(0, maxItems);
  }, [activities, realtimeNotifications, maxItems]);

  return {
    activities: mergedActivities,
    loading,
    error,
    isConnected,
    notifications: realtimeNotifications,
    notificationsLoading,
    notificationsConnected,
  };
}

// Helper functions
function mergeActivities(existing: OnChainActivity[], incoming: OnChainActivity[]): OnChainActivity[] {
  const seen = new Set(existing.map((a) => a.id));
  const merged = [...existing];

  for (const activity of incoming) {
    if (!seen.has(activity.id)) {
      merged.unshift(activity);
      seen.add(activity.id);
    }
  }

  return merged.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

function normalizeActivityNetwork(value: unknown): NeoNetwork | null {
  return value === "mainnet" || value === "testnet" ? value : null;
}

function transformEvent(evt: Record<string, unknown>): OnChainActivity {
  return {
    id: `evt-${evt.id}`,
    type: "event",
    app_id: evt.app_id ? String(evt.app_id) : null,
    title: String(evt.event_name || "Contract Event"),
    description: formatEventDescription(evt),
    network: normalizeActivityNetwork(evt.network),
    tx_hash: evt.tx_hash ? String(evt.tx_hash) : undefined,
    timestamp: String(evt.created_at || new Date().toISOString()),
    status: "confirmed",
  };
}

function transformTransaction(tx: Record<string, unknown>): OnChainActivity {
  const status = String(tx.status || "pending");
  return {
    id: `tx-${tx.id}`,
    type: "transaction",
    app_id: extractAppIdFromRequestId(String(tx.request_id || "")),
    title: `${tx.method_name || "Transaction"}`,
    description: formatTxDescription(tx),
    network: normalizeActivityNetwork(tx.network),
    tx_hash: tx.tx_hash ? String(tx.tx_hash) : undefined,
    timestamp: String(tx.submitted_at || new Date().toISOString()),
    status: status === "confirmed" ? "confirmed" : status === "failed" ? "failed" : "pending",
  };
}

function transformNotification(notif: Record<string, unknown>): OnChainActivity {
  return {
    id: `notif-${notif.id}`,
    type: "notification",
    app_id: notif.app_id ? String(notif.app_id) : null,
    title: String(notif.title || "Notification"),
    description: String(notif.content || ""),
    network: normalizeActivityNetwork(notif.network),
    tx_hash: notif.tx_hash ? String(notif.tx_hash) : undefined,
    timestamp: String(notif.created_at || new Date().toISOString()),
  };
}

function formatEventDescription(evt: Record<string, unknown>): string {
  const contract = evt.contract_hash ? String(evt.contract_hash).slice(0, 10) : "unknown";
  return `Contract ${contract}... emitted event`;
}

function formatTxDescription(tx: Record<string, unknown>): string {
  const service = tx.from_service ? String(tx.from_service) : "platform";
  const gas = tx.gas_consumed ? `${tx.gas_consumed} GAS` : "";
  return `${service}${gas ? ` • ${gas}` : ""}`;
}

function extractAppIdFromRequestId(requestId: string): string | null {
  // Request IDs often contain app_id as prefix
  const parts = requestId.split("-");
  if (parts.length > 1 && parts[0].startsWith("com.")) {
    return parts[0];
  }
  return null;
}

export default useActivityFeed;
