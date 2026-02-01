// =============================================================================
// React Query Hooks - Services Health
// =============================================================================

import { useQuery } from "@tanstack/react-query";
import { getAdminAuthHeaders } from "@/lib/admin-client";
import type { ServiceHealth } from "@/types";

/**
 * Fetch all services health status
 */
async function fetchServicesHealth(): Promise<ServiceHealth[]> {
  // Call Next.js API route that checks internal services
  const response = await fetch("/api/services/health", { headers: getAdminAuthHeaders() });
  if (!response.ok) {
    throw new Error("Failed to fetch services health");
  }
  return response.json();
}

/**
 * Hook to fetch services health with polling
 */
export function useServicesHealth(refetchInterval = 30000) {
  return useQuery({
    queryKey: ["services", "health"],
    queryFn: fetchServicesHealth,
    refetchInterval,
    staleTime: 10000,
  });
}

/**
 * Hook to fetch single service health
 */
export function useServiceHealth(serviceName: string) {
  return useQuery({
    queryKey: ["services", "health", serviceName],
    queryFn: async () => {
      const response = await fetch(`/api/services/health?service=${serviceName}`, {
        headers: getAdminAuthHeaders(),
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch ${serviceName} health`);
      }
      return response.json();
    },
    refetchInterval: 30000,
    staleTime: 10000,
  });
}
