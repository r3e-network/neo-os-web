/**
 * NeoBurger Stats API
 * Returns current staking statistics including APR
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { getNeoBurgerStats } from "../../../lib/neoburger";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const network = (req.query.network as string) || "mainnet";

    if (network !== "mainnet" && network !== "testnet") {
      return res.status(400).json({ error: "Invalid network parameter" });
    }

    const stats = await getNeoBurgerStats(network);

    res.status(200).json(stats);
  } catch (error) {
    console.error("NeoBurger stats API error:", error);
    res.status(500).json({ error: "Failed to fetch NeoBurger stats" });
  }
}
