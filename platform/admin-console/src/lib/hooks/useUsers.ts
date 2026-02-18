// =============================================================================
// React Query Hooks - Users
// =============================================================================

import { useQuery } from "@tanstack/react-query";
import { getAdminAuthHeaders } from "@/lib/admin-client";
import { DEFAULT_STALE_TIME_MS, HEALTH_POLL_INTERVAL_MS } from "@/lib/constants";
import type { User } from "@/types";

/**
 * Fetch all users
 */
async function fetchUsers(): Promise<User[]> {
  const response = await fetch("/api/users", {
    headers: getAdminAuthHeaders(),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch users: ${response.status}`);
  }
  return response.json();
}

/**
 * Fetch single user by ID
 */
async function fetchUser(userId: string): Promise<User> {
  const response = await fetch(`/api/users?id=${encodeURIComponent(userId)}`, {
    headers: getAdminAuthHeaders(),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch user ${userId}: ${response.status}`);
  }
  const result = (await response.json()) as User[];
  if (!result || result.length === 0) {
    throw new Error(`User ${userId} not found`);
  }
  return result[0];
}

/**
 * Hook to fetch all users
 */
export function useUsers() {
  return useQuery<User[]>({
    queryKey: ["users"],
    queryFn: fetchUsers,
    staleTime: DEFAULT_STALE_TIME_MS,
  });
}

/**
 * Hook to fetch single user
 */
export function useUser(userId: string) {
  return useQuery<User>({
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
  return useQuery<User[]>({
    queryKey: ["users", "search", searchTerm],
    queryFn: async (): Promise<User[]> => {
      if (!searchTerm) return [];
      const response = await fetch(`/api/users?search=${encodeURIComponent(searchTerm)}`, {
        headers: getAdminAuthHeaders(),
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) {
        throw new Error(`Failed to search users: ${response.status}`);
      }
      return (await response.json()) as User[];
    },
    enabled: searchTerm.length > 0,
    staleTime: HEALTH_POLL_INTERVAL_MS,
  });
}
