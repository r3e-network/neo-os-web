import React from "react";
import type { ThemeColors } from "./types";

export function Section({
  title,
  icon,
  children,
  themeColors,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
  themeColors: ThemeColors;
}) {
  return (
    <div className="border-b" style={{ borderColor: themeColors.border }}>
      <div className="px-4 py-3 flex items-center gap-2" style={{ background: `${themeColors.primary}08` }}>
        <span>{icon}</span>
        <span className="text-sm font-medium" style={{ color: themeColors.text }}>
          {title}
        </span>
      </div>
      <div className="px-4 py-3 space-y-2">{children}</div>
    </div>
  );
}
