import { View } from "@tarojs/components";
import { ReactNode } from "react";
import "./StatsGrid.scss";

interface StatsGridProps {
  children: ReactNode;
  columns?: 2 | 3 | 4;
}

export function StatsGrid({ children, columns = 2 }: StatsGridProps) {
  return <View className={`neo-stats-grid neo-stats-grid-${columns}`}>{children}</View>;
}
