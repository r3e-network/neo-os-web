"use client";

import { MiniAppCard, type MiniAppInfo } from "./MiniAppCard";

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

  return (
    <div className={`grid gap-6 ${gridCols[columns]}`}>
      {apps.map((app) => (
        <MiniAppCard key={app.app_id} app={app} />
      ))}
    </div>
  );
}
