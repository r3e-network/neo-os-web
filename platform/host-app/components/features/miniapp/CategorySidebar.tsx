import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface Category {
  id: string;
  label: string;
  icon: LucideIcon;
  count: number;
}

interface CategorySidebarProps {
  categories: Category[];
  selectedCategory: string;
  onSelectCategory: (id: string) => void;
}

export function CategorySidebar({ categories, selectedCategory, onSelectCategory }: CategorySidebarProps) {
  return (
    <div className="space-y-1">
      {categories.map((cat) => {
        const Icon = cat.icon;
        const isActive = selectedCategory === cat.id;
        return (
          <button
            key={cat.id}
            onClick={() => onSelectCategory(cat.id)}
            className={cn(
              "w-full flex items-center justify-between px-4 py-3 text-sm font-bold uppercase transition-all cursor-pointer rounded-lg border",
              isActive
                ? "bg-erobo-purple/10 border-erobo-purple/30 text-erobo-purple shadow-[0_0_15px_rgba(159,157,243,0.15)]"
                : "border-transparent text-erobo-ink-soft dark:text-white/60 hover:text-erobo-ink dark:hover:text-white hover:bg-erobo-peach/30 dark:hover:bg-white/5",
            )}
          >
            <span className="flex items-center gap-2">
              <Icon size={16} strokeWidth={2.5} />
              {cat.label}
            </span>
            <span
              className={cn(
                "text-[10px] px-2 py-0.5 rounded-full border",
                isActive
                  ? "bg-erobo-purple/20 text-erobo-purple border-erobo-purple/30"
                  : "bg-white/70 dark:bg-white/5 text-erobo-ink-soft/70 dark:text-white/40 border-white/60 dark:border-white/10",
              )}
            >
              {cat.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
