import type { NextApiRequest, NextApiResponse } from "next";
import type { UserStats } from "@/components/features/gamification/types";
import { apiError } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { standardLimit } from "@/lib/rate-limit";
import {
  getServerSupabaseClient,
  hasServiceRoleSupabase,
} from "@/lib/server-supabase";
import {
  buildBadges,
  calculateLevel,
  calculateStreak,
  calculateXp,
} from "@/lib/gamification";
import {
  isValidWalletAddress,
  resolveUserIdFromWallet,
} from "@/lib/wallet-user";

type WalletStatsRow = {
  wallet: string;
  xp: number;
  level: number;
  badges: string[];
  rank: number;
  streak: number;
  total_tx: number;
  total_votes: number;
  apps_used: number;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (standardLimit(req, res)) return;
  res.setHeader("Cache-Control", "no-store, private");
  const { wallet } = req.query;

  if (!wallet || typeof wallet !== "string" || !isValidWalletAddress(wallet)) {
    return apiError.badRequest(res, "Missing wallet");
  }

  if (req.method === "GET") {
    return getStats(wallet, res);
  }

  return apiError.methodNotAllowed(res);
}

async function getStats(wallet: string, res: NextApiResponse) {
  try {
    const emptyStats: UserStats = {
      wallet,
      xp: 0,
      level: 1,
      badges: [],
      rank: 1,
      streak: 0,
      totalTx: 0,
      totalVotes: 0,
      appsUsed: 0,
    };

    if (!hasServiceRoleSupabase()) {
      res.status(200).json({ stats: emptyStats });
      return;
    }

    const supabase = getServerSupabaseClient({ requireServiceRole: true });
    if (!supabase) {
      res.status(200).json({ stats: emptyStats });
      return;
    }

    const { data, error } = await supabase.rpc(
      "get_gamification_wallet_stats",
      { p_wallet: wallet },
    );
    if (!error && Array.isArray(data) && data.length > 0) {
      const row = data[0] as WalletStatsRow;
      const stats: UserStats = {
        wallet: row.wallet || wallet,
        xp: Number(row.xp || 0),
        level: Number(row.level || 1),
        badges: Array.isArray(row.badges) ? row.badges : [],
        rank: Math.max(1, Number(row.rank || 1)),
        streak: Number(row.streak || 0),
        totalTx: Number(row.total_tx || 0),
        totalVotes: Number(row.total_votes || 0),
        appsUsed: Number(row.apps_used || 0),
      };
      res.status(200).json({ stats });
      return;
    }

    if (error) {
      logger.warn(
        "get_gamification_wallet_stats RPC failed, using query fallback:",
        error.message,
      );
    }

    // Fallback path for deployments that have not yet applied migration 045.
    const userId = await resolveUserIdFromWallet(supabase, wallet, {
      createIfMissing: false,
    });
    let totalTx = 0;
    let totalVotes = 0;
    let appsUsed = 0;
    let streak = 0;

    if (userId) {
      const { data: usageRows, error: usageError } = await supabase
        .from("miniapp_usage")
        .select("app_id,usage_date,tx_count,governance_used")
        .eq("user_id", userId)
        .order("usage_date", { ascending: false })
        .limit(5000);

      if (usageError) {
        logger.error(
          "miniapp_usage fallback query failed:",
          usageError.message,
        );
        res.status(200).json({ stats: emptyStats });
        return;
      }

      const uniqueApps = new Set<string>();
      const activityDates: string[] = [];
      for (const row of usageRows || []) {
        totalTx += Number(row.tx_count || 0);
        if (Number(row.governance_used || 0) > 0) {
          totalVotes += Number(row.tx_count || 0);
        }
        if (row.app_id) uniqueApps.add(row.app_id);
        if (row.usage_date) activityDates.push(String(row.usage_date));
      }
      appsUsed = uniqueApps.size;
      streak = calculateStreak(activityDates);
    } else {
      const { data: txRows, error: txError } = await supabase
        .from("miniapp_tx_events")
        .select("app_id,event_date")
        .eq("sender_address", wallet)
        .order("event_date", { ascending: false })
        .limit(5000);

      if (txError) {
        logger.error(
          "miniapp_tx_events fallback query failed:",
          txError.message,
        );
        res.status(200).json({ stats: emptyStats });
        return;
      }

      totalTx = (txRows || []).length;
      appsUsed = new Set(
        (txRows || []).map((row) => row.app_id).filter(Boolean),
      ).size;
      streak = calculateStreak(
        (txRows || [])
          .map((row) => String(row.event_date || ""))
          .filter(Boolean),
      );
    }

    const xp = calculateXp(totalTx, appsUsed, totalVotes, streak);
    const stats: UserStats = {
      wallet,
      xp,
      level: calculateLevel(xp),
      badges: buildBadges(totalTx, appsUsed, totalVotes, streak),
      rank: 1,
      streak,
      totalTx,
      totalVotes,
      appsUsed,
    };

    res.status(200).json({ stats });
    return;
  } catch (err) {
    logger.error(
      "gamification stats error:",
      err instanceof Error ? err.message : String(err),
    );
    res
      .status(500)
      .json({
        stats: {
          wallet,
          xp: 0,
          level: 1,
          badges: [],
          rank: 1,
          streak: 0,
          totalTx: 0,
          totalVotes: 0,
          appsUsed: 0,
        },
      });
    return;
  }
}
