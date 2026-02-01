import type { NextApiRequest, NextApiResponse } from "next";
import { buildStatsHighlights, getAppHighlights, type AppHighlight } from "@/lib/app-highlights";
import { getNeoBurgerStats } from "@/lib/neoburger";

type HighlightsResponse = { highlights: AppHighlight[] } | { error: string };

type AppStats = {
  app_id: string;
  total_users: number;
  total_transactions: number;
  total_gas_used: string;
};

function getAppId(param: string | string[] | undefined): string | null {
  if (!param) return null;
  if (Array.isArray(param)) return param[0] || null;
  return param;
}

function getBaseUrl(req: NextApiRequest): string {
  const host = req.headers.host;
  if (!host) return "";
  const protoHeader = req.headers["x-forwarded-proto"];
  const protocol = typeof protoHeader === "string" ? protoHeader : "http";
  return `${protocol}://${host}`;
}

async function fetchAppStats(req: NextApiRequest, appId: string): Promise<AppStats | null> {
  const baseUrl = getBaseUrl(req);
  const url = `${baseUrl}/api/miniapp-stats?app_id=${encodeURIComponent(appId)}`;
  const res = await fetch(url);
  if (res && typeof res.ok === "boolean" && !res.ok) {
    throw new Error(`Stats request failed (${res.status})`);
  }
  const data = await res.json();
  if (!data || !Array.isArray(data.stats) || data.stats.length === 0) return null;
  return data.stats[0] as AppStats;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<HighlightsResponse>) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const appId = getAppId(req.query.appId);
  if (!appId) {
    return res.status(400).json({ error: "appId is required" });
  }

  try {
    if (appId === "miniapp-neoburger") {
      const stats = await getNeoBurgerStats("neo-n3-mainnet");
      return res.status(200).json({
        highlights: [
          { label: "APR", value: `${stats.apr}%` },
          { label: "Total Staked", value: stats.totalStakedFormatted },
        ],
      });
    }

    const stats = await fetchAppStats(req, appId);
    if (stats) {
      return res.status(200).json({ highlights: buildStatsHighlights(stats) });
    }

    return res.status(200).json({ highlights: getAppHighlights(appId) });
  } catch (error) {
    console.error("App highlights error:", error);
    return res.status(200).json({ highlights: getAppHighlights(appId) });
  }
}
