import type { NextApiRequest, NextApiResponse } from "next";
import type { LeaderboardEntry } from "@/components/features/gamification/types";

// Mock leaderboard data
const mockLeaderboard: LeaderboardEntry[] = Array.from({ length: 50 }, (_, i) => ({
  rank: i + 1,
  wallet: `N${Math.random().toString(36).slice(2, 8)}...${Math.random().toString(36).slice(2, 6)}`,
  xp: Math.floor(5000 - i * 80 + Math.random() * 50),
  level: Math.max(1, 6 - Math.floor(i / 10)),
  badges: Math.floor(8 - i / 7),
}));

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const offset = parseInt(req.query.offset as string) || 0;

  const entries = mockLeaderboard.slice(offset, offset + limit);

  return res.status(200).json({
    entries,
    total: mockLeaderboard.length,
    hasMore: offset + limit < mockLeaderboard.length,
  });
}
