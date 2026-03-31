/**
 * Supabase Realtime Notifications Hook
 *
 * Subscribes to INSERT events on miniapp_notifications table via WebSocket.
 * Features:
 * - Initial fetch of existing notifications from Supabase
 * - Realtime push via postgres_changes (no polling)
 * - Auto-reconnect with exponential backoff
 * - Optional app_id / user_id filtering
 * - Callback on new notifications
 * - Max 50 recent notifications in memory
 * - Proper cleanup on unmount
 *
 * NOTE: The miniapp_notifications table must have Supabase Realtime enabled
 * in the Supabase dashboard (Database > Replication > source tables).
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { RealtimeChannel, REALTIME_SUBSCRIBE_STATES } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { MiniAppNotification } from "../components";
import { logger } from "../lib/logger";

export type UseRealtimeNotificationsOptions = {
  /** Callback invoked when a new notification arrives */
  onNotification?: (notification: MiniAppNotification) => void;
  /** Optional filter by app_id column */
  appId?: string;
  /** Optional filter by user_id column (for per-user notification channels) */
  userId?: string;
  /** Enable/disable subscription (default: true) */
  enabled?: boolean;
  /** Skip the initial fetch of existing notifications (default: false) */
  skipInitialFetch?: boolean;
};

export type UseRealtimeNotificationsReturn = {
  /** List of recent notifications (max 50) */
  notifications: MiniAppNotification[];
  /** WebSocket connection status */
  isConnected: boolean;
  /** Whether the initial fetch is in progress */
  loading: boolean;
  /** Connection or subscription error */
  error: Error | null;
  /** Manually trigger reconnection */
  reconnect: () => void;
};

const MAX_NOTIFICATIONS = 50;
const INITIAL_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 30000;

/**
 * Custom hook for subscribing to realtime MiniApp notifications
 */
export function useRealtimeNotifications(
  options: UseRealtimeNotificationsOptions = {},
): UseRealtimeNotificationsReturn {
  const { onNotification, appId, userId, enabled = true, skipInitialFetch = false } = options;

  // Check if running on client side
  const isClient = typeof window !== "undefined";

  const [notifications, setNotifications] = useState<MiniAppNotification[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const retryCountRef = useRef(0);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);
  const initialFetchDoneRef = useRef(false);

  /**
   * Calculate exponential backoff delay
   */
  const getRetryDelay = useCallback((): number => {
    const delay = Math.min(INITIAL_RETRY_DELAY_MS * Math.pow(2, retryCountRef.current), MAX_RETRY_DELAY_MS);
    return delay;
  }, []);

  /**
   * Handle new notification from realtime subscription
   */
  const handleInsert = useCallback(
    (payload: { new: MiniAppNotification }) => {
      try {
        const newNotification = payload.new as MiniAppNotification;

        // Apply appId filter if specified
        if (appId && newNotification.app_id !== appId) {
          return;
        }

        setNotifications((prev) => {
          const updated = [newNotification, ...prev];
          // Keep only the most recent MAX_NOTIFICATIONS
          return updated.slice(0, MAX_NOTIFICATIONS);
        });

        // Invoke callback if provided
        if (onNotification) {
          onNotification(newNotification);
        }

        // Reset retry count on successful message
        retryCountRef.current = 0;
      } catch (err) {
        logger.error("Error processing notification:", err);
        setError(err instanceof Error ? err : new Error("Unknown error processing notification"));
      }
    },
    [appId, onNotification],
  );

  /**
   * Fetch existing notifications from Supabase on initial load
   */
  const fetchInitial = useCallback(async () => {
    if (skipInitialFetch || !isClient || !isSupabaseConfigured) return;
    if (initialFetchDoneRef.current) return;

    setLoading(true);
    try {
      let query = supabase
        .from("miniapp_notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(MAX_NOTIFICATIONS);

      if (appId) {
        query = query.eq("app_id", appId);
      }
      if (userId) {
        query = query.eq("user_id", userId);
      }

      const { data, error: fetchError } = await query;

      if (!mountedRef.current) return;

      if (fetchError) {
        logger.warn("Realtime notifications: Initial fetch failed", fetchError);
        // Non-fatal: realtime subscription will still deliver new notifications
      } else if (data) {
        setNotifications(data as MiniAppNotification[]);
      }

      initialFetchDoneRef.current = true;
    } catch (err) {
      if (mountedRef.current) {
        logger.warn("Realtime notifications: Initial fetch error", err);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [skipInitialFetch, isClient, appId, userId]);

  /**
   * Subscribe to Supabase Realtime channel
   */
  const subscribe = useCallback(() => {
    // Cleanup existing channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    // Clear any pending retry
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    if (!enabled) {
      setIsConnected(false);
      return;
    }

    // Skip if not on client side or Supabase is not configured
    if (!isClient || !isSupabaseConfigured) {
      setIsConnected(false);
      return;
    }

    // Build channel name scoped to user/app for efficient filtering
    const channelName = userId
      ? `notifications:${userId}`
      : "miniapp-notifications-channel";

    // Build postgres_changes filter for server-side row filtering
    const pgFilter: Record<string, string> = {};
    if (userId) {
      pgFilter.filter = `user_id=eq.${userId}`;
    }

    try {
      const channel = supabase
        .channel(channelName)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "miniapp_notifications",
            ...pgFilter,
          },
          handleInsert,
        )
        .subscribe((status, err) => {
          if (!mountedRef.current) return;

          if (status === REALTIME_SUBSCRIBE_STATES.SUBSCRIBED) {
            setIsConnected(true);
            setError(null);
            retryCountRef.current = 0;
            logger.info("Realtime notifications: Connected");
          } else if (status === REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR) {
            setIsConnected(false);
            const errorObj = err || new Error("Channel subscription error");
            setError(errorObj);
            logger.error("Realtime notifications: Channel error", errorObj);

            // Schedule reconnection with exponential backoff
            const delay = getRetryDelay();
            retryCountRef.current += 1;
            logger.debug(`Reconnecting in ${delay}ms (attempt ${retryCountRef.current})...`);

            retryTimeoutRef.current = setTimeout(() => {
              if (mountedRef.current && enabled) {
                subscribe();
              }
            }, delay);
          } else if (status === REALTIME_SUBSCRIBE_STATES.TIMED_OUT) {
            setIsConnected(false);
            setError(new Error("Subscription timed out"));
            logger.warn("Realtime notifications: Subscription timed out");

            // Retry immediately on timeout
            retryCountRef.current += 1;
            const delay = getRetryDelay();
            retryTimeoutRef.current = setTimeout(() => {
              if (mountedRef.current && enabled) {
                subscribe();
              }
            }, delay);
          } else if (status === REALTIME_SUBSCRIBE_STATES.CLOSED) {
            setIsConnected(false);
            logger.debug("Realtime notifications: Channel closed");
          }
        });

      channelRef.current = channel;
    } catch (err) {
      logger.error("Failed to create Realtime channel:", err);
      setError(err instanceof Error ? err : new Error("Failed to create Realtime channel"));
      setIsConnected(false);
    }
  }, [enabled, isClient, userId, handleInsert, getRetryDelay]);

  /**
   * Manually trigger reconnection (resets retry count)
   */
  const reconnect = useCallback(() => {
    retryCountRef.current = 0;
    subscribe();
  }, [subscribe]);

  /**
   * Setup and cleanup subscription
   */
  useEffect(() => {
    mountedRef.current = true;
    initialFetchDoneRef.current = false;

    // Fetch existing notifications, then subscribe for new ones
    fetchInitial();
    subscribe();

    return () => {
      mountedRef.current = false;

      // Clear retry timeout
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }

      // Unsubscribe from channel
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }

      setIsConnected(false);
    };
  }, [fetchInitial, subscribe]);

  return {
    notifications,
    isConnected,
    loading,
    error,
    reconnect,
  };
}
