import type { NextApiRequest, NextApiResponse } from "next";
import { standardLimit } from "@/lib/rate-limit";
import { fetchOraclePublicKey } from "@/lib/morpheus-oracle";
import { logger } from "@/lib/logger";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (standardLimit(req, res)) return;

  if (String(req.method || "GET").toUpperCase() !== "GET") {
    return res.status(405).json({ error: "GET required" });
  }

  try {
    const payload = await fetchOraclePublicKey(String(req.query.network || "").trim() || null);
    return res.status(200).json(payload);
  } catch (error) {
    logger.error("Failed to load oracle public key", error);
    return res.status(502).json({ error: "Failed to load oracle public key" });
  }
}
