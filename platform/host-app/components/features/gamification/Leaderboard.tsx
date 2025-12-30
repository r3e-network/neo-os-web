"use client";

import { useState, useEffect } from "react";
import { Trophy, Medal, Crown } from "lucide-react";
import type { LeaderboardEntry } from "./types";
import { LEVELS } from "./constants";

interface LeaderboardProps {
  currentWallet?: string;
}

export function Leaderboard({ currentWallet }: LeaderboardProps) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    try {
      const res = await fetch("/api/gamification/leaderboard?limit=20");
      if (res.ok) {
        const data = await res.json();
        setEntries(data.entries);
      }
    } catch {
      // Silent fail
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8 text-gray-500">Loading...</div>;
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-4 py-3 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-b border-gray-200 dark:border-gray-700">
        <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Trophy size={18} className="text-amber-500" />
          Leaderboard
        </h3>
      </div>
      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        {entries.map((entry) => (
          <LeaderboardRow key={entry.rank} entry={entry} isCurrentUser={entry.wallet === currentWallet} />
        ))}
      </div>
    </div>
  );
}

function LeaderboardRow({ entry, isCurrentUser }: { entry: LeaderboardEntry; isCurrentUser: boolean }) {
  const level = LEVELS.find((l) => l.level === entry.level) || LEVELS[0];

  const getRankIcon = () => {
    if (entry.rank === 1) return <Crown size={16} className="text-amber-400" />;
    if (entry.rank === 2) return <Medal size={16} className="text-gray-400" />;
    if (entry.rank === 3) return <Medal size={16} className="text-amber-600" />;
    return <span className="text-xs text-gray-500">#{entry.rank}</span>;
  };

  return (
    <div className={`flex items-center gap-3 px-4 py-3 ${isCurrentUser ? "bg-emerald-50 dark:bg-emerald-900/20" : ""}`}>
      <div className="w-8 flex justify-center">{getRankIcon()}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-900 dark:text-white truncate">{entry.wallet}</span>
          {isCurrentUser && <span className="text-xs text-emerald-500">(You)</span>}
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span style={{ color: level.color }}>Lv.{entry.level}</span>
          <span>•</span>
          <span>{entry.badges} badges</span>
        </div>
      </div>
      <div className="text-right">
        <div className="font-bold text-gray-900 dark:text-white">{entry.xp.toLocaleString()}</div>
        <div className="text-xs text-gray-500">XP</div>
      </div>
    </div>
  );
}
