import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LayoutGrid, List } from "lucide-react";

interface FilterOption {
  id: string;
  label: string;
}

interface FilterBarProps {
  filters: FilterOption[];
  activeFilter: string;
  onFilterChange: (id: string) => void;
  viewMode: "grid" | "list";
  onViewModeChange: (mode: "grid" | "list") => void;
}

export function FilterBar({ filters, activeFilter, onFilterChange, viewMode, onViewModeChange }: FilterBarProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
      <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 no-scrollbar">
        {filters.map((filter) => (
          <Button
            key={filter.id}
            variant="ghost"
            onClick={() => onFilterChange(filter.id)}
            className={cn(
              "h-auto rounded-full text-[10px] font-bold uppercase px-6 py-2 border transition-all hover:bg-erobo-peach/30 dark:hover:bg-white/5 whitespace-nowrap",
              activeFilter === filter.id
                ? "bg-erobo-purple/10 border-erobo-purple/30 text-erobo-purple shadow-sm dark:shadow-[0_0_15px_rgba(255,255,255,0.05)]"
                : "border-transparent text-erobo-ink-soft/70 dark:text-white/50 hover:text-erobo-ink dark:hover:text-white",
            )}
          >
            {filter.label}
          </Button>
        ))}
      </div>
      <div className="flex items-center gap-2 ml-auto">
        <div className="bg-white/70 dark:bg-white/5 p-1 flex items-center border border-white/60 dark:border-white/10 rounded-full backdrop-blur-md">
          <button
            onClick={() => onViewModeChange("grid")}
            className={cn(
              "p-2 rounded-md transition-all",
              viewMode === "grid"
                ? "bg-white dark:bg-white/10 text-erobo-ink dark:text-white shadow-sm"
                : "text-erobo-ink-soft/60 dark:text-white/40 hover:text-erobo-ink dark:hover:text-white hover:bg-erobo-peach/30 dark:hover:bg-white/5",
            )}
            aria-label="Grid view"
          >
            <LayoutGrid size={18} strokeWidth={2.5} />
          </button>
          <button
            onClick={() => onViewModeChange("list")}
            className={cn(
              "p-2 rounded-md transition-all",
              viewMode === "list"
                ? "bg-white dark:bg-white/10 text-erobo-ink dark:text-white shadow-sm"
                : "text-erobo-ink-soft/60 dark:text-white/40 hover:text-erobo-ink dark:hover:text-white hover:bg-erobo-peach/30 dark:hover:bg-white/5",
            )}
            aria-label="List view"
          >
            <List size={18} strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </div>
  );
}
