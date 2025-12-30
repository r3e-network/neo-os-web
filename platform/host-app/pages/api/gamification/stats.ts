import type { NextApiRequest, NextApiResponse } from "next";
import type { UserStats } from "@/components/features/gamification/types";

// In-memory store (replace with Supabase in production)
const userStatsStore: Map<string, UserStats> = new Map();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { wallet } = req.query;

  if (!wallet || typeof wallet !== "string") {
    return res.status(400).json({ error: "Missing wallet" });
  }

  if (req.method === "GET") {
    return getStats(wallet, res);
  }

  return res.status(405).json({ error: "Method not allowed" });
}

function getStats(wallet: string, res: NextApiResponse) {
  let stats = userStatsStore.get(wallet);

  if (!stats) {
    // Create default stats for new user
    stats = {
      wallet,
      xp: Math.floor(Math.random() * 1500),
      level: 1,
      badges: ["first_tx"],
      rank: Math.floor(Math.random() * 1000) + 1,
      streak: Math.floor(Math.random() * 30),
      totalTx: Math.floor(Math.random() * 200),
      totalVotes: Math.floor(Math.random() * 50),
      appsUsed: Math.floor(Math.random() * 20),
    };
    stats.level = calculateLevel(stats.xp);
    userStatsStore.set(wallet, stats);
  }

  return res.status(200).json({ stats });
}

function calculateLevel(xp: number): number {
  if (xp >= 2000) return 6;
  if (xp >= 1000) return 5;
  if (xp >= 600) return 4;
  if (xp >= 300) return 3;
  if (xp >= 100) return 2;
  return 1;
}
