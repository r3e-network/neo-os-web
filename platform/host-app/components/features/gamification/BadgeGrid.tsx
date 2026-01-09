"use client";

import { useState } from "react";
import { Award, X } from "lucide-react";
import type { Badge } from "./types";
import { BADGES } from "./constants";

interface BadgeGridProps {
  earnedBadges: string[];
}

const rarityColors = {
  common: "bg-gray-100 dark:bg-gray-800 border-gray-400",
  rare: "bg-blue-100 dark:bg-blue-900/50 border-blue-400",
  epic: "bg-purple-100 dark:bg-purple-900/50 border-purple-400",
  legendary: "bg-amber-100 dark:bg-amber-900/50 border-amber-400",
};

export function BadgeGrid({ earnedBadges }: BadgeGridProps) {
  const [selected, setSelected] = useState<Badge | null>(null);

  return (
    <div className="space-y-4">
      <h3 className="font-black text-black dark:text-white flex items-center gap-2 uppercase italic tracking-tighter">
        <Award size={20} className="text-brutal-purple" strokeWidth={2.5} />
        Badges ({earnedBadges.length}/{BADGES.length})
      </h3>

      <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
        {BADGES.map((badge) => {
          const earned = earnedBadges.includes(badge.id);
          return <BadgeItem key={badge.id} badge={badge} earned={earned} onClick={() => setSelected(badge)} />;
        })}
      </div>

      {selected && (
        <BadgeModal badge={selected} earned={earnedBadges.includes(selected.id)} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

function BadgeItem({ badge, earned, onClick }: { badge: Badge; earned: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`aspect-square p-2 rounded-none border-2 flex items-center justify-center transition-all shadow-brutal-xs hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] ${earned
          ? "bg-white dark:bg-[#222] border-black dark:border-white text-black dark:text-white"
          : "bg-gray-50 dark:bg-black border-gray-300 dark:border-gray-700 opacity-50 grayscale"
        }`}
      title={badge.name}
    >
      <span className="text-3xl filter drop-shadow-sm transform hover:scale-110 transition-transform">{badge.icon}</span>
    </button>
  );
}

function BadgeModal({ badge, earned, onClose }: { badge: Badge; earned: boolean; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative bg-white dark:bg-[#111] rounded-none border-4 border-black dark:border-white p-6 max-w-sm w-full mx-4 shadow-brutal-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-2 right-2 p-1 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors"
        >
          <X size={24} strokeWidth={3} />
        </button>

        <div className="text-center pt-2">
          <div className="text-6xl mb-4 filter drop-shadow-md animate-bounce-gentle inline-block">{badge.icon}</div>
          <h3 className="text-2xl font-black text-black dark:text-white uppercase italic tracking-tighter">{badge.name}</h3>

          <span
            className={`inline-block mt-2 px-3 py-1 text-xs font-black uppercase border-2 border-black dark:border-white rounded-none shadow-brutal-xs ${rarityColors[badge.rarity] || "bg-gray-100"}`}
          >
            {badge.rarity}
          </span>

          <p className="mt-4 text-sm font-bold text-gray-600 dark:text-gray-300 uppercase leading-snug">{badge.description}</p>
          <p className="mt-2 text-xs font-mono text-gray-500 dark:text-gray-500 bg-gray-100 dark:bg-black border border-gray-300 dark:border-gray-700 p-2 break-all">{badge.requirement}</p>

          <div className="mt-6 pt-4 border-t-2 border-dashed border-black dark:border-white">
            <span className="text-brutal-orange font-black text-lg">+{badge.points} XP</span>
          </div>

          {!earned && (
            <div className="mt-2 absolute top-0 left-0 bg-red-500 text-white text-[10px] font-black uppercase px-2 py-1 transform -rotate-12 border-2 border-white shadow-sm">
              Locked
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
