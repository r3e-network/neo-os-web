"use client";

import type { MiniAppInfo } from "@/components/types";
import { MiniAppCard } from "./MiniAppCard";
import { LayoutGrid } from "lucide-react";

interface MiniAppGridProps {
  apps: MiniAppInfo[];
  columns?: 2 | 3 | 4;
}

export function MiniAppGrid({ apps, columns = 3 }: MiniAppGridProps) {
  const gridCols = {
    2: "grid-cols-1 md:grid-cols-2",
    3: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 md:grid-cols-2 lg:grid-cols-4",
  };

  if (apps.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-500 dark:text-gray-400 glass-panel rounded-3xl">
        <LayoutGrid className="w-12 h-12 mb-3 text-gray-300 dark:text-gray-700" />
        <p className="text-base font-semibold">No apps to display</p>
        <p className="text-sm mt-1">Check back later or try a different filter.</p>
      </div>
    );
  }

  return (
    <div className={`grid gap-6 ${gridCols[columns]}`}>
      {apps.map((app) => (
        <MiniAppCard key={app.app_id} app={app} />
      ))}
    </div>
  );
}
