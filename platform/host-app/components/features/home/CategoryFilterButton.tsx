import { type ComponentType } from "react";
import { cn } from "@/lib/utils";
import { getCategoryTheme, type CategoryId } from "@/lib/category-theme";

export function CategoryFilterButton({
  category: cat,
  isActive,
  onSelect,
}: {
  category: {
    id: string;
    label: string;
    icon: ComponentType<{
      size?: number | string;
      className?: string;
      style?: React.CSSProperties;
    }>;
    count: number;
  };
  isActive: boolean;
  onSelect: () => void;
}) {
  const Icon = cat.icon;
  const theme = getCategoryTheme(cat.id as CategoryId);
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "group relative w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo",
        isActive
          ? `${theme.bgTint} ${theme.text} font-bold border ${theme.borderActive}`
          : "text-gray-600 border border-transparent hover:bg-white hover:text-gray-900 hover:border-gray-200",
      )}
    >
      {isActive && (
        <span
          aria-hidden="true"
          className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full"
          style={{ backgroundColor: theme.accent }}
        />
      )}
      <span className="flex items-center gap-3 text-sm">
        <Icon
          size={18}
          className={isActive ? "" : "text-gray-400 group-hover:text-gray-600"}
          style={isActive ? { color: theme.accent } : undefined}
          aria-hidden="true"
        />
        {cat.label}
      </span>
      <span
        className={cn(
          "text-xs px-2.5 py-1 rounded-full font-semibold",
          isActive
            ? `${theme.countBg} ${theme.countText}`
            : "bg-gray-100 text-gray-500 group-hover:bg-gray-200",
        )}
      >
        {cat.count}
      </span>
    </button>
  );
}
