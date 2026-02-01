import { useQuery } from "@tanstack/react-query";

export interface MiniAppData {
  app_id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  stats?: { users: number; transactions: number };
}

async function fetchMiniApps(): Promise<MiniAppData[]> {
  const res = await fetch("/api/miniapp-stats");
  if (!res.ok) throw new Error("Failed to fetch");
  const data = await res.json();
  return data.stats || [];
}

export function useMiniApps() {
  return useQuery({
    queryKey: ["miniapps"],
    queryFn: fetchMiniApps,
  });
}
