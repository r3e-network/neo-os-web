"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Trophy, Medal, Crown } from "lucide-react";
import type { LeaderboardEntry } from "./types";
import { LEVELS } from "./constants";
import { logger } from "@/lib/logger";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchJSON } from "@/lib/fetch-client";

interface LeaderboardProps {
  currentWallet?: string;
}

type LeaderboardResponse = {
  entries?: LeaderboardEntry[];
};

export function Leaderboard({ currentWallet }: LeaderboardProps) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    const loadLeaderboard = async () => {
      try {
        const data = await fetchJSON<LeaderboardResponse>("/api/gamification/leaderboard?limit=20");
        if (!mountedRef.current) return;
        setEntries(data.entries || []);
      } catch (err) {
        logger.warn("Failed to fetch leaderboard:", err);
        if (mountedRef.current) setError("Failed to load leaderboard");
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    };
    loadLeaderboard();
    return () => { mountedRef.current = false; };
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-b border-gray-200">
          <Skeleton className="h-5 w-32" />
        </div>
        <div className="divide-y divide-gray-100">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <Skeleton className="h-6 w-8 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-5 w-16" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-8">
        {error ? (
          <div className="text-red-500">{error}</div>
        ) : (
          <div className="text-gray-500">No leaderboard entries yet</div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-b border-gray-200">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <Trophy size={18} className="text-amber-500" aria-hidden="true" />
          Leaderboard
        </h3>
      </div>
      <ol className="divide-y divide-gray-100">
        {entries.map((entry) => (
          <LeaderboardRow key={entry.rank} entry={entry} isCurrentUser={entry.wallet === currentWallet} />
        ))}
      </ol>
    </div>
  );
}

const LeaderboardRow = React.memo(function LeaderboardRow({ entry, isCurrentUser }: { entry: LeaderboardEntry; isCurrentUser: boolean }) {
  const level = LEVELS.find((l) => l.level === entry.level) || LEVELS[0];

  const getRankIcon = () => {
    if (entry.rank === 1) return <Crown size={16} className="text-amber-400" aria-label="1st place" />;
    if (entry.rank === 2) return <Medal size={16} className="text-gray-500" aria-label="2nd place" />;
    if (entry.rank === 3) return <Medal size={16} className="text-amber-600" aria-label="3rd place" />;
    return <span className="text-xs text-gray-500">#{entry.rank}</span>;
  };

  return (
    <li className={`flex items-center gap-3 px-4 py-3 transition-colors ${isCurrentUser ? "bg-emerald-50" : ""}`}>
      <div className="w-8 flex justify-center">{getRankIcon()}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-gray-900 truncate" title={entry.wallet}>{entry.wallet}</span>
          {isCurrentUser && <span className="text-xs text-emerald-500">(You)</span>}
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span className={level.color}>Lv.{entry.level}</span>
          <span>•</span>
          <span>{entry.badges} badges</span>
        </div>
      </div>
      <div className="text-right">
        <div className="font-bold text-gray-900">{entry.xp.toLocaleString()}</div>
        <div className="text-xs text-gray-500">XP</div>
      </div>
    </li>
  );
})
