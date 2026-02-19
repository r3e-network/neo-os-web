import type { NextApiRequest, NextApiResponse } from "next";
import type { LeaderboardEntry } from "@/components/features/gamification/types";
import { apiError } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { standardLimit } from "@/lib/rate-limit";
import { getServerSupabaseClient, hasServiceRoleSupabase } from "@/lib/server-supabase";
import { calculateLevel, calculateXp } from "@/lib/gamification";

type LeaderboardRow = {
  rank: number;
  wallet: string;
  xp: number;
  level: number;
  badges: number;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (standardLimit(req, res)) return;
  if (req.method !== "GET") {
    return apiError.methodNotAllowed(res);
  }

  const limit = Math.max(1, Math.min(parseInt(req.query.limit as string) || 20, 100));
  const offset = Math.max(0, parseInt(req.query.offset as string) || 0);

  if (!hasServiceRoleSupabase()) {
    return res.status(200).json({ entries: [], total: 0, hasMore: false });
  }

  const supabase = getServerSupabaseClient({ requireServiceRole: true });
  if (!supabase) {
    return res.status(200).json({ entries: [], total: 0, hasMore: false });
  }

  const { data, error } = await supabase.rpc("get_gamification_leaderboard", {
    p_limit: limit,
    p_offset: offset,
  });

  if (!error && Array.isArray(data)) {
    const entries: LeaderboardEntry[] = (data as LeaderboardRow[]).map((row) => ({
      rank: Number(row.rank || 0),
      wallet: row.wallet,
      xp: Number(row.xp || 0),
      level: Number(row.level || 1),
      badges: Number(row.badges || 0),
    }));
    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
    return res.status(200).json({
      entries,
      total: offset + entries.length + (entries.length === limit ? 1 : 0),
      hasMore: entries.length === limit,
    });
  }

  if (error) {
    logger.warn("get_gamification_leaderboard RPC failed, using query fallback:", error.message);
  }

  // Fallback path for deployments that have not yet applied migration 045.
  const { data: usageRows, error: usageError } = await supabase
    .from("miniapp_usage")
    .select("user_id,tx_count,governance_used,app_id")
    .order("updated_at", { ascending: false })
    .limit(5000);

  if (usageError) {
    logger.error("miniapp_usage leaderboard fallback failed:", usageError.message);
    return res.status(200).json({ entries: [], total: 0, hasMore: false });
  }

  const aggregate = new Map<string, { totalTx: number; totalVotes: number; appIds: Set<string> }>();
  const userIds = new Set<string>();
  for (const row of usageRows || []) {
    const userId = String(row.user_id || "").trim();
    if (!userId) continue;
    userIds.add(userId);
    if (!aggregate.has(userId)) {
      aggregate.set(userId, { totalTx: 0, totalVotes: 0, appIds: new Set<string>() });
    }
    const current = aggregate.get(userId)!;
    const txCount = Number(row.tx_count || 0);
    current.totalTx += txCount;
    if (Number(row.governance_used || 0) > 0) {
      current.totalVotes += txCount;
    }
    if (row.app_id) {
      current.appIds.add(String(row.app_id));
    }
  }

  const userIdList = Array.from(userIds);
  const { data: usersRows } = userIdList.length > 0
    ? await supabase.from("users").select("id,address").in("id", userIdList)
    : { data: [] as Array<{ id: string; address: string | null }> };

  const walletByUserId = new Map<string, string>();
  for (const row of usersRows || []) {
    if (row.address) walletByUserId.set(row.id, row.address);
  }

  const unresolvedUserIds = userIdList.filter((id) => !walletByUserId.has(id));
  if (unresolvedUserIds.length > 0) {
    const { data: walletRows } = await supabase
      .from("user_wallets")
      .select("user_id,address,is_primary,created_at")
      .in("user_id", unresolvedUserIds)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: true });

    for (const row of walletRows || []) {
      const userId = String(row.user_id || "");
      if (!userId || walletByUserId.has(userId) || !row.address) continue;
      walletByUserId.set(userId, row.address);
    }
  }

  const ranked = Array.from(aggregate.entries())
    .map(([userId, value]) => {
      const wallet = walletByUserId.get(userId);
      if (!wallet) return null;
      const appsUsed = value.appIds.size;
      const xp = calculateXp(value.totalTx, appsUsed, value.totalVotes, 0);
      const level = calculateLevel(xp);
      const badges = (value.totalTx >= 1 ? 1 : 0) + (appsUsed >= 5 ? 1 : 0) + (value.totalVotes >= 1 ? 1 : 0);
      return { wallet, xp, level, badges };
    })
    .filter((row): row is { wallet: string; xp: number; level: number; badges: number } => Boolean(row))
    .sort((a, b) => (b.xp - a.xp) || a.wallet.localeCompare(b.wallet))
    .map((entry, index) => ({ rank: index + 1, ...entry }));

  const entries: LeaderboardEntry[] = ranked.slice(offset, offset + limit);

  return res.status(200).json({
    entries,
    total: ranked.length,
    hasMore: offset + limit < ranked.length,
  });
}
