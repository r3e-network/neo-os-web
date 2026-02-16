// =============================================================================
// React Query Hooks - Users
// =============================================================================

import { useQuery } from "@tanstack/react-query";
import { supabaseClient } from "@/lib/api-client";
import { DEFAULT_STALE_TIME_MS, HEALTH_POLL_INTERVAL_MS } from "@/lib/constants";
import type { User } from "@/types";

/**
 * Fetch all users
 */
async function fetchUsers(): Promise<User[]> {
  return supabaseClient.query<User[]>("users", {
    select: "*",
    order: "created_at.desc",
  });
}

/**
 * Fetch single user by ID
 */
async function fetchUser(userId: string): Promise<User> {
  const result = await supabaseClient.query<User[]>("users", {
    select: "*",
    id: `eq.${userId}`,
  });
  if (!result || result.length === 0) {
    throw new Error(`User ${userId} not found`);
  }
  return result[0];
}

/**
 * Hook to fetch all users
 */
export function useUsers() {
  return useQuery({
    queryKey: ["users"],
    queryFn: fetchUsers,
    staleTime: DEFAULT_STALE_TIME_MS,
  });
}

/**
 * Hook to fetch single user
 */
export function useUser(userId: string) {
  return useQuery({
    queryKey: ["users", userId],
    queryFn: () => fetchUser(userId),
    enabled: !!userId,
    staleTime: DEFAULT_STALE_TIME_MS,
  });
}

/**
 * Hook to search users
 */
export function useSearchUsers(searchTerm: string) {
  return useQuery({
    queryKey: ["users", "search", searchTerm],
    queryFn: async () => {
      if (!searchTerm) return [];
      const sanitized = searchTerm.replace(/[%_\\,().]/g, '\\$&');
      return supabaseClient.query<User[]>("users", {
        select: "*",
        or: `address.ilike.%${sanitized}%,email.ilike.%${sanitized}%`,
      });
    },
    enabled: searchTerm.length > 0,
    staleTime: HEALTH_POLL_INTERVAL_MS,
  });
}
