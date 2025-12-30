import type { NextApiRequest, NextApiResponse } from "next";
import { getMiniAppStats, getLiveStatus } from "../../../../lib/miniapp-stats";
import { apiError } from "../../../../lib/api-response";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return apiError.methodNotAllowed(res);
  }

  const { appId } = req.query;
  if (!appId || typeof appId !== "string") {
    return res.status(400).json({ error: "appId is required" });
  }

  const network = (req.query.network as "testnet" | "mainnet") || "testnet";

  try {
    const stats = await getMiniAppStats(appId, network);
    if (!stats) {
      return res.status(404).json({ error: "App not found" });
    }

    res.status(200).json({ stats });
  } catch (error) {
    console.error("Stats fetch error:", error);
    return res.status(500).json({ error: "Failed to fetch stats" });
  }
}
