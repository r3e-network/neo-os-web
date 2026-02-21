/**
 * Supabase Realtime Notifications Hook
 *
 * Subscribes to INSERT events on miniapp_notifications table via WebSocket.
 * Features:
 * - Auto-reconnect with exponential backoff
 * - Optional app_id filtering
 * - Callback on new notifications
 * - Max 50 recent notifications in memory
 * - Proper cleanup on unmount
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
  /** Enable/disable subscription (default: true) */
  enabled?: boolean;
};

export type UseRealtimeNotificationsReturn = {
  /** List of recent notifications (max 50) */
  notifications: MiniAppNotification[];
  /** WebSocket connection status */
  isConnected: boolean;
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
  const { onNotification, appId, enabled = true } = options;

  // Check if running on client side
  const isClient = typeof window !== "undefined";

  const [notifications, setNotifications] = useState<MiniAppNotification[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const retryCountRef = useRef(0);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

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

    try {
      const channel = supabase
        .channel("miniapp-notifications-channel")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "miniapp_notifications",
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
  }, [enabled, isClient, handleInsert, getRetryDelay]);

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
  }, [subscribe]);

  return {
    notifications,
    isConnected,
    error,
    reconnect,
  };
}
