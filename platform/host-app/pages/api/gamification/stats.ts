import type { NextApiRequest, NextApiResponse } from "next";
import type { UserStats } from "@/components/features/gamification/types";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

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

async function getStats(wallet: string, res: NextApiResponse) {
  if (!supabaseUrl || !supabaseAnonKey) {
    return res.status(200).json({ stats: getDefaultStats(wallet) });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const { data, error } = await supabase.from("user_leaderboard").select("*").eq("wallet", wallet).single();

    if (error || !data) {
      return res.status(200).json({ stats: getDefaultStats(wallet) });
    }

    const stats: UserStats = {
      wallet: data.wallet,
      xp: data.xp || 0,
      level: data.level || 1,
      badges: ["first_tx"],
      rank: 0,
      streak: 0,
      totalTx: data.total_tx || 0,
      totalVotes: 0,
      appsUsed: data.apps_used || 0,
    };

    return res.status(200).json({ stats });
  } catch (err) {
    console.error("Gamification stats error:", err);
    return res.status(200).json({ stats: getDefaultStats(wallet) });
  }
}

function getDefaultStats(wallet: string): UserStats {
  return {
    wallet,
    xp: 0,
    level: 1,
    badges: [],
    rank: 0,
    streak: 0,
    totalTx: 0,
    totalVotes: 0,
    appsUsed: 0,
  };
}
