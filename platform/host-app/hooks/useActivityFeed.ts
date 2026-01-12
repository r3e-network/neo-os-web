import { useState, useEffect, useCallback, useRef } from "react";
import type { OnChainActivity } from "../components/types";
import { logger } from "../lib/logger";

interface UseActivityFeedOptions {
  appId?: string;
  pollInterval?: number;
  maxItems?: number;
  enabled?: boolean;
}

interface ActivityFeedState {
  activities: OnChainActivity[];
  loading: boolean;
  error: string | null;
  isConnected: boolean;
}

const DEFAULT_POLL_INTERVAL = 5000;
const DEFAULT_MAX_ITEMS = 100;

export function useActivityFeed(options: UseActivityFeedOptions = {}): ActivityFeedState {
  const { appId, pollInterval = DEFAULT_POLL_INTERVAL, maxItems = DEFAULT_MAX_ITEMS, enabled = true } = options;

  const [activities, setActivities] = useState<OnChainActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const lastEventIdRef = useRef<string | null>(null);
  const lastTxIdRef = useRef<string | null>(null);

  const fetchActivities = useCallback(
    async (isInitial = false) => {
      if (!enabled) return;

      try {
        const params = new URLSearchParams();
        if (appId) params.set("app_id", appId);
        params.set("limit", "50");

        // Fetch events and transactions in parallel
        const [eventsRes, txRes, notifRes] = await Promise.all([
          fetch(`/api/activity/events?${params}`),
          fetch(`/api/activity/transactions?${params}`),
          fetch(`/api/miniapp-notifications?${params}&limit=20`),
        ]);

        const newActivities: OnChainActivity[] = [];

        // Process events
        if (eventsRes.ok) {
          const eventsData = await eventsRes.json();
          const events = eventsData.events || [];
          for (const evt of events) {
            newActivities.push(transformEvent(evt));
          }
          if (events.length > 0) {
            lastEventIdRef.current = events[0].id;
          }
        }

        // Process transactions
        if (txRes.ok) {
          const txData = await txRes.json();
          const txs = txData.transactions || [];
          for (const tx of txs) {
            newActivities.push(transformTransaction(tx));
          }
          if (txs.length > 0) {
            lastTxIdRef.current = txs[0].id;
          }
        }

        // Process notifications
        if (notifRes.ok) {
          const notifData = await notifRes.json();
          const notifs = notifData.notifications || [];
          for (const notif of notifs) {
            newActivities.push(transformNotification(notif));
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
        const msg = err instanceof Error ? err.message : "Failed to fetch activities";
        logger.error("Activity feed error:", err);
        setError(msg);
        setIsConnected(false);
      } finally {
        setLoading(false);
      }
    },
    [appId, enabled, maxItems],
  );

  // Initial fetch
  useEffect(() => {
    if (enabled) {
      fetchActivities(true);
    }
  }, [enabled, fetchActivities]);

  // Polling
  useEffect(() => {
    if (!enabled || pollInterval <= 0) return;

    const interval = setInterval(() => {
      fetchActivities(false);
    }, pollInterval);

    return () => clearInterval(interval);
  }, [enabled, pollInterval, fetchActivities]);

  return { activities, loading, error, isConnected };
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

function transformEvent(evt: Record<string, unknown>): OnChainActivity {
  return {
    id: `evt-${evt.id}`,
    type: "event",
    app_id: evt.app_id ? String(evt.app_id) : null,
    title: String(evt.event_name || "Contract Event"),
    description: formatEventDescription(evt),
    tx_hash: evt.tx_hash ? String(evt.tx_hash) : undefined,
    timestamp: String(evt.created_at || new Date().toISOString()),
    status: "confirmed",
  };
}

function transformTransaction(tx: Record<string, unknown>): OnChainActivity {
  const status = String(tx.status || "pending");
  // Support both service_requests schema and simulation_txs schema
  const appId = tx.app_id ? String(tx.app_id) : extractAppIdFromRequestId(String(tx.request_id || ""));
  const title = tx.tx_type ? formatTxType(String(tx.tx_type)) : String(tx.method_name || "Transaction");
  const timestamp = tx.created_at || tx.submitted_at || new Date().toISOString();

  return {
    id: `tx-${tx.id}`,
    type: "transaction",
    app_id: appId,
    title,
    description: formatTxDescription(tx),
    tx_hash: tx.tx_hash ? String(tx.tx_hash) : undefined,
    timestamp: String(timestamp),
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
    tx_hash: notif.tx_hash ? String(notif.tx_hash) : undefined,
    timestamp: String(notif.created_at || new Date().toISOString()),
  };
}

function formatEventDescription(evt: Record<string, unknown>): string {
  const contract = evt.contract_hash ? String(evt.contract_hash).slice(0, 10) : "unknown";
  return `Contract ${contract}... emitted event`;
}

function formatTxDescription(tx: Record<string, unknown>): string {
  // Support simulation_txs schema
  if (tx.amount !== undefined) {
    const amount = Number(tx.amount) / 100000000; // Convert from 8 decimals
    const address = tx.account_address ? String(tx.account_address).slice(0, 8) : "";
    return `${address}... • ${amount.toFixed(4)} GAS`;
  }
  // Support service_requests schema
  const service = tx.from_service ? String(tx.from_service) : "platform";
  const gas = tx.gas_consumed ? `${tx.gas_consumed} GAS` : "";
  return `${service}${gas ? ` • ${gas}` : ""}`;
}

function formatTxType(txType: string): string {
  const typeMap: Record<string, string> = {
    payment: "💰 Payment",
    request: "📤 Service Request",
    fulfill: "✅ Fulfillment",
    randomness: "🎲 Randomness",
    payout: "🎁 Payout",
    fund: "💵 Fund Transfer",
  };
  return typeMap[txType] || txType.charAt(0).toUpperCase() + txType.slice(1);
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
