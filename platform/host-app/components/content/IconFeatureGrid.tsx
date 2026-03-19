import type { LucideIcon } from "lucide-react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type IconFeatureItem = {
  icon: LucideIcon;
  title: string;
  description: string;
  color?: string;
  colorClass?: string;
};

type IconFeatureGridProps = {
  items: IconFeatureItem[];
  columns?: 1 | 2 | 3 | 4;
  compact?: boolean;
  showChevron?: boolean;
  className?: string;
};

const columnClasses: Record<NonNullable<IconFeatureGridProps["columns"]>, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 md:grid-cols-2",
  3: "grid-cols-1 md:grid-cols-2 xl:grid-cols-3",
  4: "grid-cols-1 md:grid-cols-2 xl:grid-cols-4",
};

export function IconFeatureGrid({
  items,
  columns = 2,
  compact = false,
  showChevron = false,
  className,
}: IconFeatureGridProps) {
  return (
    <div className={cn("grid gap-4", columnClasses[columns], className)}>
      {items.map((item) => {
        const iconBgClass = item.colorClass || (item.color ? `bg-gradient-to-br ${item.color}` : "");

        return (
          <div
            key={item.title}
            className={cn(
              "rounded-2xl border border-gray-200 bg-gray-50 transition-colors dark:border-gray-700 dark:bg-gray-900/50",
              compact ? "flex items-center gap-4 p-4" : "p-6",
            )}
          >
            <div
              className={cn(
                "flex h-12 w-12 items-center justify-center rounded-xl bg-neo/10",
                compact && "shrink-0",
                iconBgClass,
              )}
            >
              <item.icon className={iconBgClass ? "text-white" : "text-neo"} size={compact ? 20 : 24} aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="font-semibold text-gray-900 dark:text-white">{item.title}</h4>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{item.description}</p>
            </div>
            {showChevron && <ChevronRight className="ml-auto text-gray-500 dark:text-gray-400" size={16} aria-hidden="true" />}
          </div>
        );
      })}
    </div>
  );
}
