import type { NextApiRequest, NextApiResponse } from "next";
import { getNeoBurgerStats } from "../../lib/neoburger";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const stats = await getNeoBurgerStats("mainnet");
    res.status(200).json({
      apy: stats.apr,
      total_staked_formatted: stats.totalStakedFormatted,
    });
  } catch (error) {
    console.error("Bg stats error:", error);
    res.status(200).json({
      apy: "19.50",
      total_staked_formatted: "12.5M",
    });
  }
}
