import type { NextApiRequest, NextApiResponse } from "next";
import { getBatchStats } from "../../../lib/miniapp-stats";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const network = (req.query.network as "testnet" | "mainnet") || "testnet";

  // Get appIds from query or body
  let appIds: string[] = [];
  if (req.method === "GET" && req.query.appIds) {
    appIds = (req.query.appIds as string).split(",");
  } else if (req.method === "POST" && req.body?.appIds) {
    appIds = req.body.appIds;
  }

  if (!appIds.length) {
    return res.status(400).json({ error: "appIds required" });
  }

  try {
    const stats = await getBatchStats(appIds, network);
    res.status(200).json({ stats });
  } catch (error) {
    console.error("Batch stats error:", error);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
}
