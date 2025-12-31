/**
 * useExecutionStatus Hook
 *
 * Real-time subscription to MiniApp execution status via Supabase Realtime.
 * Enables frontend to receive live updates from local backend through Supabase.
 */

import { useState, useEffect, useCallback } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

export type ExecutionStatus = "pending" | "processing" | "success" | "failed" | "timeout";

export interface Execution {
  id: number;
  request_id: string;
  app_id: string;
  user_address?: string;
  session_id?: string;
  status: ExecutionStatus;
  method: string;
  params?: Record<string, unknown>;
  result?: Record<string, unknown>;
  error_message?: string;
  error_code?: string;
  tx_hash?: string;
  tx_status?: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
}

interface UseExecutionStatusOptions {
  appId?: string;
  userAddress?: string;
  requestId?: string;
}

interface UseExecutionStatusReturn {
  executions: Execution[];
  isConnected: boolean;
  error: Error | null;
}

export function useExecutionStatus(options: UseExecutionStatusOptions = {}): UseExecutionStatusReturn {
  const { appId, userAddress, requestId } = options;
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      return;
    }

    let channel: RealtimeChannel | null = null;

    const setupSubscription = async () => {
      try {
        // Build filter for subscription
        let filter = "";
        if (requestId) {
          filter = `request_id=eq.${requestId}`;
        } else if (appId && userAddress) {
          filter = `app_id=eq.${appId},user_address=eq.${userAddress}`;
        } else if (appId) {
          filter = `app_id=eq.${appId}`;
        } else if (userAddress) {
          filter = `user_address=eq.${userAddress}`;
        }

        // Create channel with filter
        const channelName = `executions:${filter || "all"}`;
        channel = supabase.channel(channelName);

        // Subscribe to changes
        channel
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "miniapp_executions",
              filter: filter || undefined,
            },
            (payload) => {
              const newRecord = payload.new as Execution;
              const oldRecord = payload.old as Execution;

              setExecutions((prev) => {
                if (payload.eventType === "INSERT") {
                  return [newRecord, ...prev].slice(0, 50);
                }
                if (payload.eventType === "UPDATE") {
                  return prev.map((e) => (e.request_id === newRecord.request_id ? newRecord : e));
                }
                if (payload.eventType === "DELETE") {
                  return prev.filter((e) => e.request_id !== oldRecord.request_id);
                }
                return prev;
              });
            },
          )
          .subscribe((status) => {
            setIsConnected(status === "SUBSCRIBED");
            if (status === "CHANNEL_ERROR") {
              setError(new Error("Failed to subscribe to execution updates"));
            }
          });
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Subscription failed"));
      }
    };

    setupSubscription();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [appId, userAddress, requestId]);

  return { executions, isConnected, error };
}
