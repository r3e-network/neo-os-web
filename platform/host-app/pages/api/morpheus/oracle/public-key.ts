import type { NextApiRequest, NextApiResponse } from "next";
import { standardLimit } from "@/lib/rate-limit";
import { fetchOraclePublicKey } from "@/lib/morpheus-oracle";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (standardLimit(req, res)) return;

  if (String(req.method || "GET").toUpperCase() !== "GET") {
    res.status(405).json({ error: "GET required" });
    return;
  }

  try {
    const payload = await fetchOraclePublicKey(String(req.query.network || "").trim() || null);
    res.status(200).json(payload);
  } catch (error) {
    console.error("Failed to load oracle public key", error);
    res.status(502).json({ error: "Failed to load oracle public key" });
  }
}
