import type { NextApiRequest, NextApiResponse } from "next";
import { standardLimit } from "@/lib/rate-limit";
import { fetchOraclePublicKey } from "@/lib/morpheus-oracle";
import { logger } from "@/lib/logger";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  // MiniApps are embedded in an opaque-origin sandbox. This route exposes a
  // public encryption key only, so make it readable without weakening the
  // iframe sandbox.
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Accept");
  res.setHeader("Cache-Control", "no-store, private");

  const method = String(req.method || "GET").toUpperCase();
  if (method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (standardLimit(req, res)) return;

  if (method !== "GET") {
    res.status(405).json({ error: "GET required" });
    return;
  }

  try {
    const payload = await fetchOraclePublicKey(
      String(req.query.network || "").trim() || null,
    );
    res.status(200).json(payload);
    return;
  } catch (error) {
    logger.error("Failed to load oracle public key", error);
    res.status(502).json({ error: "Failed to load oracle public key" });
    return;
  }
}
