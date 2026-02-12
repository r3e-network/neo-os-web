"use client";

import { useState, useEffect } from "react";
import { Trophy, Medal, Crown } from "lucide-react";
import type { LeaderboardEntry } from "./types";
import { LEVELS } from "./constants";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

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
    return <div className="text-center py-8 text-erobo-ink-soft/60 font-bold uppercase tracking-wider text-xs animate-pulse">Loading Leaderboard...</div>;
  }

  return (
    <div className="bg-white dark:bg-white/5 backdrop-blur-sm rounded-2xl border border-erobo-purple/10 dark:border-white/10 overflow-hidden shadow-sm">
      <div className="px-6 py-4 border-b border-erobo-purple/10 dark:border-white/10 bg-erobo-purple/5/50 dark:bg-white/5">
        <h3 className="text-lg font-bold text-erobo-ink dark:text-white flex items-center gap-2">
          <Trophy size={20} className="text-neo" strokeWidth={2.5} />
          Leaderboard
        </h3>
      </div>
      <div className="divide-y divide-erobo-purple/5 dark:divide-white/5">
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
    if (entry.rank === 1) return <Crown size={20} className="text-amber-500 fill-amber-100 dark:fill-amber-900/20" strokeWidth={2.5} />;
    if (entry.rank === 2) return <Medal size={20} className="text-erobo-ink-soft/60 fill-erobo-purple/10 dark:fill-white/10" strokeWidth={2.5} />;
    if (entry.rank === 3) return <Medal size={20} className="text-amber-700 fill-amber-50 dark:fill-amber-900/10" strokeWidth={2.5} />;
    return <span className="text-sm font-bold text-erobo-ink-soft dark:text-slate-400 font-mono">#{entry.rank}</span>;
  };

  return (
    <div className={cn(
      "flex items-center gap-4 px-6 py-4 transition-colors duration-200",
      isCurrentUser
        ? "bg-neo/5 dark:bg-neo/10"
        : "hover:bg-erobo-purple/5 dark:hover:bg-white/5"
    )}>
      <div className="w-8 flex justify-center">{getRankIcon()}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-bold text-erobo-ink dark:text-slate-100 truncate text-sm font-mono">{entry.wallet}</span>
          {isCurrentUser && (
            <Badge variant="secondary" className="text-[10px] uppercase font-bold px-1.5 py-0 h-5 bg-neo/20 text-neo border-0">
              You
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs font-medium text-erobo-ink-soft dark:text-slate-400 mt-0.5">
          <span style={{ color: level.color }} className="font-bold">Lv.{entry.level}</span>
          <span>•</span>
          <span>{entry.badges} badges</span>
        </div>
      </div>
      <div className="text-right">
        <div className="font-bold text-erobo-ink dark:text-white tabular-nums">{entry.xp.toLocaleString()}</div>
        <div className="text-[10px] font-bold uppercase text-erobo-ink-soft/60 dark:text-slate-500 tracking-wider">XP</div>
      </div>
    </div>
  );
}
