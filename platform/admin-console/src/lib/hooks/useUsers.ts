// =============================================================================
// React Query Hooks - Users
// Queries go through server-side API routes (not direct Supabase client)
// =============================================================================

import { useQuery } from "@tanstack/react-query";
import { getAdminAuthHeaders } from "@/lib/admin-client";
import type { User } from "@/types";

type UsersResponse = {
  users: User[];
  total: number;
  page: number;
  pageSize: number;
};

/**
 * Fetch users via server-side API route
 */
async function fetchUsers(page: number, pageSize: number): Promise<UsersResponse> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  const response = await fetch(`/api/users?${params.toString()}`, {
    headers: getAdminAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error("Failed to fetch users");
  }
  return response.json();
}

/**
 * Hook to fetch all users with pagination
 */
export function useUsers(page = 1, pageSize = 20) {
  return useQuery({
    queryKey: ["users", page, pageSize],
    queryFn: () => fetchUsers(page, pageSize),
    staleTime: 60000,
  });
}

/**
 * Hook to fetch single user (via filtered list)
 */
export function useUser(userId: string) {
  return useQuery({
    queryKey: ["users", userId],
    queryFn: async () => {
      const response = await fetch(`/api/users?search=${encodeURIComponent(userId)}&pageSize=1`, {
        headers: getAdminAuthHeaders(),
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch user ${userId}`);
      }
      const data: UsersResponse = await response.json();
      if (!data.users.length) {
        throw new Error(`User ${userId} not found`);
      }
      return data.users[0];
    },
    enabled: !!userId,
    staleTime: 60000,
  });
}

/**
 * Hook to search users via server-side API route
 */
export function useSearchUsers(searchTerm: string, page = 1, pageSize = 20) {
  return useQuery({
    queryKey: ["users", "search", searchTerm, page, pageSize],
    queryFn: async (): Promise<UsersResponse> => {
      if (!searchTerm) return { users: [], total: 0, page: 1, pageSize };
      const params = new URLSearchParams({
        search: searchTerm.trim(),
        page: String(page),
        pageSize: String(pageSize),
      });
      const response = await fetch(`/api/users?${params.toString()}`, {
        headers: getAdminAuthHeaders(),
      });
      if (!response.ok) {
        throw new Error("Failed to search users");
      }
      return response.json();
    },
    enabled: searchTerm.length > 0,
    staleTime: 30000,
  });
}
