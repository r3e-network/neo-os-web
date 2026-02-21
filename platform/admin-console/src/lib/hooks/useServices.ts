// =============================================================================
// React Query Hooks - Services Health
// =============================================================================

import { useQuery } from "@tanstack/react-query";
import { getAdminAuthHeaders } from "@/lib/admin-client";
import { HEALTH_POLL_INTERVAL_MS, HEALTH_STALE_TIME_MS } from "@/lib/constants";
import type { ServiceHealth } from "@/types";

/**
 * Fetch all services health status
 */
async function fetchServicesHealth(): Promise<ServiceHealth[]> {
  // Call Next.js API route that checks internal services
  const response = await fetch("/api/services/health", { headers: getAdminAuthHeaders(), signal: AbortSignal.timeout(15000) });
  if (!response.ok) {
    throw new Error(`Failed to fetch services health: ${response.status}`);
  }
  return response.json();
}

/**
 * Hook to fetch services health with polling
 */
export function useServicesHealth(refetchInterval = HEALTH_POLL_INTERVAL_MS) {
  return useQuery({
    queryKey: ["services", "health"],
    queryFn: fetchServicesHealth,
    refetchInterval,
    staleTime: HEALTH_STALE_TIME_MS,
  });
}

/**
 * Hook to fetch single service health
 */
export function useServiceHealth(serviceName: string) {
  return useQuery({
    queryKey: ["services", "health", serviceName],
    queryFn: async () => {
      const response = await fetch(`/api/services/health?service=${encodeURIComponent(serviceName)}`, {
        headers: getAdminAuthHeaders(),
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch ${serviceName} health: ${response.status}`);
      }
      return response.json();
    },
    refetchInterval: HEALTH_POLL_INTERVAL_MS,
    staleTime: HEALTH_STALE_TIME_MS,
  });
}
