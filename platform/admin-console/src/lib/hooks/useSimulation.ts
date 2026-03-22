import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAdminAuthHeaders } from "@/lib/admin-client";

export interface SimulationStatus {
  running: boolean;
  active_miniapps: string[];
  workers_per_app: number;
  uptime_seconds?: number;
  tx_count?: number;
}

export function useSimulationStatus() {
  return useQuery<SimulationStatus>({
    queryKey: ["simulation", "status"],
    queryFn: async () => {
      const res = await fetch("/api/simulations", { headers: getAdminAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch simulation status");
      return res.json();
    },
    refetchInterval: 5000,
  });
}

export function useStartSimulation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (config?: unknown) => {
      const res = await fetch("/api/simulations", {
        method: "POST",
        headers: { ...getAdminAuthHeaders(), "Content-Type": "application/json" },
        body: (() => { try { return JSON.stringify({ action: "start", config }); } catch (_e: unknown) { console.warn("[useSimulation] JSON.stringify failed:", _e instanceof Error ? _e.message : String(_e)); return '{"action":"start"}'; } })(),
      });
      if (!res.ok) {
        const error = await res.json().catch((e: unknown) => { console.warn("[useSimulation] failed to parse start simulation response:", e instanceof Error ? e.message : String(e)); return { error: "Failed to start simulation" }; });
        throw new Error(error.error || "Failed to start simulation");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["simulation", "status"] });
    },
  });
}

export function useStopSimulation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/simulations", {
        method: "POST",
        headers: { ...getAdminAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ action: "stop" }),
      });
      if (!res.ok) {
        const error = await res.json().catch((e: unknown) => { console.warn("[useSimulation] failed to parse stop simulation response:", e instanceof Error ? e.message : String(e)); return { error: "Failed to stop simulation" }; });
        throw new Error(error.error || "Failed to stop simulation");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["simulation", "status"] });
    },
  });
}
