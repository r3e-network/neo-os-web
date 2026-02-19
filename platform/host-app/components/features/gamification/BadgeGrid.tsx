"use client";

import { useEffect, useState } from "react";
import { Award } from "lucide-react";
import type { Badge } from "./types";
import { BADGES } from "./constants";

interface BadgeGridProps {
  earnedBadges: string[];
}

const rarityColors = {
  common: "bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600",
  rare: "bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700",
  epic: "bg-purple-50 dark:bg-purple-900/20 border-purple-300 dark:border-purple-700",
  legendary: "bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-600",
};

export function BadgeGrid({ earnedBadges }: BadgeGridProps) {
  const [selected, setSelected] = useState<Badge | null>(null);

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
        <Award size={18} className="text-purple-500" />
        Badges ({earnedBadges.length}/{BADGES.length})
      </h3>

      <div className="grid grid-cols-4 gap-2">
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
      type="button"
      onClick={onClick}
      aria-label={`${badge.name} badge${earned ? "" : " (not earned)"}`}
      className={`p-3 rounded-lg border-2 text-center transition-all ${
        earned
          ? rarityColors[badge.rarity]
          : "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 opacity-40"
      } hover:scale-105`}
    >
      <span className="text-2xl">{badge.icon}</span>
    </button>
  );
}

function BadgeModal({ badge, earned, onClose }: { badge: Badge; earned: boolean; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={badge.name + " badge details"}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
      tabIndex={-1}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-xl p-6 max-w-sm mx-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center">
          <span className="text-5xl">{badge.icon}</span>
          <h3 className="mt-3 text-xl font-bold text-gray-900 dark:text-white">{badge.name}</h3>
          <span
            className={`inline-block mt-1 px-2 py-0.5 text-xs rounded-full capitalize ${rarityColors[badge.rarity]}`}
          >
            {badge.rarity}
          </span>
          <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">{badge.description}</p>
          <p className="mt-2 text-xs text-gray-500">{badge.requirement}</p>
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <span className="text-amber-500 font-bold">+{badge.points} XP</span>
          </div>
          {!earned && <p className="mt-2 text-xs text-gray-400">Not yet earned</p>}
        </div>
      </div>
    </div>
  );
}
